//! VRChat 写真フォルダのファイル追加・削除を監視し、フロントエンドに通知する。
//!
//! - `photo-added`: 新規追加された写真のスキャン結果を含む
//! - `photo-deleted`: 削除されたファイルのパス文字列を含む
//!
//! VRChat の書き込み完了を待つため、追加時は 1.5 秒スリープしてからスキャンする。

use crate::scanner::{scan_single_photo, PhotoRecord};
use crate::state::{AppDatabase, FileWatcher};
use notify::{EventKind, RecursiveMode, Watcher, recommended_watcher};
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager};

const VRCHAT_FILE_PREFIX: &str = "VRChat_";
const VRCHAT_FILE_EXT: &str = ".png";
const WRITE_COMPLETE_WAIT_MS: u64 = 1500;

/// VRChat の写真ファイル名パターンに合致するか判定。
fn is_vrchat_photo(file_name: &str) -> bool {
    file_name.starts_with(VRCHAT_FILE_PREFIX) && file_name.to_lowercase().ends_with(VRCHAT_FILE_EXT)
}

/// 指定パスのファイル追加・削除を監視するウォッチャーを起動する。
/// 前のウォッチャーが残っていれば破棄して新しいものに差し替える。
pub fn start(app: &AppHandle, path: &str) {
    let app_handle = app.clone();
    let db = app.state::<AppDatabase>().0.clone();
    let tokio_handle = tokio::runtime::Handle::current();

    let Ok(mut watcher) = recommended_watcher(move |res: notify::Result<notify::Event>| {
        let Ok(event) = res else { return };
        match event.kind {
            EventKind::Remove(_) => {
                for p in event.paths {
                    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    if !is_vrchat_photo(name) {
                        continue;
                    }
                    let path_str = p.to_string_lossy().to_string();
                    let _ = db.delete_photo_by_path(&path_str);
                    let _ = app_handle.emit("photo-deleted", &path_str);
                }
            }
            EventKind::Create(_) => {
                for p in event.paths {
                    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    if !is_vrchat_photo(name) {
                        continue;
                    }
                    let path_str = p.to_string_lossy().to_string();
                    let app_handle = app_handle.clone();
                    let db = db.clone();
                    tokio_handle.spawn(async move {
                        // VRChat の書き込み完了を待ってからスキャン
                        tokio::time::sleep(tokio::time::Duration::from_millis(
                            WRITE_COMPLETE_WAIT_MS,
                        ))
                        .await;
                        if let Ok(Some(record)) = scan_single_photo(&path_str, &db) {
                            let _: Result<_, _> = app_handle.emit::<PhotoRecord>("photo-added", record);
                        }
                    });
                }
            }
            _ => {}
        }
    }) else {
        return;
    };

    if watcher.watch(Path::new(path), RecursiveMode::Recursive).is_err() {
        return;
    }

    if let Ok(mut guard) = app.state::<FileWatcher>().0.lock() {
        *guard = Some(watcher);
    }
}
