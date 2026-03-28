#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod badge;
mod cli;

use tauri::Manager;

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
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_title("onabreak - AI Agent Chat").ok();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
