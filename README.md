<div align="center">

<img src="client/src-tauri/icons/128x128@2x.png" width="120" height="120" alt="MnemoVR icon" />

# MnemoVR

**VRChat のローカル写真を、撮った場所と時間ごとに整理するデスクトップアプリ**

![platform](https://img.shields.io/badge/platform-Windows-0078D6)
![license](https://img.shields.io/badge/license-MIT-green)
![built with Tauri](https://img.shields.io/badge/built%20with-Tauri%20v2-FFC131)


</div>

---

## これは何？

MnemoVR は、PC に保存された VRChat の写真（`VRChat_*.png`）を自動で読み込み、**カレンダー・ワールド・お気に入り**などの切り口で振り返れるデスクトップアプリです。写真に記録された情報からワールド名や撮影日時を読み取り、訪れた場所ごとに思い出を整理します。

さらに Discord ログインすると、**「いまコミュニティで多く写真に撮られているワールド」のランキング**を閲覧でき、自分の記録もその集計に加わります。次に行く撮影スポット探しに使えます（ログインせずゲストとして写真管理だけ使うことも可能です）。

## 主な機能

### 📸 撮影記録の整理と活用
- **自動取り込み**: 起動するだけで、新しく撮った写真をまとめて取り込み
- **撮影情報の表示**: 写真に記録されたワールド名・撮影日時を自動で読み取り、どこで・いつ撮ったかを一覧で確認
- **VRChat 用 URL を即発行**: 写真をアップロードして VRChat 内でそのまま使える画像 URL をその場で生成
- **お気に入り登録**: 気に入った写真にワンクリックでフラグを立て、専用ビューでまとめて確認

<table>
  <tr>
    <td><img src="photo/Photo.png" alt="写真一覧" /></td>
    <td><img src="photo/Like.png" alt="お気に入りビュー" /></td>
  </tr>
</table>

### 🗂️ 2 つのビューで振り返る
| ビュー | 内容 |
|---|---|
| 📅 カレンダー | 月別・年別に写真を一覧 |
| 🌐 ワールド | 訪れたワールドごとに写真をまとめて表示 |

<table>
  <tr>
    <td><img src="photo/Calendar.png" alt="カレンダービュー" /></td>
    <td><img src="photo/World.png" alt="ワールドビュー" /></td>
  </tr>
</table>

### 🏆 ワールドランキング
「どのワールドが、いま多くの人に写真に撮られているか」を利用者全体で集計して表示します。VRChat の人気・話題の撮影スポットを見つけるのに使えます。

- **3 つの期間**: デイリー / ウィークリー / 歴代（All-time）
- **スコア**: そのワールドで写真を撮った人数（多いほど上位）
- 一覧の行をクリックすると VRChat のワールドページを開けます
- 利用には Discord ログインが必要。ランキングの集計のためにサーバーへ送られるのは**ワールド単位の数値（ワールドID・日付・枚数）だけ**で、写真そのものは送信されません
- ゲストモードでも、ランキング以外の機能はすべて利用できます

<img src="photo/Ranking.png" width="800" alt="ワールドランキング" />

## ダウンロード

<!-- TODO: GitHub Releases ページへのリンクに差し替える -->
最新版は [Releases](../../releases) からダウンロードできます。

## 使い方

1. インストーラを実行して MnemoVR を起動
2. 初回起動時に **利用規約に同意**
3. **Discord ログイン**（ランキング機能を使う）か **ゲスト**（写真管理のみ）を選択
4. 既定の写真フォルダ（`ピクチャ\VRChat`）が自動で読み込まれ、カレンダー / ワールド / お気に入りから写真を振り返れます。別の場所に保存している場合は設定画面でフォルダを指定できます

<!-- TODO: オンボーディング画面のスクリーンショット -->

<br />

---

<br />

# 開発者向けドキュメント

VRChat 写真整理デスクトップアプリ（Tauri + React + Rust）と、ランキング同期用の Cloudflare Workers API を同一リポジトリで管理しています。

- **クライアント**: ローカル写真スキャン・整理、カレンダー/ワールド/お気に入り/ランキング表示、Discord OAuth ログイン
- **サーバー**: 同期 API、ランキング API、Discord トークン検証と JWT 発行
- **同期**: HMAC 署名 + JWT で保護し、ワールド単位の集計ログを送信

## 技術スタック

| レイヤー | 使用技術 |
|---|---|
| Desktop | Tauri v2 |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Zustand, React Router |
| Local backend | Rust, rusqlite (SQLite), tokio, notify, image, quick-xml |
| Server | Cloudflare Workers, Hono, D1 |

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

## ライセンス

[MIT License](LICENSE) © 2026 SmiSANN
