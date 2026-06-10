//! OAuth ログイン関連のコマンド（OAuth フロー本体は `crate::auth` モジュールに実装）。

use crate::auth::{start_oauth_login, AuthStatus};
use crate::state::AppDatabase;
use tauri::{AppHandle, Manager};

/// Discord OAuth ログインフローを開始する。
/// ブラウザが開き、ユーザーがログインすると JWT を取得・DB に保存する。
#[tauri::command]
pub async fn oauth_login(app: AppHandle) -> Result<AuthStatus, String> {
    let db = app.state::<AppDatabase>().0.clone();
    let status = start_oauth_login(db.clone(), &app).await?;
    tokio::spawn(async move {
        let _ = crate::sync::sync_to_server(db).await;
    });
    Ok(status)
}

/// ログアウトする（DB から JWT と認証情報を削除）。
#[tauri::command]
pub fn oauth_logout(app: AppHandle) -> Result<(), String> {
    let db = &app.state::<AppDatabase>().0;
    db.set_setting("auth_token", "")?;
    db.set_setting("auth_provider", "")?;
    db.set_setting("auth_display_name", "")?;
    Ok(())
}

/// 現在の認証状態を返す。未ログインの場合は None。
#[tauri::command]
pub fn get_auth_status(app: AppHandle) -> Result<Option<AuthStatus>, String> {
    let db = &app.state::<AppDatabase>().0;
    let token = db.get_setting("auth_token")?.unwrap_or_default();
    if token.is_empty() {
        return Ok(None);
    }
    Ok(Some(AuthStatus {
        display_name: db.get_setting("auth_display_name")?.unwrap_or_default(),
        provider: db.get_setting("auth_provider")?.unwrap_or_default(),
    }))
}
