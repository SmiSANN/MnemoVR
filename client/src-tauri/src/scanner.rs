use crate::db::Database;
use crate::xmp::extract_xmp_from_png;
use chrono::{DateTime, FixedOffset, NaiveDateTime};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use walkdir::WalkDir;

/// フロントエンドとやりとりする写真レコード。DBの photos テーブルと1:1対応。
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PhotoRecord {
    pub id: String,
    pub file_path: String,
    pub world_id: Option<String>,
    pub world_name: Option<String>,
    pub user_id: Option<String>,
    pub user_name: Option<String>,
    pub captured_at: i64, // Unixタイムスタンプ（ミリ秒）
    pub is_favorite: bool,
}

/// ファイルウォッチャーが検知した単一ファイルをスキャンしてDBに追加する。
/// 既登録済みなら None を返す。
pub fn scan_single_photo(file_path: &str, db: &Database) -> Result<Option<PhotoRecord>, String> {
    let path = std::path::Path::new(file_path);
    if !path.is_file() {
        return Ok(None);
    }
    let file_name = match path.file_name().and_then(|n| n.to_str()) {
        Some(n) => n,
        None => return Ok(None),
    };
    if !file_name.starts_with("VRChat_") || !file_name.to_lowercase().ends_with(".png") {
        return Ok(None);
    }
    if db.file_exists(file_path).unwrap_or(false) {
        return Ok(None);
    }

    let (captured_at, world_id, world_name, author_id, author_name) =
        match extract_xmp_from_png(file_path) {
            Ok(meta) => {
                let ts = meta
                    .create_date
                    .as_deref()
                    .and_then(parse_datetime_to_millis)
                    .unwrap_or_else(|| parse_filename_datetime(file_name));
                (ts, meta.world_id, meta.world_name, meta.author_id, meta.author_name)
            }
            Err(_) => (parse_filename_datetime(file_name), None, None, None, None),
        };

    let record = PhotoRecord {
        id: uuid::Uuid::new_v4().to_string(),
        file_path: file_path.to_string(),
        world_id: world_id.clone(),
        world_name: world_name.clone(),
        user_id: author_id,
        user_name: author_name,
        captured_at,
        is_favorite: false,
    };

    db.upsert_photo(&record)?;

    if world_id.is_some() && world_name.is_some() {
        if let Some(wid) = &record.world_id {
            let _ = db.propagate_world_name_from_newest(wid);
        }
    }

    Ok(Some(record))
}

/// 写真フォルダをスキャンしてDBに反映する。処理後、DB内の全写真を返す。
/// full_scan=true: DB全削除→全ファイルスキャン / false: 存在しないファイルのパージ→差分スキャン
pub async fn scan_photos(
    target_path: &str,
    full_scan: bool,
    db: Arc<Database>,
) -> Result<Vec<PhotoRecord>, String> {
    let target = target_path.to_string();
    let db_clone = db.clone();

    if full_scan {
        // フルスキャン: 既存データを全削除してから再スキャン
        db.clear_photos()?;
    } else {
        // 差分スキャン: ディスクから消えたファイルのDBレコードを先にパージ
        purge_missing_photos(&db)?;
    }

    // 差分スキャンの閾値（フルスキャンならNone＝全件対象）
    let threshold = if full_scan {
        None
    } else {
        db.get_latest_captured_at()?
    };

    // ファイルI/Oはブロッキングスレッドで実行
    let new_records = tokio::task::spawn_blocking(move || {
        scan_directory(&target, threshold, &db_clone)
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?;

    let inserted = new_records?;

    // 同一ワールドの全写真に最新 XMP ワールド名を伝播（world_id ごとに1回のみ実行）
    let mut seen_world_ids = std::collections::HashSet::new();
    for record in &inserted {
        if let Some(wid) = &record.world_id {
            if record.world_name.is_some() && seen_world_ids.insert(wid.clone()) {
                let _ = db.propagate_world_name_from_newest(wid);
            }
        }
    }

    // DB内の全写真を返す（既存＋新規）
    db.get_all_photos()
}

/// ディスク上に存在しないファイルのDBレコードを削除する。
/// 起動中のファイル削除は notify ウォッチャーが処理するが、
/// オフライン中に消えたファイルはこの関数でカバーする。
fn purge_missing_photos(db: &Database) -> Result<(), String> {
    let paths = db.get_all_photo_paths()?;
    for path in paths {
        if !std::path::Path::new(&path).exists() {
            let _ = db.delete_photo_by_path(&path);
        }
    }
    Ok(())
}

/// ディレクトリを再帰走査し、VRChat写真（VRChat_*.png）を検出してDBに挿入する。
/// threshold が Some の場合は差分スキャン：閾値以前の既存ファイルをスキップする。
fn scan_directory(
    target_path: &str,
    threshold: Option<i64>,
    db: &Database,
) -> Result<Vec<PhotoRecord>, String> {
    let mut inserted = Vec::new();

    for entry in WalkDir::new(target_path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        if !path.is_file() {
            continue;
        }
        let file_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n,
            None => continue,
        };
        // VRChat写真のファイル名パターンに一致しないファイルはスキップ
        if !file_name.starts_with("VRChat_") || !file_name.to_lowercase().ends_with(".png") {
            continue;
        }

        let file_path_str = path.to_string_lossy().to_string();

        // 差分スキャン: DB登録済みファイルはスキップ
        if threshold.is_some() && db.file_exists(&file_path_str).unwrap_or(false) {
            continue;
        }

        // XMPメタデータの抽出を試み、撮影日時とワールド情報を取得
        let (captured_at, world_id, world_name, author_id, author_name) =
            match extract_xmp_from_png(&file_path_str) {
                Ok(meta) => {
                    let ts = meta
                        .create_date
                        .as_deref()
                        .and_then(parse_datetime_to_millis)
                        .unwrap_or_else(|| parse_filename_datetime(file_name));
                    (ts, meta.world_id, meta.world_name, meta.author_id, meta.author_name)
                }
                Err(_) => {
                    // XMP抽出失敗時はファイル名から日時のみ取得
                    (parse_filename_datetime(file_name), None, None, None, None)
                }
            };

        // 差分スキャン: 閾値以前の日付かつDB登録済みならスキップ
        // （古い日付の新規ファイルは通す）
        if let Some(thresh) = threshold {
            if captured_at <= thresh && db.file_exists(&file_path_str).unwrap_or(false) {
                continue;
            }
        }

        let record = PhotoRecord {
            id: uuid::Uuid::new_v4().to_string(),
            file_path: file_path_str,
            world_id,
            world_name,
            user_id: author_id,
            user_name: author_name,
            captured_at,
            is_favorite: false,
        };

        // DBに保存
        if let Err(e) = db.upsert_photo(&record) {
            eprintln!("Failed to upsert photo {}: {}", record.file_path, e);
            continue;
        }

        inserted.push(record);
    }

    Ok(inserted)
}

/// XMPの CreateDate（例: "2026-02-16T13:44:43.5227567+09:00"）をUnixミリ秒に変換する。
fn parse_datetime_to_millis(date_str: &str) -> Option<i64> {
    if let Ok(dt) = DateTime::<FixedOffset>::parse_from_str(date_str, "%Y-%m-%dT%H:%M:%S%.f%:z") {
        return Some(dt.timestamp_millis());
    }
    if let Ok(dt) = DateTime::<FixedOffset>::parse_from_str(date_str, "%Y-%m-%dT%H:%M:%S%:z") {
        return Some(dt.timestamp_millis());
    }
    None
}

/// VRChatファイル名から撮影日時を解析する。対応フォーマット:
/// - "VRChat_2023-09-03_23-51-29.074_1920x1080.png"  (日時_解像度)
/// - "VRChat_1920x1080_2022-10-10_00-25-00.200.png"  (解像度_日時)
fn parse_filename_datetime(filename: &str) -> i64 {
    let stem = filename.strip_suffix(".png")
        .or_else(|| filename.strip_suffix(".PNG"))
        .unwrap_or(filename);
    let parts: Vec<&str> = stem.split('_').collect();
    // "_"区切りのセグメントからYYYY-MM-DD + HH-MM-SS のペアを検索
    for i in 1..parts.len().saturating_sub(1) {
        if looks_like_date(parts[i]) && looks_like_time(parts[i + 1]) {
            let date_part = parts[i];
            let time_part = parts[i + 1];
            let time_formatted = time_part.replacen('-', ":", 2);
            let datetime_str = format!("{date_part}T{time_formatted}");

            if let Ok(dt) = NaiveDateTime::parse_from_str(&datetime_str, "%Y-%m-%dT%H:%M:%S%.f") {
                return dt.and_utc().timestamp_millis();
            }
            if let Ok(dt) = NaiveDateTime::parse_from_str(&datetime_str, "%Y-%m-%dT%H:%M:%S") {
                return dt.and_utc().timestamp_millis();
            }
        }
    }
    0
}

fn looks_like_date(s: &str) -> bool {
    s.len() == 10 && s.as_bytes().get(4) == Some(&b'-') && s.as_bytes().get(7) == Some(&b'-')
}

fn looks_like_time(s: &str) -> bool {
    s.len() >= 8 && s.as_bytes().get(2) == Some(&b'-') && s.as_bytes().get(5) == Some(&b'-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_filename_datetime() {
        // Format: VRChat_DATE_TIME_RESOLUTION.png
        let millis = parse_filename_datetime("VRChat_2026-02-16_13-44-41.565_7680x4320.png");
        assert!(millis > 0);
    }

    #[test]
    fn test_parse_filename_datetime_resolution_first() {
        // Format: VRChat_RESOLUTION_DATE_TIME.png
        let millis = parse_filename_datetime("VRChat_1920x1080_2022-10-10_00-25-00.200.png");
        assert!(millis > 0);
    }

    #[test]
    fn test_parse_filename_datetime_no_millis() {
        let m1 = parse_filename_datetime("VRChat_2023-09-03_23-51-29_1920x1080.png");
        assert!(m1 > 0);
    }

    #[test]
    fn test_parse_datetime_to_millis() {
        let millis = parse_datetime_to_millis("2026-02-16T13:44:43.5227567+09:00").unwrap();
        assert!(millis > 0);
    }
}
