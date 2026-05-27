/** API のレスポンスキャッシュ（Cache API、秒） */
export const RANKINGS_CACHE_S_MAXAGE = 600; // 10分
export const VERSION_CACHE_S_MAXAGE = 600;  // 10分

/** worlds テーブルのキャッシュ TTL（VRChat API 再取得までの時間、ミリ秒） */
export const WORLD_NAME_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7日

/** JWT の有効期限（秒） */
export const JWT_EXPIRES_IN_S = 60 * 60 * 24 * 30; // 30日

/** VRChat API へのリクエストに付与する User-Agent */
export const VRCHAT_USER_AGENT = "MnemoVR/0.1.0";

/** ランキングの 1 カテゴリあたりの最大返却件数 */
export const RANKING_LIMIT = 20;
