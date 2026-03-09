use base64::{engine::general_purpose, Engine};
use image::{ImageFormat, ImageReader};
use std::io::Cursor;
use tauri::{
    Manager,
    command,
    tray::{TrayIconBuilder, TrayIconEvent, MouseButtonState},
};
use tauri_plugin_positioner::{WindowExt, Position};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

#[command]
fn convert_image(base64_data: String, target_format: String) -> Result<String, String> {
    let base64_clean = base64_data
        .split(',')
        .nth(1)
        .ok_or("Formato de imagem inválido")?;

    let bytes = general_purpose::STANDARD
        .decode(base64_clean)
        .map_err(|e| format!("Erro ao decodificar base64: {e}"))?;

    let img = ImageReader::new(Cursor::new(&bytes))
        .with_guessed_format()
        .map_err(|e| format!("Erro ao ler imagem: {e}"))?
        .decode()
        .map_err(|e| format!("Erro ao decodificar imagem: {e}"))?;

    let format = match target_format.to_uppercase().as_str() {
        "PNG"        => ImageFormat::Png,
        "JPG"| "JPEG"=> ImageFormat::Jpeg,
        "WEBP"       => ImageFormat::WebP,
        "BMP"        => ImageFormat::Bmp,
        "TIFF"       => ImageFormat::Tiff,
        "ICO"        => ImageFormat::Ico,
        "GIF"        => ImageFormat::Gif,
        "AVIF"       => ImageFormat::Avif,
        _ => return Err(format!("Formato não suportado: {target_format}")),
    };

    let mime = match target_format.to_uppercase().as_str() {
        "PNG"        => "image/png",
        "JPG"| "JPEG"=> "image/jpeg",
        "WEBP"       => "image/webp",
        "BMP"        => "image/bmp",
        "TIFF"       => "image/tiff",
        "ICO"        => "image/x-icon",
        "GIF"        => "image/gif",
        "AVIF"       => "image/avif",
        _            => "image/png",
    };

    let mut output = Cursor::new(Vec::new());
    img.write_to(&mut output, format)
        .map_err(|e| format!("Erro ao converter: {e}"))?;

    let encoded = general_purpose::STANDARD.encode(output.into_inner());
    Ok(format!("data:{mime};base64,{encoded}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![convert_image])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(12.0))
                .expect("apply_vibrancy falhou");

            let app_handle = app.handle().clone();
            app.global_shortcut().on_shortcut(
                Shortcut::new(None, Code::Escape),
                move |_app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let window = app_handle.get_webview_window("main").unwrap();
                        if window.is_visible().unwrap() {
                            window.hide().unwrap();
                        }
                    }
                },
            ).unwrap();

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .on_tray_icon_event(move |tray, event| {
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);

                    if let TrayIconEvent::Click { button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        let window = app.get_webview_window("main").unwrap();

                        if window.is_visible().unwrap() {
                            window.hide().unwrap();
                        } else {
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