import { Hono } from "hono";
import type { Env } from "../types";
import { RANKINGS_CACHE_S_MAXAGE, RANKING_LIMIT } from "../constants";
import { isWorldNameStale, resolveAndCacheWorldName } from "../db/worlds";

interface RankingRow {
  world_id: string;
  world_name: string | null;
  updated_at: string | null;
  score: number;
}

interface RankingEntryOut {
  world_id: string;
  world_name: string | null;
  score: number;
}

export const rankingsRoute = new Hono<{ Bindings: Env }>();

const RANKINGS_CACHE_KEY = new Request("https://mnemovr-cache/api/rankings");

// 共通の集計クエリ（period の WHERE 句のみ可変）。
// スコア = COUNT(DISTINCT user_id)。BAN 済みユーザーは除外。
const BASE_QUERY = `
  SELECT wv.world_id, w.world_name, w.updated_at, COUNT(DISTINCT wv.user_id) as score
  FROM world_visits wv
  LEFT JOIN worlds w ON wv.world_id = w.world_id
  JOIN users u ON wv.user_id = u.id AND u.is_banned = 0
`;
const GROUP_ORDER = `
  GROUP BY wv.world_id
  ORDER BY score DESC
  LIMIT ${RANKING_LIMIT}
`;

/** JST 基準の period 用 WHERE 句を組み立てる。空文字なら全期間。 */
function periodWhere(period: "daily" | "weekly" | "all"): string {
  switch (period) {
    case "daily":
      return "WHERE wv.last_visited_date >= date('now', '+9 hours', '-1 day')";
    case "weekly":
      return "WHERE wv.last_visited_date >= date('now', '+9 hours', '-7 days')";
    case "all":
      return "";
  }
}

function fetchPeriod(
  db: D1Database,
  period: "daily" | "weekly" | "all",
): Promise<D1Result<RankingRow>> {
  return db
    .prepare(`${BASE_QUERY} ${periodWhere(period)} ${GROUP_ORDER}`)
    .all<RankingRow>();
}

/**
 * GET /api/rankings — デイリー・ウィークリー・全期間ランキングを返す。
 * ワールド名は worlds テーブルキャッシュを優先し、stale なら VRChat API で更新。
 * レスポンスは Cache API で 10 分キャッシュ。
 */
rankingsRoute.get("/rankings", async (c) => {
  const cache = caches.default;
  const cached = await cache.match(RANKINGS_CACHE_KEY);
  if (cached) return new Response(cached.body, cached);

  const [daily, weekly, allTime] = await Promise.all([
    fetchPeriod(c.env.DB, "daily"),
    fetchPeriod(c.env.DB, "weekly"),
    fetchPeriod(c.env.DB, "all"),
  ]);

  const allRows = [...daily.results, ...weekly.results, ...allTime.results];
  const idsToResolve = [
    ...new Set(
      allRows
        .filter((r) => !r.world_name || isWorldNameStale(r.updated_at))
        .map((r) => r.world_id),
    ),
  ];

  const resolved = new Map<string, string | null>();
  await Promise.all(
    idsToResolve.map(async (id) => {
      resolved.set(id, await resolveAndCacheWorldName(id, c.env.DB));
    }),
  );

  const fill = (rows: RankingRow[]): RankingEntryOut[] =>
    rows.map(({ world_id, world_name, score }) => ({
      world_id,
      world_name: resolved.get(world_id) ?? world_name,
      score,
    }));

  const response = c.json({
    daily: fill(daily.results),
    weekly: fill(weekly.results),
    all_time: fill(allTime.results),
  });

  const res = new Response(response.body, response);
  res.headers.set("Cache-Control", `s-maxage=${RANKINGS_CACHE_S_MAXAGE}`);
  c.executionCtx.waitUntil(cache.put(RANKINGS_CACHE_KEY, res.clone()));
  return res;
});
