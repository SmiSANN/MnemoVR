import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";
import { verifyJwt, type JwtPayload } from "../jwt";
import { isUserBanned } from "../db/users";

/**
 * Authorization: Bearer ヘッダーの JWT を検証するミドルウェア。
 * 検証成功時は c.set("jwt", payload) で下流ハンドラに渡す。
 * BAN 判定は JWT 内の値ではなく毎回 DB を参照する（発行後の BAN を即時反映するため）。
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
  // JWT は最大 30 日有効なので、発行後に BAN されても古いトークンが残る。
  // 取りこぼしを防ぐため、トークンの is_banned ではなく DB の最新状態で判定する。
  if (await isUserBanned(c.env.DB, payload.user_id)) {
    return c.json({ error: "Account suspended" }, 403);
  }

  c.set("jwt", payload);
  await next();
};
