import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";
import { verifyHmac } from "../hmac";

/**
 * X-Signature ヘッダーの HMAC-SHA256 署名を検証するミドルウェア。
 * 検証成功時は c.set("rawBody", body) で生のリクエストボディを下流に渡す。
 * 署名なし・不一致なら 401 を返す。
 */
export const hmacGuard: MiddlewareHandler<{
  Bindings: Env;
  Variables: { rawBody: string };
}> = async (c, next) => {
  const signature = c.req.header("X-Signature");
  if (!signature) {
    return c.json({ error: "Missing signature" }, 401);
  }

  const rawBody = await c.req.text();
  const valid = await verifyHmac(c.env.HMAC_SECRET, rawBody, signature);
  if (!valid) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  c.set("rawBody", rawBody);
  await next();
};
