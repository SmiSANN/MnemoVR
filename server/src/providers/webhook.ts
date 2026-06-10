/**
 * Discord Webhook による管理者向けアラート通知。
 *
 * 不正（存在しない）ワールド ID が同期されたことを検知した際に、
 * 該当ユーザーの Discord 情報とワールド ID を運営チャンネルへ通知する。
 */

import { APP_NAME, VRCHAT_USER_AGENT } from "../constants";

/**
 * VRChat にワールドが存在するか確認する。
 * - true:  200（存在する）
 * - false: 404（存在しない＝不正）
 * - null:  判定不能（ネットワークエラー・レート制限など。誤検知を避けるため通知しない）
 */
export async function worldExists(worldId: string): Promise<boolean | null> {
  try {
    const resp = await fetch(
      `https://api.vrchat.cloud/api/1/worlds/${encodeURIComponent(worldId)}`,
      { headers: { "User-Agent": VRCHAT_USER_AGENT } },
    );
    if (resp.status === 404) return false;
    if (resp.ok) return true;
    return null;
  } catch {
    return null;
  }
}

export interface InvalidWorldAlert {
  discordUsername: string;
  discordId: string;
  worldIds: string[];
}

/**
 * 不正ワールド検知を Discord Webhook に通知する。
 * webhookUrl 未設定時は何もしない。失敗しても呼び出し側に影響を与えない。
 */
export async function sendInvalidWorldAlert(
  webhookUrl: string | undefined,
  alert: InvalidWorldAlert,
): Promise<void> {
  if (!webhookUrl) return;

  const content = [
    `🚨 **${APP_NAME}** — 存在しないワールドの同期を検知`,
    `**Discord ユーザー名:** ${alert.discordUsername}`,
    `**Discord ID:** ${alert.discordId}`,
    `**ワールド ID:** ${alert.worldIds.join(", ")}`,
  ].join("\n");

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // allowed_mentions を空にして @everyone 等の誤爆を防ぐ
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
  } catch {
    // 通知失敗は致命的ではないため握りつぶす
  }
}
