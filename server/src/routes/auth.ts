import { Hono } from "hono";
import type { Env } from "../types";
import { signJwt } from "../jwt";
import {
  JWT_EXPIRES_IN_S,
  RATE_LIMIT_AUTH_MAX,
  RATE_LIMIT_AUTH_WINDOW_S,
} from "../constants";
import {
  exchangeDiscordCode,
  fetchDiscordUser,
  pickDiscordDisplayName,
} from "../providers/discord";
import { isUserBanned, upsertUser } from "../db/users";
import { rateLimit } from "../middleware/rateLimit";

export const authRoute = new Hono<{ Bindings: Env }>();

interface DiscordCallbackBody {
  code: string;
  redirect_uri: string;
  code_verifier: string;
}

/**
 * POST /api/auth/callback — Discord PKCE フローを完了し、サーバー発行 JWT を返す。
 * 処理の流れ:
 *   1. クライアントから受け取った code + code_verifier で Discord とトークン交換
 *   2. Discord ユーザー情報を取得
 *   3. users テーブルに UPSERT
 *   4. BAN チェック
 *   5. JWT を発行して返す
 */
authRoute.post(
  "/auth/callback",
  rateLimit({
    route: "auth",
    max: RATE_LIMIT_AUTH_MAX,
    windowSeconds: RATE_LIMIT_AUTH_WINDOW_S,
  }),
  async (c) => {
  let body: DiscordCallbackBody;
  try {
    body = await c.req.json<DiscordCallbackBody>();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  if (!body.code || !body.redirect_uri || !body.code_verifier) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  let accessToken: string;
  try {
    accessToken = await exchangeDiscordCode({
      clientId: c.env.DISCORD_CLIENT_ID,
      clientSecret: c.env.DISCORD_CLIENT_SECRET,
      code: body.code,
      redirectUri: body.redirect_uri,
      codeVerifier: body.code_verifier,
    });
  } catch (e) {
    // 詳細（Discord の生エラー）はサーバーログのみに残し、クライアントには汎用メッセージを返す
    console.error("Discord token exchange failed:", e);
    return c.json({ error: "Authentication failed" }, 401);
  }

  let user;
  try {
    user = await fetchDiscordUser(accessToken);
  } catch (e) {
    console.error("Discord user fetch failed:", e);
    return c.json({ error: "Authentication failed" }, 401);
  }

  const displayName = pickDiscordDisplayName(user);

  let userId: number;
  try {
    userId = await upsertUser(c.env.DB, "discord", user.id, displayName);
  } catch (e) {
    console.error("User upsert failed:", e);
    return c.json({ error: "Internal error" }, 500);
  }

  if (await isUserBanned(c.env.DB, userId)) {
    return c.json({ error: "Account suspended" }, 403);
  }

  const token = await signJwt(
    {
      user_id: userId,
      provider: "discord",
      display_name: displayName,
      is_banned: false,
      exp: Math.floor(Date.now() / 1000) + JWT_EXPIRES_IN_S,
    },
    c.env.JWT_SECRET,
  );

  return c.json({ token, display_name: displayName });
});
