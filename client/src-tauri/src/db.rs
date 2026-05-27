use rusqlite::{params, Connection};
use std::path::Path;
use std::sync::Mutex;

use crate::scanner::PhotoRecord;

/// ローカルSQLiteデータベースへのアクセス層。
/// photos, settings の2テーブルを管理する。
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// DBを開き、テーブルとインデックスを初期化する。マイグレーションも実行。
    pub fn open(db_path: &Path) -> Result<Self, String> {
        // データディレクトリが存在しなければ作成
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create data dir: {e}"))?;
        }

        let conn =
            Connection::open(db_path).map_err(|e| format!("Failed to open database: {e}"))?;

        // テーブルとインデックスの作成（初回起動時のみ実効）
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS photos (
                id TEXT PRIMARY KEY,
                file_path TEXT UNIQUE NOT NULL,
                world_id TEXT,
                world_name TEXT,
                user_id TEXT,
                user_name TEXT,
                captured_at INTEGER NOT NULL,
                is_favorite INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_captured_at ON photos(captured_at);
            CREATE INDEX IF NOT EXISTS idx_world_id ON photos(world_id);

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            ",
        )
        .map_err(|e| format!("Failed to initialize database: {e}"))?;

        // マイグレーション: photos に user_name カラムがなければ追加
        let has_user_name: bool = conn
            .prepare("SELECT user_name FROM photos LIMIT 1")
            .is_ok();
        if !has_user_name {
            let _ = conn.execute("ALTER TABLE photos ADD COLUMN user_name TEXT", []);
        }

        // マイグレーション: world_name_cache テーブルを削除（不要になったため）
        let _ = conn.execute("DROP TABLE IF EXISTS world_name_cache", []);

        // マイグレーション: アップロード済み画像URLのキャッシュテーブル
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS image_url_cache (
                file_path TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                expires_at INTEGER NOT NULL
            );",
        )
        .map_err(|e| format!("Failed to create image_url_cache: {e}"))?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// 写真レコードをUPSERT（挿入 or 更新）する。file_pathの一致で既存判定。
    pub fn upsert_photo(&self, record: &PhotoRecord) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let rows = conn
            .execute(
                "INSERT INTO photos (id, file_path, world_id, world_name, user_id, user_name, captured_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(file_path)
                 DO UPDATE SET
                    world_id = excluded.world_id,
                    world_name = excluded.world_name,
                    user_id = excluded.user_id,
                    user_name = excluded.user_name,
                    captured_at = excluded.captured_at",
                params![
                    record.id,
                    record.file_path,
                    record.world_id,
                    record.world_name,
                    record.user_id,
                    record.user_name,
                    record.captured_at,
                ],
            )
            .map_err(|e| format!("Failed to upsert photo: {e}"))?;
        Ok(rows > 0)
    }

    /// DB内の最新の captured_at を取得する（差分スキャンの閾値として使用）。
    pub fn get_latest_captured_at(&self) -> Result<Option<i64>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let result: Option<i64> = conn
            .query_row("SELECT MAX(captured_at) FROM photos", [], |row| row.get(0))
            .map_err(|e| format!("Failed to query latest timestamp: {e}"))?;
        Ok(result)
    }

    /// 全写真レコードを撮影日時の降順で取得する。
    pub fn get_all_photos(&self) -> Result<Vec<PhotoRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, file_path, world_id, world_name, user_id, user_name, captured_at, is_favorite
                 FROM photos ORDER BY captured_at DESC",
            )
            .map_err(|e| format!("Failed to prepare query: {e}"))?;

        let records = stmt
            .query_map([], |row| {
                Ok(PhotoRecord {
                    id: row.get(0)?,
                    file_path: row.get(1)?,
                    world_id: row.get(2)?,
                    world_name: row.get(3)?,
                    user_id: row.get(4)?,
                    user_name: row.get(5)?,
                    captured_at: row.get(6)?,
                    is_favorite: row.get::<_, i32>(7)? != 0,
                })
            })
            .map_err(|e| format!("Failed to query photos: {e}"))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(records)
    }

    /// お気に入り状態をトグルし、新しい値を返す。
    pub fn toggle_favorite(&self, photo_id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE photos SET is_favorite = CASE WHEN is_favorite = 0 THEN 1 ELSE 0 END WHERE id = ?1",
            params![photo_id],
        )
        .map_err(|e| format!("Failed to toggle favorite: {e}"))?;

        let is_fav: bool = conn
            .query_row(
                "SELECT is_favorite FROM photos WHERE id = ?1",
                params![photo_id],
                |row| row.get::<_, i32>(0).map(|v| v != 0),
            )
            .map_err(|e| format!("Failed to read favorite status: {e}"))?;

        Ok(is_fav)
    }

    /// 全写真レコードを削除する（フルスキャン前のリセット用）。
    pub fn clear_photos(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM photos", [])
            .map_err(|e| format!("Failed to clear photos: {e}"))?;
        Ok(())
    }

    /// 同一 world_id の中で最新 captured_at を持つ写真の world_name を全写真に伝播させる。
    /// スキャン後に呼び出し、XMP の最新値を同一ワールドの全写真に反映する。
    pub fn propagate_world_name_from_newest(&self, world_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE photos SET world_name = (
                SELECT world_name FROM photos p2
                WHERE p2.world_id = ?1 AND p2.world_name IS NOT NULL
                ORDER BY p2.captured_at DESC LIMIT 1
             )
             WHERE world_id = ?1",
            params![world_id],
        )
        .map_err(|e| format!("Failed to propagate world name: {e}"))?;
        Ok(())
    }

    /// サーバーから受け取った最新ワールド名で同一 world_id の全写真を上書きする。
    pub fn update_world_name_by_world_id(
        &self,
        world_id: &str,
        world_name: &str,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE photos SET world_name = ?2 WHERE world_id = ?1",
            params![world_id, world_name],
        )
        .map_err(|e| format!("Failed to update world name: {e}"))?;
        Ok(())
    }

    /// 設定値を取得する。キーが存在しなければNone。
    pub fn get_setting(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let result = conn
            .query_row(
                "SELECT value FROM settings WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .ok();
        Ok(result)
    }

    /// 設定値を保存する（INSERT OR REPLACE）。
    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )
        .map_err(|e| format!("Failed to set setting: {e}"))?;
        Ok(())
    }

    /// DB内の全写真ファイルパスを取得する（存在チェック・パージ用）。
    pub fn get_all_photo_paths(&self) -> Result<Vec<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT file_path FROM photos")
            .map_err(|e| format!("Failed to prepare query: {e}"))?;
        let paths = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| format!("Failed to query paths: {e}"))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(paths)
    }

    /// ファイルパスで写真レコードを削除する（ファイル削除検知時に使用）。
    pub fn delete_photo_by_path(&self, file_path: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM photos WHERE file_path = ?1", params![file_path])
            .map_err(|e| format!("Failed to delete photo: {e}"))?;
        Ok(())
    }

    /// アップロード済み画像の公開URLをキャッシュから取得する。期限切れなら None。
    pub fn get_cached_image_url(&self, file_path: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        let result = conn
            .query_row(
                "SELECT url FROM image_url_cache WHERE file_path = ?1 AND expires_at > ?2",
                params![file_path, now],
                |row| row.get(0),
            )
            .ok();
        Ok(result)
    }

    /// アップロード済み画像の公開URLを3日間キャッシュする。
    pub fn set_cached_image_url(&self, file_path: &str, url: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let expires_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64 + 3 * 24 * 60 * 60 * 1000)
            .unwrap_or(0);
        conn.execute(
            "INSERT OR REPLACE INTO image_url_cache (file_path, url, expires_at) VALUES (?1, ?2, ?3)",
            params![file_path, url, expires_at],
        )
        .map_err(|e| format!("Failed to cache image url: {e}"))?;
        Ok(())
    }

    /// アップロード済み画像URLキャッシュを全削除する。
    pub fn clear_cached_image_urls(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM image_url_cache", [])
            .map_err(|e| format!("Failed to clear image URL cache: {e}"))?;
        Ok(())
    }

    /// 指定ファイルパスがDB内に存在するか確認する（差分スキャンのスキップ判定用）。
    pub fn file_exists(&self, file_path: &str) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM photos WHERE file_path = ?1",
                params![file_path],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to check file existence: {e}"))?;
        Ok(count > 0)
    }
}
