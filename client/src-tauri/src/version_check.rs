//! アプリの新バージョン確認モジュール。
//!
//! 他の Tauri アプリでも流用できる単独モジュールに切り出している。
//! 依存：
//!   - 任意のサーバーが `GET <endpoint>` で `{"version": "x.y.z"}` JSON を返すこと
//!   - CARGO_PKG_VERSION から現行バージョンを取得すること
//!
//! 失敗時は None を返し、起動を妨げない設計。

/// `endpoint` から最新バージョン文字列を取り、現行 `current` より新しければ
/// `v<最新バージョン>` を返す。最新版・取得失敗時は None。
pub async fn check_for_update(endpoint: &str, current: &str) -> Option<String> {
    let resp = reqwest::Client::new().get(endpoint).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let json: serde_json::Value = resp.json().await.ok()?;
    let latest = json.get("version")?.as_str()?;
    if is_newer_version(latest, current) {
        Some(format!("v{latest}"))
    } else {
        None
    }
}

/// semver `major.minor.patch` を数値比較し、`candidate` が `current` より新しければ true。
/// プレリリースタグ・ビルドメタデータは無視する単純比較。
pub fn is_newer_version(candidate: &str, current: &str) -> bool {
    parse_semver(candidate) > parse_semver(current)
}

fn parse_semver(s: &str) -> (u32, u32, u32) {
    let mut parts = s.splitn(3, '.').map(|p| p.parse::<u32>().unwrap_or(0));
    (
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn newer_patch() {
        assert!(is_newer_version("0.1.7", "0.1.6"));
    }

    #[test]
    fn newer_minor() {
        assert!(is_newer_version("0.2.0", "0.1.99"));
    }

    #[test]
    fn newer_major() {
        assert!(is_newer_version("1.0.0", "0.99.99"));
    }

    #[test]
    fn same_or_older() {
        assert!(!is_newer_version("0.1.6", "0.1.6"));
        assert!(!is_newer_version("0.1.5", "0.1.6"));
    }

    #[test]
    fn malformed_treated_as_zero() {
        // 不正な値は 0 として扱う
        assert!(!is_newer_version("garbage", "0.0.1"));
    }
}
