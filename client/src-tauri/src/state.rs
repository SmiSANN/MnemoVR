//! Tauri の State として登録するアプリケーション全体の共有リソース。
//!
//! `app.manage(...)` で登録し、各コマンドからは
//! `app.state::<AppDatabase>().0` のようにアクセスする。

use crate::db::Database;
use notify::RecommendedWatcher;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// ローカル SQLite データベース。
pub struct AppDatabase(pub Arc<Database>);

/// サムネイルキャッシュなどの永続データを置く OS のアプリデータディレクトリ。
pub struct CacheDir(pub PathBuf);

/// VRChat 写真フォルダのファイル追加・削除を監視するウォッチャー。
/// 再スキャン時に差し替えるため Mutex で内部を可変にしている。
pub struct FileWatcher(pub Mutex<Option<RecommendedWatcher>>);

/// 「閉じるボタンでバックグラウンドに残す」設定のメモリキャッシュ。
/// DB から読み込んだ値をここに持ち、ウィンドウクローズイベントで参照する。
pub struct RunInBackground(pub Mutex<bool>);
