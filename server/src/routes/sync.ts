import { Hono } from "hono";
import type { Env } from "../types";
import type { JwtPayload } from "../jwt";
import { hmacGuard } from "../middleware/hmac";
import { jwtGuard } from "../middleware/jwt";
import { rateLimit } from "../middleware/rateLimit";
import {
  RATE_LIMIT_SYNC_MAX,
  RATE_LIMIT_SYNC_WINDOW_S,
  WORLD_RESOLVE_CONCURRENCY,
} from "../constants";
import { getUserDiscordInfo } from "../db/users";
import { sendInvalidWorldAlert, worldExists } from "../providers/webhook";
import { mapWithConcurrency } from "../util/concurrency";

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

/** world_id の形式（wrld_ + UUID）を厳密に検証する正規表現。 */
const WORLD_ID_RE = /^wrld_[0-9a-fA-F-]{36}$/;
/** YYYY-MM-DD 形式の日付。 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** photo_count の上限（異常値の混入を防ぐ）。 */
const MAX_PHOTO_COUNT = 1_000_000;

/** JST 基準の今日の日付（YYYY-MM-DD）を返す。 */
function todayJst(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

/** 1 件のログをバリデーション。エラー時はメッセージを返す（成功時は null）。 */
function validateLog(log: unknown, today: string): string | null {
  if (typeof log !== "object" || log === null) {
    return "Invalid log entry";
  }
  const { world_id, last_visited_date, photo_count } = log as Record<string, unknown>;

  if (typeof world_id !== "string" || !WORLD_ID_RE.test(world_id)) {
    return `Invalid world_id: ${String(world_id)}`;
  }
  if (typeof last_visited_date !== "string" || !DATE_RE.test(last_visited_date)) {
    return `Invalid date: ${String(last_visited_date)}`;
  }
  if (last_visited_date > today) {
    return `Future date not allowed: ${last_visited_date}`;
  }
  if (
    typeof photo_count !== "number" ||
    !Number.isInteger(photo_count) ||
    photo_count < 0 ||
    photo_count > MAX_PHOTO_COUNT
  ) {
    return `Invalid photo_count: ${String(photo_count)}`;
  }
  return null;
}

/**
 * 同期されたワールドのうち、VRChat に存在しないものを検知し、
 * 該当ユーザーの Discord 情報を Webhook で通知したうえで、
 * その不正レコードを world_visits から削除する。
 * （sync レスポンスをブロックしないよう waitUntil で非同期実行する）
 */
async function detectAndReportInvalidWorlds(
  c: { env: Env },
  userId: number,
  worldIds: string[],
): Promise<void> {
  if (worldIds.length === 0) return;

  // すでに worlds テーブルに存在する＝検証済みの正規ワールドは確認をスキップ
  const placeholders = worldIds.map(() => "?").join(",");
  const knownRows = await c.env.DB.prepare(
    `SELECT world_id FROM worlds WHERE world_id IN (${placeholders})`,
  )
    .bind(...worldIds)
    .all<{ world_id: string }>();
  const known = new Set(knownRows.results.map((r) => r.world_id));

  const candidates = worldIds.filter((id) => !known.has(id));
  if (candidates.length === 0) return;

  // VRChat に問い合わせ、404（存在しない）のものだけを不正として収集
  const checks = await mapWithConcurrency(
    candidates,
    WORLD_RESOLVE_CONCURRENCY,
    async (id) => ({ id, exists: await worldExists(id) }),
  );
  const invalid = checks.filter((r) => r.exists === false).map((r) => r.id);
  if (invalid.length === 0) return;

  // 不正レコードを削除
  const delPlaceholders = invalid.map(() => "?").join(",");
  await c.env.DB.prepare(
    `DELETE FROM world_visits WHERE user_id = ? AND world_id IN (${delPlaceholders})`,
  )
    .bind(userId, ...invalid)
    .run();

  // Discord に通知
  const info = await getUserDiscordInfo(c.env.DB, userId);
  await sendInvalidWorldAlert(c.env.DISCORD_ALERT_WEBHOOK_URL, {
    discordUsername: info?.displayName ?? "(unknown)",
    discordId: info?.providerUserId ?? String(userId),
    worldIds: invalid,
  });
}

/**
 * POST /api/sync — クライアントの訪問ログを受信・保存する。
 * 認証は hmacGuard（正規クライアント証明）+ jwtGuard（ユーザー識別）の二段階。
 */
syncRoute.post(
  "/sync",
  rateLimit({
    route: "sync",
    max: RATE_LIMIT_SYNC_MAX,
    windowSeconds: RATE_LIMIT_SYNC_WINDOW_S,
  }),
  hmacGuard,
  jwtGuard,
  async (c) => {
    const rawBody = c.get("rawBody");
    const userId = c.get("jwt").user_id;

    let payload: SyncPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    if (!payload || !Array.isArray(payload.logs)) {
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

    // 存在しないワールドの検知・通知・削除はレスポンスをブロックせず非同期で実行
    const worldIds = [...new Set(payload.logs.map((l) => l.world_id))];
    c.executionCtx.waitUntil(
      detectAndReportInvalidWorlds(c, userId, worldIds).catch((e) =>
        console.error("invalid-world detection failed:", e),
      ),
    );

    return c.json({ success: true, inserted: payload.logs.length });
  },
);
