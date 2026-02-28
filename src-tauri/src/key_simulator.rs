use log::{info, error};
use std::thread;
use std::time::Duration;
use crate::simulate_flag;

#[cfg(target_os = "macos")]
use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation, CGKeyCode};
#[cfg(target_os = "macos")]
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
#[cfg(target_os = "macos")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
}

#[cfg(target_os = "macos")]
fn get_frontmost_pid() -> Option<i32> {
    use std::process::Command;
    let output = Command::new("osascript")
        .args(["-e", "tell application \"System Events\" to get unix id of first application process whose frontmost is true"])
        .output()
        .ok()?;
    let pid_str = String::from_utf8_lossy(&output.stdout);
    pid_str.trim().parse::<i32>().ok()
}

/// Marker value we set on simulated events so our rdev listener can ignore them.
#[cfg(target_os = "macos")]
const SIMULATED_EVENT_MARKER: i64 = 0x4B42_4F56; // "KBOV"

/// Maps web-style key code strings to macOS virtual keycodes.
/// See: https://developer.apple.com/documentation/coregraphics/cgkeycode
fn keycode_from_string(key_code: &str) -> Option<CGKeyCode> {
    match key_code {
        // Letters (ANSI layout virtual keycodes)
        "KeyA" => Some(0x00),
        "KeyS" => Some(0x01),
        "KeyD" => Some(0x02),
        "KeyF" => Some(0x03),
        "KeyH" => Some(0x04),
        "KeyG" => Some(0x05),
        "KeyZ" => Some(0x06),
        "KeyX" => Some(0x07),
        "KeyC" => Some(0x08),
        "KeyV" => Some(0x09),
        "KeyB" => Some(0x0B),
        "KeyQ" => Some(0x0C),
        "KeyW" => Some(0x0D),
        "KeyE" => Some(0x0E),
        "KeyR" => Some(0x0F),
        "KeyY" => Some(0x10),
        "KeyT" => Some(0x11),
        "KeyO" => Some(0x1F),
        "KeyU" => Some(0x20),
        "KeyI" => Some(0x22),
        "KeyP" => Some(0x23),
        "KeyL" => Some(0x25),
        "KeyJ" => Some(0x26),
        "KeyK" => Some(0x28),
        "KeyN" => Some(0x2D),
        "KeyM" => Some(0x2E),

        // Numbers
        "Digit1" => Some(0x12),
        "Digit2" => Some(0x13),
        "Digit3" => Some(0x14),
        "Digit4" => Some(0x15),
        "Digit5" => Some(0x17),
        "Digit6" => Some(0x16),
        "Digit7" => Some(0x1A),
        "Digit8" => Some(0x1C),
        "Digit9" => Some(0x19),
        "Digit0" => Some(0x1D),

        // Special keys
        "Space" => Some(0x31),
        "Escape" => Some(0x35),
        "Backspace" => Some(0x33),
        "Tab" => Some(0x30),
        "Enter" => Some(0x24),
        "CapsLock" => Some(0x39),

        // Modifiers
        "ShiftLeft" => Some(0x38),
        "ShiftRight" => Some(0x3C),
        "ControlLeft" => Some(0x3B),
        "ControlRight" => Some(0x3E),
        "Alt" => Some(0x3A),        // Left Option
        "MetaLeft" => Some(0x37),
        "MetaRight" => Some(0x36),

        // Punctuation
        "Minus" => Some(0x1B),
        "Equal" => Some(0x18),
        "BracketLeft" => Some(0x21),
        "BracketRight" => Some(0x1E),
        "Backslash" => Some(0x2A),
        "Semicolon" => Some(0x29),
        "Quote" => Some(0x27),
        "Comma" => Some(0x2B),
        "Period" => Some(0x2F),
        "Slash" => Some(0x2C),
        "Backquote" => Some(0x32),

        // Arrow keys
        "ArrowUp" => Some(0x7E),
        "ArrowDown" => Some(0x7D),
        "ArrowLeft" => Some(0x7B),
        "ArrowRight" => Some(0x7C),

        _ => None,
    }
}

/// Returns the CGEventFlags for a modifier key code
fn modifier_flag(key_code: &str) -> CGEventFlags {
    match key_code {
        "ShiftLeft" | "ShiftRight" => CGEventFlags::CGEventFlagShift,
        "ControlLeft" | "ControlRight" => CGEventFlags::CGEventFlagControl,
        "Alt" => CGEventFlags::CGEventFlagAlternate,
        "MetaLeft" | "MetaRight" => CGEventFlags::CGEventFlagCommand,
        _ => CGEventFlags::empty(),
    }
}

#[cfg(target_os = "macos")]
fn post_key_event(source: &CGEventSource, keycode: CGKeyCode, key_down: bool, flags: CGEventFlags, target_pid: Option<i32>) {
    match CGEvent::new_keyboard_event(source.clone(), keycode, key_down) {
        Ok(event) => {
            if !flags.is_empty() {
                event.set_flags(flags);
            }
            // Tag the event so our rdev listener can identify and skip it
            event.set_integer_value_field(
                core_graphics::event::EventField::EVENT_SOURCE_USER_DATA,
                SIMULATED_EVENT_MARKER,
            );
            if let Some(pid) = target_pid {
                // Post directly to the target process
                event.post_to_pid(pid);
            } else {
                // Fallback: post to session
                event.post(CGEventTapLocation::Session);
            }
        }
        Err(()) => {
            error!("Failed to create CGEvent for keycode {}", keycode);
        }
    }
}

#[tauri::command]
pub fn simulate_key(key_code: String, modifiers: Vec<String>) {
    info!("simulate_key: {} with modifiers: {:?}", key_code, modifiers);

    let target_keycode = match keycode_from_string(&key_code) {
        Some(k) => k,
        None => {
            error!("Unknown key code: {}", key_code);
            return;
        }
    };

    #[cfg(target_os = "macos")]
    {
        let target_pid = get_frontmost_pid();
        info!("Target PID: {:?}, AXIsProcessTrusted: {}", target_pid, unsafe { AXIsProcessTrusted() });

        let source = match CGEventSource::new(CGEventSourceStateID::CombinedSessionState) {
            Ok(s) => s,
            Err(()) => {
                error!("Failed to create CGEventSource");
                return;
            }
        };

        // Tell the keyboard listener to ignore events while we simulate
        simulate_flag::set_simulating(true);

        // Build modifier flags
        let mut flags = CGEventFlags::empty();
        for m in &modifiers {
            flags |= modifier_flag(m);
        }

        // Press modifier keys
        for m in &modifiers {
            if let Some(kc) = keycode_from_string(m) {
                post_key_event(&source, kc, true, modifier_flag(m), target_pid);
                thread::sleep(Duration::from_millis(5));
            }
        }

        // Press and release the target key
        post_key_event(&source, target_keycode, true, flags, target_pid);
        thread::sleep(Duration::from_millis(5));
        post_key_event(&source, target_keycode, false, flags, target_pid);

        // Release modifier keys (reverse order)
        for m in modifiers.iter().rev() {
            if let Some(kc) = keycode_from_string(m) {
                thread::sleep(Duration::from_millis(5));
                post_key_event(&source, kc, false, CGEventFlags::empty(), target_pid);
            }
        }

        thread::sleep(Duration::from_millis(10));
        simulate_flag::set_simulating(false);
    }

    #[cfg(not(target_os = "macos"))]
    {
        error!("Key simulation not implemented on this platform");
    }
}
