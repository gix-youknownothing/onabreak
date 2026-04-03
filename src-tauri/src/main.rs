#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod badge;
mod cli;
mod workspace;

use tauri::Manager;

#[cfg(target_os = "macos")]
fn configure_macos_window(window: &tauri::WebviewWindow<impl tauri::Runtime>) -> Result<(), String> {
    use objc::class;
    use objc::runtime::Object;
    use objc::{msg_send, sel, sel_impl};

    const CORNER_RADIUS: f64 = 20.0;

    unsafe {
        let ns_window = window.ns_window().map_err(|e| e.to_string())? as *mut Object;
        let clear_color: *mut Object = msg_send![class!(NSColor), clearColor];

        let _: () = msg_send![ns_window, setOpaque: false];
        let _: () = msg_send![ns_window, setBackgroundColor: clear_color];
        let _: () = msg_send![ns_window, setHasShadow: true];

        let content_view: *mut Object = msg_send![ns_window, contentView];
        if !content_view.is_null() {
            let _: () = msg_send![content_view, setWantsLayer: true];
            let layer: *mut Object = msg_send![content_view, layer];
            if !layer.is_null() {
                let _: () = msg_send![layer, setCornerRadius: CORNER_RADIUS];
                let _: () = msg_send![layer, setMasksToBounds: true];
            }
        }
    }

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_pty::init())
        .invoke_handler(tauri::generate_handler![
            cli::kill_cli_process,
            cli::open_terminal_session,
            badge::set_taskbar_badge,
            workspace::inspect_workspace,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_title("onabreak - AI Agent Chat").ok();
            #[cfg(target_os = "macos")]
            configure_macos_window(&window).ok();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
