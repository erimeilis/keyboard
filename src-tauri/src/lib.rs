#![allow(unexpected_cfgs)]

mod keyboard_listener;
mod key_simulator;
mod simulate_flag;

#[cfg(target_os = "macos")]
mod layout_detector_macos;

use log::{error, info, warn};
use tauri::{Emitter, Manager, RunEvent};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;

#[cfg(target_os = "macos")]
use tauri_nspanel::{tauri_panel, ManagerExt, StyleMask, WebviewWindowExt};

// Define a non-activating panel class: can't become key window, floats above other windows
#[cfg(target_os = "macos")]
tauri_panel! {
    panel!(KeyboardPanel {
        config: {
            can_become_key_window: false,
            is_floating_panel: true
        }
    })
}

#[tauri::command]
fn get_active_keyboard_layout() -> String {
    #[cfg(target_os = "macos")]
    {
        layout_detector_macos::get_active_keyboard_layout()
    }

    #[cfg(not(target_os = "macos"))]
    {
        "com.apple.keylayout.US".to_string() // Fallback for non-macOS
    }
}

/// Applies the exact non-activating overlay configuration to a `main`-window panel: sets the
/// `NonactivatingPanel` style-mask bit (so mouse clicks on the panel don't activate the app),
/// keeps it visible when the app deactivates, only lets it become key when strictly needed, and
/// orders it to the front. Shared by `setup()`'s initial conversion and `set_trainer_mode`'s
/// revert so the two conversion sites can never drift out of sync.
#[cfg(target_os = "macos")]
fn configure_nonactivating_panel<R: tauri::Runtime>(panel: &tauri_nspanel::PanelHandle<R>) {
    panel.set_style_mask(StyleMask::empty().nonactivating_panel().into());
    panel.set_hides_on_deactivate(false);
    panel.set_becomes_key_only_if_needed(true);
    panel.order_front_regardless();
}

/// Performs the trainer-mode window/panel transition. MUST be invoked on the main thread (see
/// `set_trainer_mode`), because the `to_window()` / `to_panel()` conversions swizzle the window's
/// AppKit class (`object_setClass`) and send AppKit messages, none of which tauri-nspanel
/// dispatches to the main thread itself.
///
/// Revert correctness (idempotent across repeated activate/deactivate cycles): the nspanel
/// `Store` is the crate's own source of truth for "is `main` currently a panel". `to_panel()`
/// inserts the label into that store; `to_window()` removes it (it calls `remove_webview_panel`
/// before swizzling the class back). So a successful `get_webview_panel("main")` reliably means
/// the window is *already* a panel, and an error means it is *already* a plain window. We only
/// convert in the direction that is needed, which prevents re-running `from_window` on an
/// already-swizzled panel (that would capture the panel's own class as `original_class` and
/// corrupt the next `to_window()` restore).
#[cfg(target_os = "macos")]
fn apply_trainer_mode(app: &tauri::AppHandle, active: bool) {
    if active {
        // Convert the non-activating panel back into a plain, focusable window so it can take
        // key-window / keyboard focus. Convert only when `main` is currently a panel.
        match app.get_webview_panel("main") {
            Ok(panel) => {
                if panel.to_window().is_none() {
                    warn!(
                        "set_trainer_mode(true): to_window() returned None; 'main' was not in the \
                         nspanel store, so it may not have been made focusable"
                    );
                }
            }
            Err(_) => {
                info!("set_trainer_mode(true): 'main' is already a plain window; skipping to_window()");
            }
        }
        match app.get_webview_window("main") {
            Some(window) => {
                if let Err(e) = app.set_activation_policy(tauri::ActivationPolicy::Regular) {
                    error!("set_trainer_mode(true): failed to set Regular activation policy: {e}");
                }
                // Become a normal ("common") application window rather than the floating overlay:
                // drop always-on-top (Dock is handled by the Regular activation policy above).
                // NOTE: we deliberately do NOT toggle window decorations at runtime — set_decorations
                // changes the NSWindow styleMask, which throws an uncaught NSException on this
                // transparent / NSPanel-swizzled window and aborts the process. The trainer draws
                // its own in-window title strip instead (see trainer.css .trainer-titlebar).
                if let Err(e) = window.set_always_on_top(false) {
                    warn!("set_trainer_mode(true): failed to clear always-on-top: {e}");
                }
                if let Err(e) = window.set_focus() {
                    error!("set_trainer_mode(true): failed to focus 'main' window: {e}");
                }
            }
            None => {
                error!("set_trainer_mode(true): no webview window labelled 'main'; cannot focus");
            }
        }
    } else {
        // Restore the overlay chrome FIRST, while `main` is still a plain window. Toggling
        // decorations / window level on the NSPanel form throws an uncaught NSException that
        // aborts the process (this crashed on trainer exit), so it MUST happen before to_panel().
        // Guarded on "is currently a plain window" so a double-deactivate never touches the panel.
        if app.get_webview_panel("main").is_err() {
            if let Some(window) = app.get_webview_window("main") {
                // Only restore the window level here — do NOT toggle decorations (styleMask),
                // which throws an NSException on this transparent/NSPanel window (crashed on exit).
                if let Err(e) = window.set_always_on_top(true) {
                    warn!("set_trainer_mode(false): failed to restore always-on-top: {e}");
                }
            }
        }
        // Now revert to the non-activating overlay panel. Convert only when `main` is currently a
        // plain window (see the idempotency note above): re-converting an existing panel would
        // corrupt the recorded original class and break the next activate.
        match app.get_webview_panel("main") {
            Ok(_) => {
                info!("set_trainer_mode(false): 'main' is already a panel; skipping re-conversion");
            }
            Err(_) => match app.get_webview_window("main") {
                Some(window) => match window.to_panel::<KeyboardPanel>() {
                    Ok(panel) => configure_nonactivating_panel(&panel),
                    Err(e) => error!(
                        "set_trainer_mode(false): failed to convert 'main' window to KeyboardPanel: {e}"
                    ),
                },
                None => error!(
                    "set_trainer_mode(false): no webview window labelled 'main'; cannot revert to overlay panel"
                ),
            },
        }
        if let Err(e) = app.set_activation_policy(tauri::ActivationPolicy::Accessory) {
            error!("set_trainer_mode(false): failed to set Accessory activation policy: {e}");
        }
    }
}

/// Toggles the window between the non-activating `KeyboardPanel` overlay and a regular,
/// focusable window, so the trainer's DOM-focus capture source can receive keystrokes in a
/// focused webview `<input>` instead of them leaking through to whatever app was frontmost.
///
/// `KeyboardPanel` (see `tauri_panel!` above) bakes `can_become_key_window: false` into its
/// Objective-C class at *compile* time — `tauri-nspanel` has no runtime setter for that flag
/// (only a handful of properties like `hides_on_deactivate` can be flipped after the panel is
/// created), so simply changing the activation policy and calling `set_focus()` on the panel
/// itself would never make it key window and would silently do nothing. Instead this round-trips
/// the window through `Panel::to_window()` / `WebviewWindowExt::to_panel()` — swapping the
/// window's underlying Objective-C class between the panel subclass and its original, focusable
/// window class — which is the mechanism `tauri-nspanel` itself provides for this exact purpose.
///
/// The actual conversion runs inside `run_on_main_thread`: `#[tauri::command]` handlers are not
/// guaranteed to run on the main thread, but the `object_setClass` swizzling and AppKit messages
/// in `to_window()`/`to_panel()` must. tauri-nspanel performs no internal main-thread dispatch —
/// its own SAFETY note (panel.rs) states the caller "must ensure actual panel operations happen
/// on the main thread". Wrapping the whole sequence in a single closure also keeps the swizzle,
/// activation-policy change and focus/order calls correctly ordered.
#[tauri::command]
fn set_trainer_mode(app: tauri::AppHandle, active: bool) {
    #[cfg(target_os = "macos")]
    {
        let app_for_main = app.clone();
        if let Err(e) = app.run_on_main_thread(move || {
            apply_trainer_mode(&app_for_main, active);
        }) {
            error!("set_trainer_mode({active}): failed to dispatch onto the main thread: {e}");
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, active);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
    )
    .plugin(tauri_nspanel::init())
    .setup(|app| {
      info!("Application started");

      // Check Accessibility permission at startup
      #[cfg(target_os = "macos")]
      {
          extern "C" { fn AXIsProcessTrusted() -> bool; }
          let trusted = unsafe { AXIsProcessTrusted() };
          if trusted {
              info!("Accessibility permission: GRANTED");
          } else {
              warn!("Accessibility permission: DENIED — keyboard listening and typing will NOT work!");
              warn!("Grant access in System Settings > Privacy & Security > Accessibility");
              // Prompt the system dialog
              extern "C" {
                  fn AXIsProcessTrustedWithOptions(options: *const std::ffi::c_void) -> bool;
              }
              use core_foundation::base::TCFType;
              use core_foundation::boolean::CFBoolean;
              use core_foundation::string::CFString;
              use core_foundation::dictionary::CFDictionary;
              let key = CFString::new("AXTrustedCheckOptionPrompt");
              let value = CFBoolean::true_value();
              let options = CFDictionary::from_CFType_pairs(&[(key.clone(), value.clone())]);
              unsafe { AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef() as *const _); }
          }
      }

      // Accessory policy: no dock icon, won't steal focus. Required for
      // stable NSPanel operation. A menu bar status item provides app control.
      #[cfg(target_os = "macos")]
      app.set_activation_policy(tauri::ActivationPolicy::Accessory);

      let handle = app.handle().clone();
      keyboard_listener::start_listener(handle);

      // Convert the window to a non-activating NSPanel
      #[cfg(target_os = "macos")]
      {
          if let Some(window) = app.get_webview_window("main") {
              let panel = window.to_panel::<KeyboardPanel>().unwrap();
              // Apply the non-activating overlay configuration (shared with the
              // set_trainer_mode revert path so the two conversion sites stay in sync).
              configure_nonactivating_panel(&panel);
              info!("Window converted to NSPanel (non-activating, accessory policy)");
          }
      }

      // Set up menu bar tray icon (no dock icon due to Accessory policy)
      let show_hide = MenuItemBuilder::with_id("show_hide", "Show/Hide Keyboard").build(app)?;
      let trainer = MenuItemBuilder::with_id("trainer", "Typing Trainer").build(app)?;
      let quit = MenuItemBuilder::with_id("quit", "Quit Hebrew Keyboard").build(app)?;
      let tray_menu = MenuBuilder::new(app)
          .item(&show_hide)
          .item(&trainer)
          .separator()
          .item(&quit)
          .build()?;

      let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))
          .expect("Failed to load tray icon");

      TrayIconBuilder::new()
          .icon(tray_icon)
          .icon_as_template(false)
          .tooltip("Hebrew Keyboard")
          .menu(&tray_menu)
          .show_menu_on_left_click(true)
          .on_menu_event(|app_handle: &tauri::AppHandle, event: tauri::menu::MenuEvent| {
              match event.id().as_ref() {
                  "show_hide" => {
                      if let Some(window) = app_handle.get_webview_window("main") {
                          if window.is_visible().unwrap_or(false) {
                              let _ = window.hide();
                          } else {
                              let _ = window.show();
                          }
                      }
                  }
                  "trainer" => {
                      // Ensure the window is visible, then let the frontend toggle trainer mode
                      // (which invokes set_trainer_mode to transform the window).
                      if let Some(window) = app_handle.get_webview_window("main") {
                          let _ = window.show();
                      }
                      if let Err(e) = app_handle.emit("toggle-trainer", ()) {
                          error!("Failed to emit toggle-trainer event: {:?}", e);
                      }
                  }
                  "quit" => {
                      app_handle.exit(0);
                  }
                  _ => {}
              }
          })
          .build(app)?;
      info!("Tray icon configured");

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![get_active_keyboard_layout, key_simulator::simulate_key, set_trainer_mode])
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|app_handle, event| {
    if let RunEvent::Reopen { has_visible_windows, .. } = event {
      if !has_visible_windows {
        if let Some(window) = app_handle.get_webview_window("main") {
          let _ = window.show();
          let _ = window.set_focus();
        }
      }
    }
  });
}
