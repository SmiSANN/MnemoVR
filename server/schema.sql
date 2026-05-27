-- MnemoVR サーバー DBスキーマ
-- 初回セットアップ: wrangler d1 execute mnemovr-db --local --file=schema.sql
-- 本番:             wrangler d1 execute mnemovr-db --file=schema.sql

-- ワールド情報キャッシュ
CREATE TABLE IF NOT EXISTS worlds (
    world_id TEXT PRIMARY KEY,
    world_name TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- OAuth認証済みユーザー
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    is_banned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_user_id)
);

-- 既存DBへのマイグレーション（カラムが存在しない場合のみ実行）
-- wrangler d1 execute mnemovr-db --file=schema.sql で適用
-- ※ D1 は IF NOT EXISTS が使えないため手動で一度だけ実行:
--   ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0;

-- ワールド訪問記録（1ユーザー × 1ワールド = 1行、最終訪問日で時間窓フィルタ）
CREATE TABLE IF NOT EXISTS world_visits (
    world_id TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    last_visited_date TEXT NOT NULL,  -- YYYY-MM-DD (JST)
    photo_count INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(world_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_world_last_visited ON world_visits(world_id, last_visited_date);
