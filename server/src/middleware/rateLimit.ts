import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";

/**
 * D1 を使った固定ウィンドウ方式のシンプルなレート制限ミドルウェア。
 *
 * キーは `route:ip:windowIndex` で、ウィンドウごとに別レコードになるため
 * リセット処理が不要。古いレコードは確率的に掃除する。
 *
 * クライアント IP は Cloudflare の `CF-Connecting-IP` を使用する。
 */
export function rateLimit(opts: {
  route: string;
  max: number;
  windowSeconds: number;
}): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const ip =
      c.req.header("CF-Connecting-IP") ??
      c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
      "unknown";

    const nowSec = Math.floor(Date.now() / 1000);
    const windowIndex = Math.floor(nowSec / opts.windowSeconds);
    const key = `${opts.route}:${ip}:${windowIndex}`;
    const expiresAt = (windowIndex + 1) * opts.windowSeconds;

    try {
      const row = await c.env.DB.prepare(
        `INSERT INTO rate_limits (k, count, expires_at) VALUES (?, 1, ?)
         ON CONFLICT(k) DO UPDATE SET count = count + 1
         RETURNING count`,
      )
        .bind(key, expiresAt)
        .first<{ count: number }>();

      // 期限切れレコードの掃除（毎回やると重いので確率的に実行）
      if (Math.random() < 0.02) {
        c.executionCtx.waitUntil(
          c.env.DB.prepare("DELETE FROM rate_limits WHERE expires_at < ?")
            .bind(nowSec)
            .run()
            .then(() => undefined)
            .catch(() => undefined),
        );
      }

      if (row && row.count > opts.max) {
        return c.json({ error: "Too many requests" }, 429);
      }
    } catch {
      // レート制限テーブル未作成などの障害時は、機能停止を避けるため通過させる
    }

    await next();
  };
}
