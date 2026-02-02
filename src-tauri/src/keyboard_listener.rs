use rdev::{listen, Event, EventType, Key};
use tauri::{AppHandle, Emitter};
use log::{info, error};
use std::sync::mpsc::channel;
use std::thread;

pub fn start_listener(app_handle: AppHandle) {
    info!("Starting keyboard listener thread");

    let (tx, rx) = channel::<Event>();

    // Spawn listener thread
    thread::spawn(move || {
        if let Err(error) = listen(move |event| {
            if let Err(e) = tx.send(event) {
                error!("Failed to send event: {:?}", e);
            }
        }) {
            error!("Listener error: {:?}", error);
        }
    });

    // Process events in main thread
    thread::spawn(move || {
        for event in rx {
            match event.event_type {
                EventType::KeyPress(key) => {
                    let key_code = format_key_code(key);
                    info!("Key pressed: {}", key_code);

                    if let Err(e) = app_handle.emit("key-pressed", key_code) {
                        error!("Failed to emit key-pressed: {:?}", e);
                    }
                }
                EventType::KeyRelease(key) => {
                    let key_code = format_key_code(key);
                    info!("Key released: {}", key_code);

                    if let Err(e) = app_handle.emit("key-released", key_code) {
                        error!("Failed to emit key-released: {:?}", e);
                    }
                }
                _ => {}
            }
        }
    });
}

fn format_key_code(key: Key) -> String {
    match key {
        Key::KeyA => "KeyA".to_string(),
        Key::KeyB => "KeyB".to_string(),
        Key::KeyC => "KeyC".to_string(),
        Key::KeyD => "KeyD".to_string(),
        Key::KeyE => "KeyE".to_string(),
        Key::KeyF => "KeyF".to_string(),
        Key::KeyG => "KeyG".to_string(),
        Key::KeyH => "KeyH".to_string(),
        Key::KeyI => "KeyI".to_string(),
        Key::KeyJ => "KeyJ".to_string(),
        Key::KeyK => "KeyK".to_string(),
        Key::KeyL => "KeyL".to_string(),
        Key::KeyM => "KeyM".to_string(),
        Key::KeyN => "KeyN".to_string(),
        Key::KeyO => "KeyO".to_string(),
        Key::KeyP => "KeyP".to_string(),
        Key::KeyQ => "KeyQ".to_string(),
        Key::KeyR => "KeyR".to_string(),
        Key::KeyS => "KeyS".to_string(),
        Key::KeyT => "KeyT".to_string(),
        Key::KeyU => "KeyU".to_string(),
        Key::KeyV => "KeyV".to_string(),
        Key::KeyW => "KeyW".to_string(),
        Key::KeyX => "KeyX".to_string(),
        Key::KeyY => "KeyY".to_string(),
        Key::KeyZ => "KeyZ".to_string(),
        Key::Num0 => "Digit0".to_string(),
        Key::Num1 => "Digit1".to_string(),
        Key::Num2 => "Digit2".to_string(),
        Key::Num3 => "Digit3".to_string(),
        Key::Num4 => "Digit4".to_string(),
        Key::Num5 => "Digit5".to_string(),
        Key::Num6 => "Digit6".to_string(),
        Key::Num7 => "Digit7".to_string(),
        Key::Num8 => "Digit8".to_string(),
        Key::Num9 => "Digit9".to_string(),
        Key::Space => "Space".to_string(),
        Key::Escape => "Escape".to_string(),
        Key::Backspace => "Backspace".to_string(),
        Key::Tab => "Tab".to_string(),
        Key::Return => "Enter".to_string(),
        Key::ShiftLeft => "ShiftLeft".to_string(),
        Key::ShiftRight => "ShiftRight".to_string(),
        _ => format!("{:?}", key),
    }
}
