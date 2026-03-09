use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{
    Manager,
    tray::{TrayIconBuilder, TrayIconEvent, MouseButtonState},
    WindowEvent,
};
use tauri_plugin_positioner::{WindowExt, Position};
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_positioner::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(12.0))
                .expect("apply_vibrancy falhou");

            // Guarda o momento em que a janela foi aberta
            let last_opened: Arc<Mutex<Option<Instant>>> = Arc::new(Mutex::new(None));
            let last_opened_clone = last_opened.clone();

            let win_clone = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::Focused(false) = event {
                    // Só fecha se já passou tempo suficiente desde que foi aberta
                    let should_hide = last_opened_clone
                        .lock()
                        .unwrap()
                        .map(|t| t.elapsed() > Duration::from_millis(200))
                        .unwrap_or(true);

                    if should_hide {
                        win_clone.hide().unwrap();
                    }
                }
            });

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .on_tray_icon_event(move |tray, event| {
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);

                    // Só reage ao soltar o botão (MouseUp), não ao pressionar
                    if let TrayIconEvent::Click { button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        let window = app.get_webview_window("main").unwrap();

                        if window.is_visible().unwrap() {
                            window.hide().unwrap();
                        } else {
                            *last_opened.lock().unwrap() = Some(Instant::now());
                            let _ = window.move_window(Position::TrayCenter);
                            window.show().unwrap();
                            window.set_focus().unwrap();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}