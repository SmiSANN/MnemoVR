//! VRChat 公開 API（ワールド情報取得など）へのアクセス層。
//! 失敗時は world_id をフォールバックとして返す方針で、UI のブロックを避ける。

const WORLDS_ENDPOINT: &str = "https://api.vrchat.cloud/api/1/worlds";
const USER_AGENT: &str = concat!("MnemoVR/", env!("CARGO_PKG_VERSION"));

/// world_id に対応するワールド名を VRChat API から取得する。
/// 失敗時は world_id をそのまま返す（呼び出し側でフォールバック扱いしやすいように）。
pub async fn resolve_world_name(client: &reqwest::Client, world_id: &str) -> String {
    let url = format!("{WORLDS_ENDPOINT}/{world_id}");
    let Ok(resp) = client.get(&url).header("User-Agent", USER_AGENT).send().await else {
        return world_id.to_string();
    };
    if !resp.status().is_success() {
        return world_id.to_string();
    }
    let Ok(json) = resp.json::<serde_json::Value>().await else {
        return world_id.to_string();
    };
    json.get("name")
        .and_then(|v| v.as_str())
        .unwrap_or(world_id)
        .to_string()
}
