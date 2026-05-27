//! 写真ライブラリ関連のコマンド。
//! - 写真フォルダのスキャン・取得・お気に入り操作
//! - ワールド名の解決と更新

use crate::file_watcher;
use crate::scanner::{scan_photos, PhotoRecord};
use crate::state::AppDatabase;
use crate::vrchat_api;
use tauri::{AppHandle, Manager};

/// 写真フォルダをスキャンし、結果を返す。スキャン後にファイル監視も開始する。
#[tauri::command]
pub async fn scan_local_photos(
    app: AppHandle,
    full_scan: bool,
    target_path: String,
) -> Result<Vec<PhotoRecord>, String> {
    let db = app.state::<AppDatabase>().0.clone();

    // フルスキャン時は last_synced_at をリセット（次回 sync で全件送信）
    if full_scan {
        let _ = db.set_setting("last_synced_at", "0");
    }

    let result = scan_photos(&target_path, full_scan, db).await;
    file_watcher::start(&app, &target_path);
    result
}

/// OS のピクチャフォルダから VRChat のデフォルト写真パスを推測する。
#[tauri::command]
pub fn get_vrchat_picture_path() -> Result<String, String> {
    let pictures = dirs::picture_dir().ok_or("Could not find Pictures directory")?;
    let vrchat_path = pictures.join("VRChat");
    if vrchat_path.exists() {
        Ok(vrchat_path.to_string_lossy().to_string())
    } else {
        Err(format!(
            "VRChat folder not found at: {}",
            vrchat_path.display()
        ))
    }
}

/// DB 内の全写真レコードを取得する。
#[tauri::command]
pub fn get_all_photos(app: AppHandle) -> Result<Vec<PhotoRecord>, String> {
    app.state::<AppDatabase>().0.get_all_photos()
}

/// お気に入りをトグルし、新しい状態を返す。
#[tauri::command]
pub fn toggle_favorite(app: AppHandle, photo_id: String) -> Result<bool, String> {
    app.state::<AppDatabase>().0.toggle_favorite(&photo_id)
}

/// ワールド ID からワールド名を VRChat API で解決する。
/// 失敗時はワールド ID をそのまま返す。
#[tauri::command]
pub async fn resolve_world_name(world_id: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    Ok(vrchat_api::resolve_world_name(&client, &world_id).await)
}

/// サーバーから受け取った最新ワールド名でローカル DB を更新する。
#[tauri::command]
pub fn update_world_name_by_world_id(
    app: AppHandle,
    world_id: String,
    world_name: String,
) -> Result<(), String> {
    app.state::<AppDatabase>()
        .0
        .update_world_name_by_world_id(&world_id, &world_name)
}
