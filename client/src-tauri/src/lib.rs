//! MnemoVR Tauri アプリのエントリポイント。
//!
//! アーキテクチャ:
//! - `commands/`      フロントエンド公開 API（`#[tauri::command]` の集合、4ファイル）
//! - `state`          共有 State 型
//! - 純粋ライブラリ   `auth`, `db`, `scanner`, `sync`, `thumbnail`, `xmp`, `wic`
//! - 再利用機構       `version_check`, `vrchat_api`, `image_upload`, `file_watcher`, `tray`
//!
//! 詳細は ARCHITECTURE.md を参照。

mod auth;
mod commands;
mod db;
mod file_watcher;
mod image_upload;
mod scanner;
mod state;
mod sync;
mod thumbnail;
mod tray;
mod version_check;
mod vrchat_api;
mod xmp;
#[cfg(windows)]
mod wic;

use db::Database;
use state::{AppDatabase, CacheDir, FileWatcher, RunInBackground};
use std::sync::{Arc, Mutex};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            setup_app_state(app)?;
            tray::setup_tray(app)?;
            tray::install_close_handler(app);
            tauri::async_runtime::spawn(sync::auto_sync_loop(app.state::<AppDatabase>().0.clone()));
            // --autostart フラグがある場合はウィンドウを非表示で起動（トレイ常駐）
            if std::env::args().any(|a| a == "--autostart") {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // photos
            commands::photos::scan_local_photos,
            commands::photos::get_vrchat_picture_path,
            commands::photos::get_all_photos,
            commands::photos::toggle_favorite,
            commands::photos::resolve_world_name,
            commands::photos::update_world_name_by_world_id,
            // storage
            commands::storage::get_setting,
            commands::storage::set_setting,
            commands::storage::set_run_in_background,
            commands::storage::get_thumbnail,
            commands::storage::get_cached_image_url,
            commands::storage::set_cached_image_url,
            commands::storage::clear_thumbnail_cache,
            commands::storage::pick_image_file,
            commands::storage::pick_folder,
            commands::storage::allow_asset_file,
            commands::storage::allow_asset_directory,
            commands::storage::read_image_as_data_url,
            // autostart
            commands::autostart::get_autostart_enabled,
            commands::autostart::set_autostart_enabled,
            // auth
            commands::auth::oauth_login,
            commands::auth::oauth_logout,
            commands::auth::get_auth_status,
            // server
            commands::server::sync_to_server,
            commands::server::upload_image,
            commands::server::fetch_rankings,
            commands::server::check_for_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// アプリデータディレクトリに DB を初期化し、Tauri の State として登録する。
fn setup_app_state(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");

    let db_path = data_dir.join("mnemovr.db");
    let database = Database::open(&db_path).expect("failed to initialize database");

    // バックグラウンド動作設定を DB から読み込んでメモリにキャッシュ
    let run_in_bg = database
        .get_setting("run_in_background")
        .ok()
        .flatten()
        .map(|v| v == "1")
        .unwrap_or(false);

    app.manage(AppDatabase(Arc::new(database)));
    app.manage(CacheDir(data_dir));
    app.manage(FileWatcher(Mutex::new(None)));
    app.manage(RunInBackground(Mutex::new(run_in_bg)));

    Ok(())
}
