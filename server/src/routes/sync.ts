import { Hono } from "hono";
import type { Env } from "../types";
import type { JwtPayload } from "../jwt";
import { hmacGuard } from "../middleware/hmac";
import { jwtGuard } from "../middleware/jwt";

interface SyncLog {
  world_id: string;
  last_visited_date: string; // YYYY-MM-DD (JST) 最終訪問日
  photo_count: number;       // 累計写真枚数
}

interface SyncPayload {
  logs: SyncLog[];
}

type SyncContext = {
  Bindings: Env;
  Variables: { rawBody: string; jwt: JwtPayload };
};

export const syncRoute = new Hono<SyncContext>();

/** JST 基準の今日の日付（YYYY-MM-DD）を返す。 */
function todayJst(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

/** 1 件のログをバリデーション。エラー時はメッセージを返す（成功時は null）。 */
function validateLog(log: SyncLog, today: string): string | null {
  if (!log.world_id.startsWith("wrld_")) {
    return `Invalid world_id: ${log.world_id}`;
  }
  if (log.last_visited_date > today) {
    return `Future date not allowed: ${log.last_visited_date}`;
  }
  return null;
}

/**
 * POST /api/sync — クライアントの訪問ログを受信・保存する。
 * 認証は hmacGuard（正規クライアント証明）+ jwtGuard（ユーザー識別）の二段階。
 */
syncRoute.post("/sync", hmacGuard, jwtGuard, async (c) => {
  const rawBody = c.get("rawBody");
  const userId = c.get("jwt").user_id;

  let payload: SyncPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  if (!Array.isArray(payload.logs)) {
    return c.json({ error: "Invalid payload structure" }, 400);
  }

  const today = todayJst();
  for (const log of payload.logs) {
    const err = validateLog(log, today);
    if (err) return c.json({ error: err }, 400);
  }

  // 同一ワールド×ユーザー×日付の重複は photo_count を上書き
  const stmt = c.env.DB.prepare(`
    INSERT INTO world_visits (world_id, user_id, last_visited_date, photo_count)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(world_id, user_id)
    DO UPDATE SET
      last_visited_date = excluded.last_visited_date,
      photo_count = excluded.photo_count,
      updated_at = CURRENT_TIMESTAMP
  `);
  const batch = payload.logs.map((log) =>
    stmt.bind(log.world_id, userId, log.last_visited_date, log.photo_count),
  );
  await c.env.DB.batch(batch);

  return c.json({ success: true, inserted: payload.logs.length });
});
