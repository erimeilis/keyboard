#![allow(unexpected_cfgs)]

mod keyboard_listener;
mod key_simulator;
mod simulate_flag;

#[cfg(target_os = "macos")]
mod layout_detector_macos;

use log::{info, warn};
use tauri::{Manager, RunEvent};
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
#[tauri::command]
fn set_trainer_mode(app: tauri::AppHandle, active: bool) {
    #[cfg(target_os = "macos")]
    {
        if active {
            // If currently the non-activating panel, convert it back to a plain window so it
            // becomes eligible to take key-window / keyboard focus.
            if let Ok(panel) = app.get_webview_panel("main") {
                let _ = panel.to_window();
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
                let _ = window.set_focus();
            }
        } else {
            // If currently a plain window (trainer mode was on), convert it back into the
            // non-activating overlay panel. Guarded so a repeated `false` call doesn't
            // re-swizzle an already-non-activating panel (which would corrupt the class it
            // records as "original" to restore to on the next `to_window()` call).
            if app.get_webview_panel("main").is_err() {
                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(panel) = window.to_panel::<KeyboardPanel>() {
                        panel.set_style_mask(StyleMask::empty().nonactivating_panel().into());
                        panel.set_hides_on_deactivate(false);
                        panel.set_becomes_key_only_if_needed(true);
                        panel.order_front_regardless();
                    }
                }
            }
            let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
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
              // Set the NonactivatingPanel style mask bit so macOS knows
              // mouse events on this panel should not trigger app activation.
              panel.set_style_mask(StyleMask::empty().nonactivating_panel().into());
              panel.set_hides_on_deactivate(false);
              panel.set_becomes_key_only_if_needed(true);
              info!("Window converted to NSPanel (non-activating, accessory policy)");
              panel.order_front_regardless();
          }
      }

      // Set up menu bar tray icon (no dock icon due to Accessory policy)
      let show_hide = MenuItemBuilder::with_id("show_hide", "Show/Hide Keyboard").build(app)?;
      let quit = MenuItemBuilder::with_id("quit", "Quit Hebrew Keyboard").build(app)?;
      let tray_menu = MenuBuilder::new(app)
          .item(&show_hide)
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
