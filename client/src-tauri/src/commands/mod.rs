//! フロントエンドから `invoke()` で呼ばれる Tauri コマンドの集合。
//! ドメインごとに 4 ファイルに分割している:
//!
//! - `photos`   : 写真ライブラリ操作（スキャン・お気に入り・ワールド名）
//! - `storage`  : 設定・キャッシュ・サムネイル
//! - `auth`     : OAuth ログイン
//! - `server`   : サーバー連携（同期・ランキング・アップロード・更新確認）

pub mod auth;
pub mod autostart;
pub mod photos;
pub mod server;
pub mod storage;
