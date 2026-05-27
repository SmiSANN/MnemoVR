import { VRCHAT_USER_AGENT, WORLD_NAME_CACHE_TTL_MS } from "../constants";

/**
 * worlds テーブルのキャッシュを確認し、stale なら VRChat API から取得して更新する。
 * VRChat API が失敗した場合はキャッシュの古い値（または null）を返す。
 */
export async function resolveAndCacheWorldName(
  worldId: string,
  db: D1Database,
): Promise<string | null> {
  const cached = await db
    .prepare("SELECT world_name, updated_at FROM worlds WHERE world_id = ?")
    .bind(worldId)
    .first<{ world_name: string; updated_at: string }>();

  if (cached?.world_name) {
    const age = Date.now() - new Date(cached.updated_at).getTime();
    if (age < WORLD_NAME_CACHE_TTL_MS) return cached.world_name;
  }

  try {
    const resp = await fetch(
      `https://api.vrchat.cloud/api/1/worlds/${worldId}`,
      { headers: { "User-Agent": VRCHAT_USER_AGENT } },
    );
    if (!resp.ok) return cached?.world_name ?? null;

    const json = await resp.json<{ name?: string }>();
    const name = json.name ?? null;
    if (name) {
      await db
        .prepare(
          `INSERT OR REPLACE INTO worlds (world_id, world_name, updated_at)
           VALUES (?, ?, CURRENT_TIMESTAMP)`,
        )
        .bind(worldId, name)
        .run();
    }
    return name;
  } catch {
    return cached?.world_name ?? null;
  }
}

/** updated_at が stale（TTL 超過）かどうかを判定。 */
export function isWorldNameStale(updatedAt: string | null): boolean {
  if (!updatedAt) return true;
  return Date.now() - new Date(updatedAt).getTime() > WORLD_NAME_CACHE_TTL_MS;
}
