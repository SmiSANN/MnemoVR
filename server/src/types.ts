/**
 * Cloudflare Workers の環境変数バインディング。
 * wrangler.toml の [vars] と Secrets で定義された値。
 */
export type Env = {
  DB: D1Database;
  HMAC_SECRET: string;           // HMAC署名検証用シークレット（正規クライアント確認）
  JWT_SECRET: string;            // JWTの署名・検証に使用するシークレット
  DISCORD_CLIENT_ID: string;     // Discord OAuth アプリのクライアントID（公開情報）
  DISCORD_CLIENT_SECRET: string; // Discord OAuth アプリのクライアントシークレット（サーバー専用）
};
