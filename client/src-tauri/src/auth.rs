use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use crate::db::Database;
use std::sync::Arc;

/// OAuthログイン成功時に返す認証情報
#[derive(Serialize, Clone)]
pub struct AuthStatus {
    pub display_name: String,
    pub provider: String,
}

/// PKCE用の code_verifier と code_challenge を生成する。
fn generate_pkce() -> (String, String) {
    let b1 = uuid::Uuid::new_v4();
    let b2 = uuid::Uuid::new_v4();
    let bytes: Vec<u8> = b1
        .as_bytes()
        .iter()
        .chain(b2.as_bytes().iter())
        .copied()
        .collect();
    let verifier = URL_SAFE_NO_PAD.encode(&bytes);
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());
    (verifier, challenge)
}

/// ローカルHTTPサーバーでOAuthコールバックを1回だけ受信する。
/// `expected_state` と一致しない state を受け取った場合は CSRF とみなし拒否する。
/// タイムアウト: 2分。
async fn wait_for_callback(listener: TcpListener, expected_state: &str) -> Result<String, String> {
    tokio::time::timeout(std::time::Duration::from_secs(120), async {
        let (mut stream, _) = listener
            .accept()
            .await
            .map_err(|e| format!("コールバック受信エラー: {e}"))?;

        let mut buf = vec![0u8; 4096];
        let n = stream
            .read(&mut buf)
            .await
            .map_err(|e| format!("リクエスト読み取りエラー: {e}"))?;
        let request = String::from_utf8_lossy(&buf[..n]);

        let query = request
            .lines()
            .next()
            .and_then(|line| line.split_whitespace().nth(1))
            .and_then(|path| path.split_once('?').map(|(_, q)| q))
            .unwrap_or("");

        let mut code: Option<String> = None;
        let mut error: Option<String> = None;
        let mut state: Option<String> = None;
        for pair in query.split('&') {
            if let Some((k, v)) = pair.split_once('=') {
                match k {
                    "code" => code = Some(v.to_string()),
                    "error" => error = Some(v.to_string()),
                    "state" => state = Some(v.to_string()),
                    _ => {}
                }
            }
        }

        // CSRF 対策: 認可リクエスト時に生成した state と一致しなければ拒否
        if state.as_deref() != Some(expected_state) {
            return Err("state が一致しません（不正なコールバック）".to_string());
        }

        let body = if code.is_some() {
            "<h2 style='color:#2dd4bf'>ログイン完了</h2><p>このタブを閉じてアプリに戻ってください。</p>"
        } else {
            "<h2 style='color:#f87171'>ログインがキャンセルされました</h2><p>このタブを閉じてアプリに戻ってください。</p>"
        };
        let html = format!(
            "<html><head><meta charset='utf-8'></head>\
            <body style='font-family:sans-serif;background:#0f172a;color:#94a3b8;\
            display:flex;align-items:center;justify-content:center;height:100vh;margin:0'>\
            <div style='text-align:center'>{body}</div></body></html>"
        );
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n{html}"
        );
        let _ = stream.write_all(response.as_bytes()).await;

        match (code, error) {
            (Some(c), _) => Ok(c),
            (_, Some(e)) => Err(format!("OAuthがユーザーによって拒否されました: {e}")),
            _ => Err("コールバックにcodeが含まれていません".to_string()),
        }
    })
    .await
    .map_err(|_| "OAuthログインがタイムアウトしました（2分）".to_string())?
}

/// OAuthコールバックを受け付けるローカルサーバーの固定ポート。
/// Discord Developer Portal の OAuth2 → Redirects に
/// http://127.0.0.1:58738 を完全一致で登録すること。
/// また「公開クライアント」にチェックを入れること。
const OAUTH_CALLBACK_PORT: u16 = 58738;

/// Discord OAuthログインフロー（公開クライアント + PKCE）。
/// 処理の流れ:
///   1. PKCE生成
///   2. 固定ポートでローカルHTTPサーバー起動
///   3. ブラウザで認可URLを開く
///   4. コールバック受信（code取得）
///   5. TauriアプリがDiscordに直接トークン交換（client_secret不要）
///   6. Discordアクセストークンをサーバーに送りJWT取得
///   7. JWT・認証情報をDBに保存
pub async fn start_oauth_login(
    db: Arc<Database>,
    app: &tauri::AppHandle,
) -> Result<AuthStatus, String> {
    let api_url = env!("SYNC_API_URL");
    let client_id = env!("DISCORD_CLIENT_ID");

    let (code_verifier, code_challenge) = generate_pkce();

    // CSRF 対策用の state（ランダム）。コールバックで一致を検証する。
    let state = uuid::Uuid::new_v4().to_string();

    let listener = TcpListener::bind(format!("127.0.0.1:{OAUTH_CALLBACK_PORT}"))
        .await
        .map_err(|e| format!(
            "ポート {OAUTH_CALLBACK_PORT} が使用中です。他のアプリを終了してから再試行してください: {e}"
        ))?;

    let redirect_uri = format!("http://127.0.0.1:{OAUTH_CALLBACK_PORT}");
    let redirect_uri_encoded = urlencoding::encode(&redirect_uri).to_string();

    // 認可URL（PKCEあり・公開クライアント・CSRF state あり）
    let auth_url = format!(
        "https://discord.com/oauth2/authorize\
        ?client_id={client_id}\
        &response_type=code\
        &redirect_uri={redirect_uri_encoded}\
        &scope=identify\
        &state={state}\
        &code_challenge={code_challenge}\
        &code_challenge_method=S256"
    );

    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(&auth_url, None::<&str>)
        .map_err(|e| format!("ブラウザを開けませんでした: {e}"))?;

    let code = wait_for_callback(listener, &state).await?;

    // サーバーに code + code_verifier を送り、サーバー側でトークン交換してJWTを取得
    // （client_secret はサーバーのみが保持し、クライアントには渡さない）
    let http = reqwest::Client::new();
    let resp = http
        .post(format!("{api_url}/api/auth/callback"))
        .json(&serde_json::json!({
            "code": code,
            "redirect_uri": redirect_uri,
            "code_verifier": code_verifier,
        }))
        .send()
        .await
        .map_err(|e| format!("認証リクエスト失敗: {e}"))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("JWT取得失敗: {text}"));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("JWTレスポンスのパース失敗: {e}"))?;

    let token = data["token"]
        .as_str()
        .ok_or("レスポンスにtokenがありません")?
        .to_string();
    let display_name = data["display_name"]
        .as_str()
        .unwrap_or("Unknown")
        .to_string();

    db.set_setting("auth_token", &token)?;
    db.set_setting("auth_provider", "discord")?;
    db.set_setting("auth_display_name", &display_name)?;

    Ok(AuthStatus {
        display_name,
        provider: "discord".to_string(),
    })
}
