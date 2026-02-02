mod keyboard_listener;

use log::info;

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
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
