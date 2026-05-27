use hmac::{Hmac, Mac};
use sha2::Sha256;
use serde::{Deserialize, Serialize};

use crate::db::Database;
use std::sync::Arc;

type HmacSha256 = Hmac<Sha256>;

/// サーバーに送信する同期ペイロード（ユーザーIDはJWT Bearerヘッダーで送信）
#[derive(Serialize)]
struct SyncPayload {
    logs: Vec<SyncLog>,
}

/// 1件の訪問ログ（ワールドごとに集約済み）
/// ワールド名はサーバー側で VRChat API から取得するため送信しない
#[derive(Serialize)]
struct SyncLog {
    world_id: String,
    last_visited_date: String, // YYYY-MM-DD (JST) 最終訪問日
    photo_count: i32,          // 累計写真枚数
}

/// サーバーからの同期レスポンス
#[derive(Deserialize)]
struct SyncResponse {
    success: bool,
    inserted: Option<i64>,
}

/// HMAC-SHA256署名を生成する（正規クライアント確認用）。
fn compute_hmac(secret: &str, body: &str) -> String {
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC can take key of any size");
    mac.update(body.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

/// ローカルDBの写真から同期ログを構築する。
/// 前回同期以降に写真が追加されたワールドのみ対象（差分同期）。
/// 対象ワールドの集計値は全写真から正確に算出する。
fn build_sync_logs(db: &Database) -> Result<Vec<SyncLog>, String> {
    let photos = db.get_all_photos()?;

    use std::collections::{HashMap, HashSet};

    // 前回同期タイムスタンプ（未設定なら 0 = 全件対象）
    let last_synced_at: i64 = db
        .get_setting("last_synced_at")?
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    let jst_offset = chrono::FixedOffset::east_opt(9 * 3600).unwrap();

    // 前回同期以降に写真が追加されたワールドIDを収集
    let changed_world_ids: HashSet<String> = photos
        .iter()
        .filter(|p| p.captured_at > last_synced_at)
        .filter_map(|p| p.world_id.clone())
        .collect();

    if changed_world_ids.is_empty() {
        return Ok(vec![]);
    }

    // 変更されたワールドのみ、全写真から正確に集計
    let mut groups: HashMap<String, (String, i32)> = HashMap::new();
    for photo in &photos {
        let world_id = match &photo.world_id {
            Some(w) if changed_world_ids.contains(w) => w.clone(),
            _ => continue,
        };

        let utc_dt = chrono::DateTime::from_timestamp_millis(photo.captured_at);
        let jst_date = match utc_dt {
            Some(dt) => dt.with_timezone(&jst_offset).format("%Y-%m-%d").to_string(),
            None => continue,
        };

        let entry = groups.entry(world_id).or_insert_with(|| (jst_date.clone(), 0));
        if jst_date > entry.0 {
            entry.0 = jst_date;
        }
        entry.1 += 1;
    }

    let logs = groups
        .into_iter()
        .map(|(world_id, (last_visited_date, photo_count))| SyncLog {
            world_id,
            last_visited_date,
            photo_count,
        })
        .collect();

    Ok(logs)
}

/// ローカルDBのデータをサーバーに同期する。
/// 処理の流れ:
///   1. 環境変数（HMAC_SECRET, SYNC_API_URL）読み込み
///   2. JWTトークン取得（未ログイン時はエラー）
///   3. 同期ログ構築
///   4. HMAC署名生成（正規クライアント証明）
///   5. Authorization: Bearer + X-Signature ヘッダー付きでPOST
pub async fn sync_to_server(db: Arc<Database>) -> Result<String, String> {
    // .env から設定を読み込み（起動時に dotenvy で読み込み済み）
    let hmac_secret = env!("HMAC_SECRET");
    let api_url = env!("SYNC_API_URL");

    // JWTトークンを取得（ログイン必須）
    let auth_token = db
        .get_setting("auth_token")?
        .ok_or("同期にはログインが必要です。設定画面からDiscordでログインしてください。")?;

    let logs = build_sync_logs(&db)?;
    if logs.is_empty() {
        return Ok("同期するデータがありません。".to_string());
    }

    let log_count = logs.len();
    let payload = SyncPayload { logs };

    // JSON化してHMAC署名を生成（正規クライアント証明）
    let body = serde_json::to_string(&payload).map_err(|e| format!("JSON serialize error: {e}"))?;
    let signature = compute_hmac(&hmac_secret, &body);

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{api_url}/api/sync"))
        .header("Content-Type", "application/json")
        .header("X-Signature", signature)
        .header("Authorization", format!("Bearer {auth_token}"))
        .body(body)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        // 401: トークン無効（ユーザー不在・期限切れ）→ ローカルの認証情報を削除
        if status == reqwest::StatusCode::UNAUTHORIZED {
            let _ = db.set_setting("auth_token", "");
            let _ = db.set_setting("auth_provider", "");
            let _ = db.set_setting("auth_display_name", "");
            return Err("認証が無効になりました。再度ログインしてください。".to_string());
        }
        // 403: BAN
        if status == reqwest::StatusCode::FORBIDDEN {
            return Err("アカウントが停止されています。".to_string());
        }
        // 5xx: サーバー側の問題（DBテーブル欠損など）
        if status.is_server_error() {
            return Err(format!("サーバーエラーが発生しました ({status})。データは同期されていません。"));
        }
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("同期に失敗しました ({status}): {text}"));
    }

    let result: SyncResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {e}"))?;

    if result.success {
        // 同期成功時にタイムスタンプを更新（次回は差分のみ送信）
        let now = chrono::Utc::now().timestamp_millis().to_string();
        let _ = db.set_setting("last_synced_at", &now);
        Ok(format!(
            "{log_count}件のログを送信しました。(サーバー処理: {}件)",
            result.inserted.unwrap_or(0)
        ))
    } else {
        Err("サーバーが同期を拒否しました。".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_hmac() {
        let sig = compute_hmac("secret", r#"{"test": true}"#);
        assert!(!sig.is_empty());
        assert_eq!(sig.len(), 64); // SHA256 = 32 bytes = 64 hex chars
    }
}
