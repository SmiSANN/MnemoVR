//! Windows スタートアップ登録コマンド。
//! HKCU\...\Run レジストリキーを reg.exe 経由で操作する。

use crate::state::AppDatabase;
use tauri::{AppHandle, Manager};

/// スタートアップ登録の現在状態を返す。
/// reg.exe のサブプロセス起動はブロッキングなので spawn_blocking で実行する。
#[tauri::command]
pub async fn get_autostart_enabled() -> bool {
    tokio::task::spawn_blocking(|| {
        std::process::Command::new("reg")
            .args([
                "query",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "MnemoVR",
            ])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    })
    .await
    .unwrap_or(false)
}

/// スタートアップ登録を有効/無効にする。
/// 有効時は `"<exe>" --autostart` をレジストリに登録する。
/// reg.exe のサブプロセス起動はブロッキングなので spawn_blocking で実行する。
#[tauri::command]
pub async fn set_autostart_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    let exe = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();

    tokio::task::spawn_blocking(move || -> Result<(), String> {
        if enabled {
            let value = format!("\"{}\" --autostart", exe);
            let out = std::process::Command::new("reg")
                .args([
                    "add",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v",
                    "MnemoVR",
                    "/t",
                    "REG_SZ",
                    "/d",
                    &value,
                    "/f",
                ])
                .output()
                .map_err(|e| e.to_string())?;
            if !out.status.success() {
                return Err(String::from_utf8_lossy(&out.stderr).to_string());
            }
        } else {
            let _ = std::process::Command::new("reg")
                .args([
                    "delete",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v",
                    "MnemoVR",
                    "/f",
                ])
                .output();
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())??;

    app.state::<AppDatabase>()
        .0
        .set_setting("autostart_enabled", if enabled { "1" } else { "0" })
        .ok();

    Ok(())
}
