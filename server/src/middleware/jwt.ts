import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";
import { verifyJwt, type JwtPayload } from "../jwt";

/**
 * Authorization: Bearer ヘッダーの JWT を検証するミドルウェア。
 * 検証成功時は c.set("jwt", payload) で下流ハンドラに渡す。
 * BAN 済みユーザーは 403 を返す。
 */
export const jwtGuard: MiddlewareHandler<{
  Bindings: Env;
  Variables: { jwt: JwtPayload };
}> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Login required" }, 401);
  }
  const token = authHeader.slice(7);
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
  if (payload.is_banned) {
    return c.json({ error: "Account suspended" }, 403);
  }

  c.set("jwt", payload);
  await next();
};
