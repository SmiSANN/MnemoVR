/**
 * Discord OAuth2 プロバイダー連携。
 * authorization code → access_token → ユーザー情報の取得まで。
 *
 * 別のプロバイダー（Google など）を追加する場合は同形式の関数を定義し、
 * 認証ルートでプロバイダーを切り替える設計。
 */

export interface DiscordUser {
  id: string;
  global_name?: string;
  username: string;
}

export interface DiscordTokenExchangeParams {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}

/** PKCE フローで Discord のアクセストークンを取得する。 */
export async function exchangeDiscordCode(
  params: DiscordTokenExchangeParams,
): Promise<string> {
  const resp = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Discord token exchange failed: ${text}`);
  }
  const data = await resp.json<{ access_token: string }>();
  return data.access_token;
}

/** Discord アクセストークンでユーザー情報を取得する。 */
export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const resp = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Discord token verification failed: ${text}`);
  }
  return (await resp.json()) as DiscordUser;
}

/** 表示名を決定する（global_name 優先、なければ username）。 */
export function pickDiscordDisplayName(user: DiscordUser): string {
  return user.global_name ?? user.username;
}
