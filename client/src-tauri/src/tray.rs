//! システムトレイアイコンとウィンドウクローズハンドリング。
//!
//! - トレイアイコン: 左クリックでメインウィンドウを再表示
//! - クローズイベント: `run_in_background` が有効ならウィンドウを閉じずに hide する

use crate::state::RunInBackground;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, Manager};

/// システムトレイアイコンを構築する。
/// アイコンはアプリのデフォルトウィンドウアイコンを使用。
pub fn setup_tray(app: &mut App) -> tauri::Result<()> {
    TrayIconBuilder::new()
        .icon(
            app.default_window_icon()
                .expect("default window icon missing")
                .clone(),
        )
        .tooltip("MnemoVR")
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;
    Ok(())
}

/// メインウィンドウのクローズイベントを傍受する。
/// `run_in_background` が有効なら閉じる代わりに hide する（トレイ常駐）。
pub fn install_close_handler(app: &App) {
    let window = app
        .get_webview_window("main")
        .expect("main window not found");
    let app_handle = app.handle().clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            let enabled = *app_handle
                .state::<RunInBackground>()
                .0
                .lock()
                .unwrap();
            if enabled {
                api.prevent_close();
                if let Some(w) = app_handle.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
        }
    });
}
