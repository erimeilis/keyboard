mod keyboard_listener;

#[cfg(target_os = "macos")]
mod layout_detector_macos;

use log::info;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  env_logger::init();

  tauri::Builder::default()
    .setup(|app| {
      info!("Application started");

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let handle = app.handle().clone();
      keyboard_listener::start_listener(handle);

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![get_active_keyboard_layout])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
