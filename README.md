# MnemoVR

VRChat のローカル写真を整理するデスクトップアプリ (Tauri + React + Rust) と、
ランキング同期用の Cloudflare Workers API を同一リポジトリで管理しています。

## 概要

- **クライアント**: ローカル写真スキャン・整理、カレンダー/ワールド/お気に入り/ランキング表示、Discord OAuth ログイン
- **サーバー**: 同期 API、ランキング API、Discord トークン検証と JWT 発行
- **同期**: HMAC 署名 + JWT で保護し、ワールド単位の集計ログを送信

## 主な機能

### 写真管理
- **フルスキャン**: ローカル写真 DB を再構築
- **差分スキャン**: 起動時に追加分のみ更新
- **ファイル監視**: `VRChat_*.png` の追加・削除を監視して UI を自動更新
- **ライトボックス**: 写真クリックでフルスクリーン表示・お気に入り切り替え

### ビュー
| パス | 内容 |
|---|---|
| `/calendar` | 月別・年別の写真カレンダー |
| `/worlds` | ワールドごとの写真一覧 |
| `/favorites` | お気に入り写真一覧 |
| `/ranking` | コミュニティワールドランキング |
| `/settings` | 各種設定 |

### ランキング・同期
- Discord ログインでランキングへのデータ提供・閲覧が可能
- ゲストモードでも写真管理は利用可能
- 変更のあったワールドのみ差分同期（スキャン後に自動実行）

### その他
- **初回オンボーディング**: 利用規約同意 → Discord ログイン / ゲスト選択
- **アップデート通知**: 新バージョン公開時に通知、バージョン単位でスキップ可能
- **バックグラウンド実行**: ウィンドウを閉じてもトレイに常駐
- **サムネイルキャッシュ**: JPEG サムネイルをローカルファイルにキャッシュ

## リポジトリ構成

```text
MnemoVR/
├── client/                  # Tauri デスクトップアプリ
│   ├── src/                 # React フロントエンド
│   │   ├── components/      # 共通コンポーネント
│   │   ├── views/           # 各ページ
│   │   ├── store/           # Zustand ストア
│   │   ├── lib/             # ユーティリティ・文字列定義
│   │   └── api/             # Tauri invoke ラッパー
│   ├── src-tauri/           # Rust バックエンド
│   └── package.json
├── server/                  # Cloudflare Workers API
│   ├── src/
│   │   └── routes/          # auth / sync / rankings / version
│   ├── schema.sql
│   ├── wrangler.toml
│   └── package.json
└── README.md
```

## 技術スタック

| レイヤー | 使用技術 |
|---|---|
| Desktop | Tauri v2 |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Zustand, React Router |
| Local backend | Rust, rusqlite (SQLite), tokio, notify, image, quick-xml |
| Server | Cloudflare Workers, Hono, D1 |

## セットアップ

### 前提

- Node.js 20+
- Rust stable
- Tauri 実行に必要な OS 依存パッケージ

### 1. クライアント

```bash
cd client
cp .env.example .env
npm install
npm run tauri dev
```

`client/.env` の主な変数:

| 変数 | 説明 |
|---|---|
| `HMAC_SECRET` | サーバーとの共有署名シークレット |
| `SYNC_API_URL` | 同期 API のエンドポイント |
| `VITE_SYNC_API_URL` | フロントエンド用同期 API URL |
| `DISCORD_CLIENT_ID` | Discord OAuth アプリの Client ID |

### 2. サーバー

```bash
cd server
cp .dev.vars.example .dev.vars
npm install
npm run dev
```

`server/.dev.vars` の主な変数:

| 変数 | 説明 |
|---|---|
| `HMAC_SECRET` | クライアントとの共有署名シークレット |
| `JWT_SECRET` | JWT 署名シークレット |
| `DISCORD_CLIENT_ID` | Discord OAuth アプリの Client ID |

## D1 スキーマとマイグレーション

ローカル:

```bash
cd server
wrangler d1 execute mnemovr-db --local --file=schema.sql
```

本番:

```bash
cd server
wrangler d1 execute mnemovr-db --file=schema.sql
```

`users.is_banned` を既存 DB に追加済みでない場合は一度だけ実行:

```bash
wrangler d1 execute mnemovr-db --command "ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0"
```

## API 概要

### POST /api/auth/callback

- 受け取り: `{ access_token }`
- 処理: Discord `/users/@me` で検証し、`users` に UPSERT、JWT を返却

### POST /api/sync

- ヘッダ: `X-Signature` (HMAC-SHA256), `Authorization: Bearer <jwt>`
- ボディ:

```json
{
  "logs": [
    {
      "world_id": "wrld_xxx",
      "last_visited_date": "2026-03-25",
      "photo_count": 12
    }
  ]
}
```

- BAN ユーザーは 403、`world_id + user_id` で UPSERT

### GET /api/rankings

- 返却: `daily`, `weekly`, `all_time`
- スコア: `COUNT(DISTINCT user_id)`
- ワールド名: `worlds` テーブルを 3 日 TTL でキャッシュ

### GET /api/version

- 最新リリースバージョンを返却（クライアントのアップデート確認用）

## データモデル

### クライアント SQLite

| テーブル | 内容 |
|---|---|
| `photos` | 写真メタデータ (パス, ワールド名, 撮影日時, お気に入りフラグ等) |
| `settings` | 設定キー値ストア |
| `image_url_cache` | アップロード済み画像 URL キャッシュ (3 日 TTL) |

### サーバー D1

| テーブル | 内容 |
|---|---|
| `users` | OAuth ユーザー (`is_banned` あり) |
| `world_visits` | ユーザー x ワールドの訪問集計 |
| `worlds` | ワールド名キャッシュ |

## キャッシュ仕様

| 種別 | 場所 | 内容 |
|---|---|---|
| フロントメモリ | React state | サムネイル URL (`thumbCache`) |
| ローカルファイル | `thumbnails/` ディレクトリ | サムネイル JPEG |
| ローカル DB | `image_url_cache` | アップロード済み画像 URL (3 日 TTL) |
| サーバー DB | `worlds.updated_at` | ワールド名 (3 日 TTL) |

設定画面の「サムネイル・アップロードURLキャッシュの削除」でサムネイルファイルと `image_url_cache` を同時に削除できます。

## 開発コマンド

### client

```bash
cd client
npm run dev          # Vite 開発サーバー単体起動
npm run tauri dev    # Tauri + Vite 同時起動
npm run build        # フロントエンドビルド
npm run tauri build  # デスクトップアプリビルド
npm run lint         # ESLint
```

### server

```bash
cd server
npm run dev          # ローカル Workers 起動
npm run deploy       # 本番デプロイ
npm run db:migrate   # D1 マイグレーション実行
```
