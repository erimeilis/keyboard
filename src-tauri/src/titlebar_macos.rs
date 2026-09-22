//! Real AppKit window buttons for a borderless window.
//!
//! The trainer used to paint its own traffic lights in CSS. Geometry can be matched by
//! measuring, but the fill is not a flat colour on macOS 27 — the lights are a glass
//! material with hover glyphs and an inactive state — and it cannot be sampled
//! reliably from outside, so any CSS colour is a guess. Hosting the genuine
//! `NSWindow.standardWindowButton` views removes the guessing: appearance, hover
//! symbols and active/inactive dimming all come from AppKit.
//!
//! The buttons keep this app's behaviour rather than the standard one, and it differs
//! per mode, so each is retargeted at a small Objective-C object that forwards the
//! click to the frontend as a Tauri event and lets the frontend decide:
//!
//!   overlay  red = hide the window, yellow = collapse, green = open the trainer
//!   trainer  red = exit to the overlay, yellow = hide, green = zoom / restore
//!
//! Only subviews are added; the window's style mask is never touched. Changing the mask
//! on this transparent/NSPanel window throws an uncaught NSException (that is what
//! `set_decorations` did), and adding subviews does not go near it.

use std::sync::OnceLock;

use objc2::rc::Retained;
use objc2::runtime::{AnyObject, NSObject};
use objc2::{define_class, msg_send, sel, AnyThread};
use objc2_app_kit::{
    NSAutoresizingMaskOptions, NSButton, NSView, NSWindow, NSWindowButton, NSWindowStyleMask,
};
use objc2_app_kit::NSViewFrameDidChangeNotification;
use objc2_foundation::{
    MainThreadMarker, NSArray, NSNotificationCenter, NSNumber, NSPoint, NSRect, NSSize, NSString,
};
use tauri::Emitter;

/// Measured from a real titled NSWindow on macOS 27.0 (build 26A428):
/// 32px titlebar, 14x14 buttons, 9px inset, 9px gaps, 9px above and below.
const BAR_HEIGHT: f64 = 32.0;
const SIZE: f64 = 14.0;
const INSET: f64 = 9.0;
const GAP: f64 = 9.0;

/// Pin to the top-left: a flexible bottom margin only, so the buttons stay against the
/// top edge as the window resizes.
const AUTORESIZE_PIN_TOP_LEFT: NSAutoresizingMaskOptions =
    NSAutoresizingMaskOptions::ViewMinYMargin;

/// The event payload the frontend dispatches on.
pub const EVENT: &str = "titlebar-action";

static APP: OnceLock<tauri::AppHandle> = OnceLock::new();

// AppKit objects are neither Send nor Sync, so they cannot be held in a static
// directly. They are kept as addresses instead; every access below is on the main
// thread, which is the only thread AppKit permits here anyway.
//
// The target is deliberately leaked: NSControl holds its target weakly, so dropping
// our reference would leave the buttons pointing at freed memory. The buttons
// themselves are retained by the content view as subviews.
static TARGET_PTR: OnceLock<usize> = OnceLock::new();
static BUTTON_PTRS: OnceLock<Vec<usize>> = OnceLock::new();
static CONTENT_PTR: OnceLock<usize> = OnceLock::new();
// Last height laid out for, so the relayout logs once per real size change instead of
// once per frame during a drag.
static LAST_HEIGHT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

fn emit(action: &str) {
    log::info!("titlebar: native button clicked -> {action}");
    match APP.get() {
        Some(app) => {
            if let Err(e) = app.emit(EVENT, action) {
                log::error!("titlebar: failed to emit {action}: {e}");
            }
        }
        None => log::error!("titlebar: {action} clicked before the app handle was stored"),
    }
}

define_class!(
    // A plain NSObject whose only job is to be the buttons' target. State lives in the
    // statics above rather than in ivars, so the class stays trivial.
    #[unsafe(super(NSObject))]
    #[name = "HKTitlebarTarget"]
    #[derive(Debug)]
    struct TitlebarTarget;

    impl TitlebarTarget {
        #[unsafe(method(hkClose:))]
        fn hk_close(&self, _sender: *mut AnyObject) {
            emit("close");
        }

        #[unsafe(method(hkMiniaturize:))]
        fn hk_miniaturize(&self, _sender: *mut AnyObject) {
            emit("miniaturize");
        }

        #[unsafe(method(hkZoom:))]
        fn hk_zoom(&self, _sender: *mut AnyObject) {
            emit("zoom");
        }

        #[unsafe(method(hkRelayout:))]
        fn hk_relayout(&self, _note: *mut AnyObject) {
            layout();
        }
    }
);

impl TitlebarTarget {
    fn new() -> Retained<Self> {
        unsafe { msg_send![Self::alloc(), init] }
    }
}

/// Installs the three buttons into the window's content view.
///
/// Returns false when anything is unavailable, in which case the caller should leave the
/// CSS lights in place.
pub fn install(window: &tauri::WebviewWindow, app: tauri::AppHandle) -> bool {
    let Some(mtm) = MainThreadMarker::new() else {
        log::warn!("titlebar: not on the main thread; skipping native buttons");
        return false;
    };

    let _ = APP.set(app);
    let target_ptr = *TARGET_PTR.get_or_init(|| Retained::into_raw(TitlebarTarget::new()) as usize);
    let target: &TitlebarTarget = unsafe { &*(target_ptr as *const TitlebarTarget) };

    let ns_window = match window.ns_window() {
        Ok(p) if !p.is_null() => p as *mut AnyObject,
        _ => {
            log::warn!("titlebar: no ns_window; keeping the drawn lights");
            return false;
        }
    };

    // A borderless window has no standard buttons of its own, so they are built for the
    // style mask a titled window would have.
    let mask = NSWindowStyleMask::Titled
        | NSWindowStyleMask::Closable
        | NSWindowStyleMask::Miniaturizable
        | NSWindowStyleMask::Resizable;

    let content: Retained<NSView> = unsafe {
        let v: *mut AnyObject = msg_send![ns_window, contentView];
        if v.is_null() {
            log::warn!("titlebar: window has no content view");
            return false;
        }
        Retained::retain(v.cast()).expect("content view")
    };

    let buttons = [
        (NSWindowButton::CloseButton, sel!(hkClose:), 0.0),
        (NSWindowButton::MiniaturizeButton, sel!(hkMiniaturize:), 1.0),
        (NSWindowButton::ZoomButton, sel!(hkZoom:), 2.0),
    ];

    let mut installed: Vec<usize> = Vec::with_capacity(3);

    for (kind, action, _slot) in buttons {
        let Some(button): Option<Retained<NSButton>> =
            NSWindow::standardWindowButton_forStyleMask(kind, mask, mtm)
        else {
            log::warn!("titlebar: AppKit returned no button for {kind:?}");
            return false;
        };

        unsafe {
            // Tauri's content view is under Auto Layout. A subview added there with
            // translatesAutoresizingMaskIntoConstraints = NO and no constraints of its
            // own gets sized to nothing, which is what collapsed these to 0x0: no hit
            // area, so the clicks died, and a sliver of artwork that read as an oval.
            button.setTranslatesAutoresizingMaskIntoConstraints(true);
            button.setAutoresizingMask(AUTORESIZE_PIN_TOP_LEFT);
            button.setTarget(Some(target));
            button.setAction(Some(action));
            // Above the webview, or the webview covers them and swallows the clicks.
            content.addSubview(&button);
        }
        installed.push(Retained::as_ptr(&button) as usize);
    }

    let _ = BUTTON_PTRS.set(installed);
    let _ = CONTENT_PTR.set(Retained::as_ptr(&content) as usize);

    // Ask the content view to announce its resizes, and relayout on each one.
    unsafe {
        content.setPostsFrameChangedNotifications(true);
        let centre = NSNotificationCenter::defaultCenter();
        centre.addObserver_selector_name_object(
            target,
            sel!(hkRelayout:),
            Some(NSViewFrameDidChangeNotification),
            Some(&*content),
        );
    }
    layout();
    raise_above_webview();

    log::info!("Native AppKit window buttons installed");
    true
}

/// Shows or hides the buttons. The overlay has no titlebar, so they only belong on
/// screen while the trainer is up.
/// Points the buttons back at this app's handlers.
///
/// Must be re-applied after every trainer transition, not just at install. Entering
/// and leaving the trainer swizzles the window's class (to_window / to_panel), and
/// AppKit re-adopts the standard buttons in the process, restoring their built-in
/// target and action. The visible symptom is the third button quietly reverting to a
/// plain zoom after one overlay -> trainer -> overlay round trip.
pub fn bind_actions() {
    let (Some(ptrs), Some(&tp)) = (BUTTON_PTRS.get(), TARGET_PTR.get()) else { return };
    raise_above_webview();
    for (i, &p) in ptrs.iter().enumerate() {
        let b: &NSView = unsafe { &*(p as *const NSView) };
        let f = b.frame();
        let hidden = b.isHidden();
        let win_null: bool = unsafe { let w: *mut AnyObject = msg_send![b, window]; w.is_null() };
        log::info!(
            "titlebar: button {i} bound: frame {:.0},{:.0} {:.0}x{:.0} hidden={hidden} inWindow={}",
            f.origin.x, f.origin.y, f.size.width, f.size.height, !win_null
        );
    }
    let target: &TitlebarTarget = unsafe { &*(tp as *const TitlebarTarget) };
    let actions = [sel!(hkClose:), sel!(hkMiniaturize:), sel!(hkZoom:)];
    for (&p, action) in ptrs.iter().zip(actions) {
        let button: &NSButton = unsafe { &*(p as *const NSButton) };
        unsafe {
            button.setTarget(Some(target));
            button.setAction(Some(action));
        }
    }
}

/// Positions the buttons against the top-left of the content view.
///
/// Driven by the content view's own frame-change notification rather than called at a
/// chosen moment. Entering the trainer resizes the window *after* apply_trainer_mode
/// returns, so any layout done from there uses the overlay's height and leaves the
/// buttons stranded partway down the window. Reacting to the resize removes the race.
pub fn layout() {
    let (Some(ptrs), Some(&cp)) = (BUTTON_PTRS.get(), CONTENT_PTR.get()) else { return };
    let content: &NSView = unsafe { &*(cp as *const NSView) };
    let height = content.frame().size.height;
    let mut x = INSET;
    for &p in ptrs {
        let button: &NSButton = unsafe { &*(p as *const NSButton) };

        // Size as well as origin. Setting only the origin could never undo a collapse,
        // so once Auto Layout had zeroed these they stayed zeroed. SIZE is the measured
        // native size (14x14, identical from both AppKit factories), so re-asserting it
        // restores rather than distorts.
        let y = height - BAR_HEIGHT + (BAR_HEIGHT - SIZE) / 2.0;
        button.setFrame(NSRect::new(NSPoint::new(x, y), NSSize::new(SIZE, SIZE)));
        x += SIZE + GAP;
    }

    use std::sync::atomic::Ordering;
    let rounded = height.round() as u64;
    if LAST_HEIGHT.swap(rounded, Ordering::Relaxed) != rounded {
        // debug: a resize drag produces a line per distinct height.
        log::debug!("titlebar: relaid out for content height {rounded}");
        for (i, &p) in ptrs.iter().enumerate() {
            let b: &NSView = unsafe { &*(p as *const NSView) };
            let f = b.frame();
            let sv: *mut AnyObject = unsafe { msg_send![b, superview] };
            let same_content = std::ptr::eq(sv as *const AnyObject, cp as *const AnyObject);
            log::debug!(
                "  button {i}: frame {:.1},{:.1} {:.1}x{:.1}  superview==contentView {same_content}",
                f.origin.x, f.origin.y, f.size.width, f.size.height
            );
        }
    }
}

pub fn set_visible(visible: bool) {
    let Some(ptrs) = BUTTON_PTRS.get() else { return };
    if visible {
        layout();
        bind_actions();
        // The height here is the overlay's: the trainer resize lands afterwards. The
        // frame-change observer is what puts the buttons right, and logs when it does.
    }
    for &p in ptrs {
        // Safe while the window lives: the content view retains these as subviews.
        let button: &NSButton = unsafe { &*(p as *const NSButton) };
        button.setHidden(!visible);
    }
}

/// Hue rotation applied to the zoom button in overlay mode, where it opens the trainer
/// rather than zooming — green reads as "maximise", and this is not that.
///
/// A standard window button's colour is drawn by AppKit and has no property to set, so
/// recolouring it by hand would mean replacing it with a hand-drawn circle and losing the
/// glass, the hover glyph and the inactive dimming — the whole reason for hosting real
/// buttons. A CIHueAdjust filter on the button's layer shifts the hue and leaves all of
/// that intact.
///
/// Green sits near 120 degrees and the system blue near 215, so the shift is ~95 degrees.
const HUE_SHIFT_GREEN_TO_BLUE: f64 = 1.658; // radians

/// Tints the zoom button blue (overlay) or restores its green (trainer).
pub fn set_zoom_tinted(tinted: bool) {
    use objc2::runtime::AnyClass;

    let Some(ptrs) = BUTTON_PTRS.get() else { return };
    let Some(&p) = ptrs.get(2) else { return };
    let button: &NSButton = unsafe { &*(p as *const NSButton) };

    unsafe {
        button.setWantsLayer(true);
        let layer: *mut AnyObject = msg_send![button, layer];
        if layer.is_null() {
            log::warn!("titlebar: zoom button has no layer; leaving it untinted");
            return;
        }

        if !tinted {
            let _: () = msg_send![layer, setFilters: std::ptr::null::<AnyObject>()];
            return;
        }

        let Some(ci) = AnyClass::get(c"CIFilter") else {
            log::warn!("titlebar: CIFilter unavailable; leaving the zoom button green");
            return;
        };
        let name = NSString::from_str("CIHueAdjust");
        let filter: *mut AnyObject = msg_send![ci, filterWithName: &*name];
        if filter.is_null() {
            log::warn!("titlebar: CIHueAdjust unavailable; leaving the zoom button green");
            return;
        }
        let _: () = msg_send![filter, setDefaults];
        let angle = NSNumber::new_f64(HUE_SHIFT_GREEN_TO_BLUE);
        let key = NSString::from_str("inputAngle");
        let _: () = msg_send![filter, setValue: &*angle, forKey: &*key];

        let obj: &AnyObject = &*filter;
        let filters = NSArray::from_slice(&[obj]);
        let _: () = msg_send![layer, setFilters: &*filters];
    }
}

/// Re-asserts the buttons as the frontmost subviews.
///
/// The webview is a sibling that fills the window, and the region the buttons occupy is
/// transparent page content — so when the webview ends up in front, the buttons are still
/// perfectly visible through it while every click lands on the page instead. On the
/// keyboard overlay that page area is the drag bar, so a click started a window drag and
/// the buttons appeared dead.
///
/// Subview order is not stable across the trainer's to_window()/to_panel() swizzle, which
/// is why this is re-applied rather than done once at install.
fn raise_above_webview() {
    let (Some(ptrs), Some(&cp)) = (BUTTON_PTRS.get(), CONTENT_PTR.get()) else { return };
    let content: &NSView = unsafe { &*(cp as *const NSView) };
    for &p in ptrs {
        let button: &NSView = unsafe { &*(p as *const NSView) };
        unsafe {
            // NSWindowAbove (1) with a nil sibling means "in front of everything".
            let _: () = msg_send![
                content,
                addSubview: button,
                positioned: 1isize,
                relativeTo: std::ptr::null::<AnyObject>()
            ];
        }
    }
}
