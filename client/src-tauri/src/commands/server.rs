//! 自前サーバーとの連携コマンド。
//! - 同期（実装は `crate::sync`）
//! - ランキング取得（サーバー API → 不足ワールド名を VRChat API で並列補完）
//! - 画像アップロード（実装は `crate::image_upload`）
//! - バージョン確認（実装は `crate::version_check`）

use crate::image_upload;
use crate::state::AppDatabase;
use crate::sync;
use crate::version_check;
use crate::vrchat_api;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use tauri::{AppHandle, Manager};

// --- 同期 ---

/// ローカル DB のデータをサーバーに同期する。
#[tauri::command]
pub async fn sync_to_server(app: AppHandle) -> Result<String, String> {
    let db = app.state::<AppDatabase>().0.clone();
    sync::sync_to_server(db).await
}

// --- アップロード ---

/// ローカル画像を image2vrc にアップロードし、公開 URL を返す。
#[tauri::command]
pub async fn upload_image(file_path: String) -> Result<String, String> {
    image_upload::upload(file_path).await
}

// --- バージョン確認 ---

/// サーバーの `/api/version` で最新バージョンを確認する。
/// 現行より新しければバージョン文字列を返し、最新版・取得失敗時は None。
#[tauri::command]
pub async fn check_for_update() -> Option<String> {
    let endpoint = format!("{}/api/version", env!("SYNC_API_URL"));
    version_check::check_for_update(&endpoint, env!("CARGO_PKG_VERSION")).await
}

// --- ランキング ---

/// 1 エントリ（ワールド名は必ず解決済み）
#[derive(Serialize)]
pub struct RankingEntry {
    world_id: String,
    world_name: String,
    score: i64,
}

#[derive(Serialize)]
pub struct RankingsData {
    daily: Vec<RankingEntry>,
    weekly: Vec<RankingEntry>,
    all_time: Vec<RankingEntry>,
}

/// サーバー API のレスポンス形式（world_name は未解決の場合 null）
#[derive(Deserialize)]
struct ApiRankingEntry {
    world_id: String,
    world_name: Option<String>,
    score: i64,
}

#[derive(Deserialize)]
struct ApiRankingsData {
    daily: Vec<ApiRankingEntry>,
    weekly: Vec<ApiRankingEntry>,
    all_time: Vec<ApiRankingEntry>,
}

/// サーバーが返した name_map を起点に、欠けているワールド名を VRChat API で並列補完。
async fn build_name_map(
    client: &reqwest::Client,
    data: &ApiRankingsData,
) -> HashMap<String, String> {
    let mut name_map = HashMap::<String, String>::new();
    for e in data.daily.iter().chain(&data.weekly).chain(&data.all_time) {
        if let Some(name) = &e.world_name {
            name_map.entry(e.world_id.clone()).or_insert_with(|| name.clone());
        }
    }

    let all_ids: HashSet<String> = data
        .daily.iter().chain(&data.weekly).chain(&data.all_time)
        .map(|e| e.world_id.clone())
        .collect();
    let missing: Vec<String> = all_ids
        .into_iter()
        .filter(|id| !name_map.contains_key(id))
        .collect();

    // VRChat API への同時リクエスト数を抑える（レート制限・負荷対策）
    const CONCURRENCY: usize = 6;
    for chunk in missing.chunks(CONCURRENCY) {
        let handles: Vec<_> = chunk
            .iter()
            .cloned()
            .map(|wid| {
                let c = client.clone();
                tokio::spawn(async move {
                    let name = vrchat_api::resolve_world_name(&c, &wid).await;
                    (wid, name)
                })
            })
            .collect();

        for handle in handles {
            if let Ok((wid, name)) = handle.await {
                name_map.insert(wid, name);
            }
        }
    }
    name_map
}

fn fill(entries: Vec<ApiRankingEntry>, names: &HashMap<String, String>) -> Vec<RankingEntry> {
    entries
        .into_iter()
        .map(|e| {
            let world_name = names
                .get(&e.world_id)
                .cloned()
                .unwrap_or_else(|| e.world_id.clone());
            RankingEntry {
                world_id: e.world_id,
                world_name,
                score: e.score,
            }
        })
        .collect()
}

#[tauri::command]
pub async fn fetch_rankings(app: AppHandle) -> Result<RankingsData, String> {
    let api_url = env!("SYNC_API_URL");
    let client = reqwest::Client::new();

    let resp = client
        .get(format!("{api_url}/api/rankings"))
        .send()
        .await
        .map_err(|e| format!("ランキングの取得に失敗しました: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("サーバーエラー: HTTP {}", resp.status()));
    }

    let api_data: ApiRankingsData = resp
        .json()
        .await
        .map_err(|e| format!("レスポンスの解析に失敗しました: {e}"))?;

    let name_map = build_name_map(&client, &api_data).await;

    // 解決できたワールド名をローカル DB に保存
    let db = app.state::<AppDatabase>().0.clone();
    for (world_id, world_name) in &name_map {
        if world_name != world_id {
            let _ = db.update_world_name_by_world_id(world_id, world_name);
        }
    }

    Ok(RankingsData {
        daily: fill(api_data.daily, &name_map),
        weekly: fill(api_data.weekly, &name_map),
        all_time: fill(api_data.all_time, &name_map),
    })
}
