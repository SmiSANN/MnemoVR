/**
 * users テーブルへのアクセス層。
 * プロバイダー（discord, google など）+ プロバイダーユーザーID で一意。
 */

export interface UserRow {
  id: number;
  is_banned: number;
}

/**
 * ユーザーを UPSERT する（display_name は最新値で上書き）。
 * 戻り値は内部の users.id。
 */
export async function upsertUser(
  db: D1Database,
  provider: string,
  providerUserId: string,
  displayName: string,
): Promise<number> {
  await db
    .prepare(
      `INSERT INTO users (provider, provider_user_id, display_name)
       VALUES (?, ?, ?)
       ON CONFLICT(provider, provider_user_id)
       DO UPDATE SET display_name = excluded.display_name`,
    )
    .bind(provider, providerUserId, displayName)
    .run();

  const row = await db
    .prepare(
      "SELECT id FROM users WHERE provider = ? AND provider_user_id = ?",
    )
    .bind(provider, providerUserId)
    .first<{ id: number }>();

  if (!row) {
    throw new Error("Failed to create user record");
  }
  return row.id;
}

/** ユーザーが BAN されているかを確認する。 */
export async function isUserBanned(db: D1Database, userId: number): Promise<boolean> {
  const row = await db
    .prepare("SELECT is_banned FROM users WHERE id = ?")
    .bind(userId)
    .first<{ is_banned: number }>();
  return Boolean(row?.is_banned);
}

/** Webhook 通知用に、内部 user_id から Discord の表示名・プロバイダーユーザーIDを取得する。 */
export async function getUserDiscordInfo(
  db: D1Database,
  userId: number,
): Promise<{ providerUserId: string; displayName: string } | null> {
  const row = await db
    .prepare("SELECT provider_user_id, display_name FROM users WHERE id = ?")
    .bind(userId)
    .first<{ provider_user_id: string; display_name: string }>();
  if (!row) return null;
  return { providerUserId: row.provider_user_id, displayName: row.display_name };
}
