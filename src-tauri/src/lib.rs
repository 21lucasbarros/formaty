use base64::{engine::general_purpose, Engine};
use image::{ImageFormat, ImageReader};
use std::io::Cursor;
use serde::Serialize;
use tauri::{
    Manager,
    State,
    command,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
#[cfg(not(target_os = "macos"))]
use tauri::menu::{Menu, MenuItem};
#[cfg(target_os = "macos")]
use tauri_plugin_positioner::{WindowExt, Position};

/// Se o efeito de vidro nativo (vibrancy/acrylic) foi aplicado.
/// Quando falha, o frontend usa um fundo sólido no lugar.
struct Backdrop(bool);

#[derive(Serialize)]
struct PlatformInfo {
    os: &'static str,
    backdrop: bool,
}

#[command]
fn platform_info(backdrop: State<Backdrop>) -> PlatformInfo {
    PlatformInfo {
        os: std::env::consts::OS,
        backdrop: backdrop.0,
    }
}

#[command]
fn quit(app: tauri::AppHandle) {
    app.exit(0);
}

#[command]
fn save_image(path: String, data_url: String) -> Result<(), String> {
    let base64_clean = data_url
        .split(',')
        .nth(1)
        .ok_or("Dados de imagem inválidos")?;

    let bytes = general_purpose::STANDARD
        .decode(base64_clean)
        .map_err(|e| format!("Erro ao decodificar base64: {e}"))?;

    std::fs::write(&path, bytes).map_err(|e| format!("Erro ao salvar arquivo: {e}"))
}

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

/// Posiciona a janela junto ao ícone da bandeja (Windows/Linux): acima dele quando
/// a barra de tarefas está embaixo, abaixo quando está em cima, sempre dentro da
/// área útil do monitor. O positioner não cobre a barra de tarefas inferior.
#[cfg_attr(target_os = "macos", allow(dead_code))]
fn place_near_tray(window: &tauri::WebviewWindow, rect: tauri::Rect) -> tauri::Result<()> {
    let scale = window.scale_factor()?;
    let tray_pos = rect.position.to_physical::<i32>(scale);
    let tray_size = rect.size.to_physical::<i32>(scale);
    let win = window.outer_size()?;
    let (win_w, win_h) = (win.width as i32, win.height as i32);
    let gap = (8.0 * scale) as i32;

    let monitor = match window.monitor_from_point(tray_pos.x as f64, tray_pos.y as f64)? {
        Some(m) => m,
        None => match window.primary_monitor()? {
            Some(m) => m,
            None => return Ok(()),
        },
    };
    let area = monitor.work_area();
    let (ax, ay) = (area.position.x, area.position.y);
    let (aw, ah) = (area.size.width as i32, area.size.height as i32);

    let x = (tray_pos.x + tray_size.width / 2 - win_w / 2)
        .min(ax + aw - win_w - gap)
        .max(ax + gap);
    let y = if tray_pos.y > ay + ah / 2 {
        ay + ah - win_h - gap
    } else {
        ay + gap
    };

    window.set_position(tauri::PhysicalPosition::new(x, y))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![convert_image, save_image, platform_info, quit])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")]
            let backdrop = window_vibrancy::apply_vibrancy(
                &window,
                window_vibrancy::NSVisualEffectMaterial::HudWindow,
                None,
                Some(12.0),
            )
            .is_ok();

            // Acrylic funciona no Windows 10 (1809+) e 11
            #[cfg(target_os = "windows")]
            let backdrop = window_vibrancy::apply_acrylic(&window, Some((24, 24, 28, 140))).is_ok();

            #[cfg(not(any(target_os = "macos", target_os = "windows")))]
            let backdrop = false;

            app.manage(Backdrop(backdrop));

            let tray = TrayIconBuilder::new()
                .tooltip("Formaty")
                .on_tray_icon_event(move |tray, event| {
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);

                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        rect,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        let window = app.get_webview_window("main").unwrap();

                        if window.is_visible().unwrap() {
                            window.hide().unwrap();
                        } else {
                            // macOS: logo abaixo do ícone, na barra de menus do topo
                            #[cfg(target_os = "macos")]
                            {
                                let _ = rect;
                                let _ = window.move_window(Position::TrayCenter);
                            }
                            #[cfg(not(target_os = "macos"))]
                            let _ = place_near_tray(&window, rect);

                            window.show().unwrap();
                            window.set_focus().unwrap();
                        }
                    }
                });

            // macOS: ícone template monocromático, colorido pelo sistema conforme o tema.
            // Windows: ícone colorido do app, visível em barra de tarefas clara ou escura.
            #[cfg(target_os = "macos")]
            let tray = tray
                .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?)
                .icon_as_template(true);
            #[cfg(not(target_os = "macos"))]
            let tray = tray.icon(app.default_window_icon().unwrap().clone());

            // Menu de clique direito só fora do macOS: lá o NSStatusItem abre o menu
            // em qualquer clique e o popover nunca aparece. No macOS, o "Sair" fica
            // no próprio popover (botão e ⌘Q).
            #[cfg(not(target_os = "macos"))]
            let tray = {
                let quit = MenuItem::with_id(app, "quit", "Sair do Formaty", true, None::<&str>)?;
                tray.menu(&Menu::with_items(app, &[&quit])?)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| {
                        if event.id() == "quit" {
                            app.exit(0);
                        }
                    })
            };

            tray.build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}