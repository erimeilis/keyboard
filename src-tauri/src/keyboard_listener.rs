use tauri::{AppHandle, Emitter};
use log::{info, error};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use std::collections::HashMap;

#[cfg(target_os = "macos")]
mod cg_tap {
    use std::sync::mpsc;
    use std::os::raw::c_void;
    use log::{info, error};

    // Raw CoreGraphics FFI for CGEventTap
    type CGEventRef = *mut c_void;
    type CGEventTapProxy = *mut c_void;
    type CFMachPortRef = *mut c_void;
    type CFRunLoopSourceRef = *mut c_void;
    type CFRunLoopRef = *mut c_void;
    type CFStringRef = *const c_void;
    type CFAllocatorRef = *const c_void;
    type CFIndex = i64;
    type CGEventMask = u64;
    type CGEventType = u32;

    const KCG_SESSION_EVENT_TAP: u32 = 1;
    const KCG_HEAD_INSERT_EVENT_TAP: u32 = 0;
    const KCG_EVENT_TAP_OPTION_LISTEN_ONLY: u32 = 1;
    const KCG_EVENT_KEY_DOWN: u32 = 10;
    const KCG_EVENT_KEY_UP: u32 = 11;
    const KCG_EVENT_FLAGS_CHANGED: u32 = 12;

    // CGEventField for keycode
    const KCG_KEYBOARD_EVENT_KEYCODE: u32 = 9;
    // CGEventField for user data
    const KCG_EVENT_SOURCE_USER_DATA: u32 = 42;

    // CGEventFlags
    const KCG_EVENT_FLAG_SHIFT: u64 = 0x00020000;
    const KCG_EVENT_FLAG_CONTROL: u64 = 0x00040000;
    const KCG_EVENT_FLAG_ALTERNATE: u64 = 0x00080000;
    const KCG_EVENT_FLAG_COMMAND: u64 = 0x00100000;
    const KCG_EVENT_FLAG_ALPHA_SHIFT: u64 = 0x00010000;

    type CGEventTapCallBack = unsafe extern "C" fn(
        proxy: CGEventTapProxy,
        event_type: CGEventType,
        event: CGEventRef,
        user_info: *mut c_void,
    ) -> CGEventRef;

    extern "C" {
        fn CGEventTapCreate(
            tap: u32,
            place: u32,
            options: u32,
            events_of_interest: CGEventMask,
            callback: CGEventTapCallBack,
            user_info: *mut c_void,
        ) -> CFMachPortRef;
        fn CFMachPortCreateRunLoopSource(
            allocator: CFAllocatorRef,
            port: CFMachPortRef,
            order: CFIndex,
        ) -> CFRunLoopSourceRef;
        fn CFRunLoopGetCurrent() -> CFRunLoopRef;
        fn CFRunLoopAddSource(rl: CFRunLoopRef, source: CFRunLoopSourceRef, mode: CFStringRef);
        fn CGEventTapEnable(tap: CFMachPortRef, enable: bool);
        fn CFRunLoopRun();
        fn CGEventGetIntegerValueField(event: CGEventRef, field: u32) -> i64;
        fn CGEventGetFlags(event: CGEventRef) -> u64;

        static kCFRunLoopCommonModes: CFStringRef;
        static kCFAllocatorDefault: CFAllocatorRef;
    }

    unsafe extern "C" fn tap_callback(
        _proxy: CGEventTapProxy,
        event_type: CGEventType,
        event: CGEventRef,
        user_info: *mut c_void,
    ) -> CGEventRef {
        // Skip our own simulated events
        let user_data = CGEventGetIntegerValueField(event, KCG_EVENT_SOURCE_USER_DATA);
        if user_data == 0x4B42_4F56 {
            return event;
        }

        let keycode = CGEventGetIntegerValueField(event, KCG_KEYBOARD_EVENT_KEYCODE) as u16;
        let is_press = match event_type {
            KCG_EVENT_KEY_DOWN => true,
            KCG_EVENT_KEY_UP => false,
            KCG_EVENT_FLAGS_CHANGED => {
                let flags = CGEventGetFlags(event);
                match keycode {
                    0x38 | 0x3C => (flags & KCG_EVENT_FLAG_SHIFT) != 0,
                    0x3B | 0x3E => (flags & KCG_EVENT_FLAG_CONTROL) != 0,
                    0x3A | 0x3D => (flags & KCG_EVENT_FLAG_ALTERNATE) != 0,
                    0x37 | 0x36 => (flags & KCG_EVENT_FLAG_COMMAND) != 0,
                    0x39 => (flags & KCG_EVENT_FLAG_ALPHA_SHIFT) != 0,
                    _ => false,
                }
            }
            _ => return event,
        };

        let tx = &*(user_info as *const mpsc::Sender<(u16, bool)>);
        let _ = tx.send((keycode, is_press));
        event // ListenOnly — return event unmodified
    }

    pub fn start_event_tap(tx: mpsc::Sender<(u16, bool)>) -> bool {
        let mask: CGEventMask = (1 << KCG_EVENT_KEY_DOWN)
            | (1 << KCG_EVENT_KEY_UP)
            | (1 << KCG_EVENT_FLAGS_CHANGED);

        let tx_box = Box::new(tx);
        let tx_ptr = Box::into_raw(tx_box) as *mut c_void;

        unsafe {
            let tap = CGEventTapCreate(
                KCG_SESSION_EVENT_TAP,
                KCG_HEAD_INSERT_EVENT_TAP,
                KCG_EVENT_TAP_OPTION_LISTEN_ONLY,
                mask,
                tap_callback,
                tx_ptr,
            );

            if tap.is_null() {
                error!("CGEventTapCreate returned null — Accessibility permission missing");
                let _ = Box::from_raw(tx_ptr as *mut mpsc::Sender<(u16, bool)>);
                return false;
            }

            let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0);
            if source.is_null() {
                error!("CFMachPortCreateRunLoopSource returned null");
                let _ = Box::from_raw(tx_ptr as *mut mpsc::Sender<(u16, bool)>);
                return false;
            }

            let run_loop = CFRunLoopGetCurrent();
            CFRunLoopAddSource(run_loop, source, kCFRunLoopCommonModes);
            CGEventTapEnable(tap, true);
            info!("CGEventTap created and running");
            CFRunLoopRun(); // blocks forever
            true
        }
    }
}

pub fn start_listener(app_handle: AppHandle) {
    info!("Starting keyboard listener thread");

    let last_emit = Arc::new(Mutex::new(Instant::now()));
    let pressed_keys = Arc::new(Mutex::new(HashMap::<String, bool>::new()));

    let (tx, rx) = mpsc::channel::<(u16, bool)>();

    #[cfg(target_os = "macos")]
    {
        thread::Builder::new()
            .name("cg-event-tap".to_string())
            .spawn(move || {
                info!("CGEventTap listener thread started");
                if !cg_tap::start_event_tap(tx) {
                    error!("CGEventTap failed to start");
                }
            })
            .expect("Failed to spawn event tap thread");
    }

    #[cfg(not(target_os = "macos"))]
    {
        warn!("Keyboard listening not implemented on this platform");
    }

    let app_clone = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(1000)).await;
        info!("Event processor ready");

        while let Ok((keycode, is_press)) = rx.recv() {
            let code = keycode_to_string(keycode);

            {
                let mut keys = pressed_keys.lock().unwrap();
                if is_press {
                    keys.insert(code.clone(), true);
                } else {
                    keys.remove(&code);
                }
            }

            {
                let mut last = last_emit.lock().unwrap();
                let now = Instant::now();
                if now.duration_since(*last) >= Duration::from_millis(16) {
                    let pressed: Vec<String> = {
                        let keys = pressed_keys.lock().unwrap();
                        keys.keys().cloned().collect()
                    };
                    if let Err(e) = app_clone.emit("keyboard-state", pressed) {
                        error!("Failed to emit keyboard state: {:?}", e);
                    }
                    *last = now;
                }
            }
        }
        info!("Event processing loop ended");
    });
}

fn keycode_to_string(keycode: u16) -> String {
    match keycode {
        0x00 => "KeyA", 0x01 => "KeyS", 0x02 => "KeyD", 0x03 => "KeyF",
        0x04 => "KeyH", 0x05 => "KeyG", 0x06 => "KeyZ", 0x07 => "KeyX",
        0x08 => "KeyC", 0x09 => "KeyV", 0x0B => "KeyB", 0x0C => "KeyQ",
        0x0D => "KeyW", 0x0E => "KeyE", 0x0F => "KeyR", 0x10 => "KeyY",
        0x11 => "KeyT", 0x1F => "KeyO", 0x20 => "KeyU", 0x22 => "KeyI",
        0x23 => "KeyP", 0x25 => "KeyL", 0x26 => "KeyJ", 0x28 => "KeyK",
        0x2D => "KeyN", 0x2E => "KeyM",
        0x12 => "Digit1", 0x13 => "Digit2", 0x14 => "Digit3",
        0x15 => "Digit4", 0x16 => "Digit6", 0x17 => "Digit5",
        0x1A => "Digit7", 0x1C => "Digit8", 0x19 => "Digit9", 0x1D => "Digit0",
        0x31 => "Space", 0x35 => "Escape", 0x33 => "Backspace",
        0x30 => "Tab", 0x24 => "Enter", 0x39 => "CapsLock",
        0x38 => "ShiftLeft", 0x3C => "ShiftRight",
        0x3B => "ControlLeft", 0x3E => "ControlRight",
        0x3A => "Alt", 0x37 => "MetaLeft", 0x36 => "MetaRight",
        0x1B => "Minus", 0x18 => "Equal",
        0x21 => "BracketLeft", 0x1E => "BracketRight",
        0x2A => "Backslash", 0x29 => "Semicolon",
        0x27 => "Quote", 0x2B => "Comma",
        0x2F => "Period", 0x2C => "Slash", 0x32 => "Backquote",
        0x7E => "ArrowUp", 0x7D => "ArrowDown",
        0x7B => "ArrowLeft", 0x7C => "ArrowRight",
        _ => return format!("Unknown(0x{:02X})", keycode),
    }.to_string()
}
