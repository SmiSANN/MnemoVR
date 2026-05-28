//! 設定・キャッシュ・サムネイル関連のコマンド。
//! - 設定の get/set とバックグラウンド動作フラグ
//! - サムネイル生成
//! - アップロード済み画像 URL のキャッシュ
//! - サムネイル＆URL キャッシュの一括クリア

use crate::state::{AppDatabase, CacheDir, RunInBackground};
use crate::thumbnail;
use tauri::{AppHandle, Manager};

// --- 設定 ---

/// 設定値を取得する。キーが未登録なら None。
#[tauri::command]
pub fn get_setting(app: AppHandle, key: String) -> Result<Option<String>, String> {
    app.state::<AppDatabase>().0.get_setting(&key)
}

/// 設定値を保存する。
#[tauri::command]
pub fn set_setting(app: AppHandle, key: String, value: String) -> Result<(), String> {
    app.state::<AppDatabase>().0.set_setting(&key, &value)
}

/// バックグラウンド動作設定を変更する（DB 永続化 + メモリキャッシュ更新）。
/// ウィンドウクローズハンドラがこのフラグを参照するため、DB だけでなくメモリも更新。
#[tauri::command]
pub fn set_run_in_background(app: AppHandle, enabled: bool) -> Result<(), String> {
    app.state::<AppDatabase>()
        .0
        .set_setting("run_in_background", if enabled { "1" } else { "0" })?;
    *app.state::<RunInBackground>().0.lock().unwrap() = enabled;
    Ok(())
}

// --- サムネイル ---

/// サムネイルパスを返す。未生成なら生成してキャッシュする。
/// 重いデコード処理は spawn_blocking で別スレッドに逃がす。
#[tauri::command]
pub async fn get_thumbnail(app: AppHandle, file_path: String) -> Result<String, String> {
    let cache_dir = app.state::<CacheDir>().0.clone();
    tokio::task::spawn_blocking(move || {
        thumbnail::ensure_thumbnail(&cache_dir, &file_path)
            .map(|p| p.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| format!("Task error: {e}"))?
}

// --- アップロード済み画像 URL キャッシュ ---

/// アップロード済み画像 URL をキャッシュから取得する（期限切れなら None）。
#[tauri::command]
pub fn get_cached_image_url(app: AppHandle, file_path: String) -> Result<Option<String>, String> {
    app.state::<AppDatabase>().0.get_cached_image_url(&file_path)
}

/// アップロード済み画像 URL を 3 日間キャッシュする。
#[tauri::command]
pub fn set_cached_image_url(
    app: AppHandle,
    file_path: String,
    url: String,
) -> Result<(), String> {
    app.state::<AppDatabase>()
        .0
        .set_cached_image_url(&file_path, &url)
}

// --- アセットスコープ ---

/// ファイルパスをアセットプロトコルのスコープに追加する（$HOME外のパスにも対応）。
#[tauri::command]
pub fn allow_asset_file(app: AppHandle, file_path: String) -> Result<(), String> {
    app.asset_protocol_scope()
        .allow_file(&file_path)
        .map_err(|e| e.to_string())
}

/// ディレクトリ配下を再帰的にアセットプロトコルのスコープに追加する。
/// 写真フォルダなど任意パスの画像を asset:// で読み込めるようにする。
#[tauri::command]
pub fn allow_asset_directory(app: AppHandle, dir_path: String) -> Result<(), String> {
    app.asset_protocol_scope()
        .allow_directory(&dir_path, true)
        .map_err(|e| e.to_string())
}

/// 画像ファイルを読み込み、data URL（base64）として返す。
/// production build でも asset protocol スコープを気にせず使える。
#[tauri::command]
pub fn read_image_as_data_url(file_path: String) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use std::path::Path;

    let bytes = std::fs::read(&file_path).map_err(|e| format!("読み込みエラー: {e}"))?;

    let ext = Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());

    let mime = match ext.as_deref() {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("bmp") => "image/bmp",
        _ => "image/png",
    };

    Ok(format!("data:{};base64,{}", mime, STANDARD.encode(&bytes)))
}

// --- ファイルダイアログ ---

/// 画像ファイル選択ダイアログを開き、選択されたパスを返す。キャンセル時は None。
#[tauri::command]
pub async fn pick_image_file() -> Result<Option<String>, String> {
    let handle = rfd::AsyncFileDialog::new()
        .add_filter("画像", &["png", "jpg", "jpeg", "webp", "gif", "bmp"])
        .pick_file()
        .await;
    Ok(handle.map(|f| f.path().to_string_lossy().to_string()))
}

/// フォルダ選択ダイアログを開き、選択されたパスを返す。キャンセル時は None。
#[tauri::command]
pub async fn pick_folder() -> Result<Option<String>, String> {
    let handle = rfd::AsyncFileDialog::new().pick_folder().await;
    Ok(handle.map(|f| f.path().to_string_lossy().to_string()))
}

// --- 一括クリア ---

/// サムネイルキャッシュとアップロード済み画像 URL キャッシュを削除する。
#[tauri::command]
pub fn clear_thumbnail_cache(app: AppHandle) -> Result<(), String> {
    let thumb_dir = app.state::<CacheDir>().0.join("thumbnails");
    if thumb_dir.exists() {
        std::fs::remove_dir_all(&thumb_dir)
            .map_err(|e| format!("Failed to clear thumbnail cache: {e}"))?;
    }
    app.state::<AppDatabase>().0.clear_cached_image_urls()?;
    Ok(())
}
