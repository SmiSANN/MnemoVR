const encoder = new TextEncoder();

/** JWT 署名に使用する CryptoKey を HMAC-SHA256 で生成する。 */
async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Uint8Array | ArrayBuffer を base64url（パディングなし）にエンコードする。 */
function toBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/** base64url 文字列を Uint8Array にデコードする。 */
function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export interface JwtPayload {
  user_id: number;
  provider: string;
  display_name: string;
  is_banned: boolean;
  exp: number; // Unix 秒
}

/**
 * JWT を生成する（HMAC-SHA256 署名）。
 * @param payload 埋め込むペイロード
 * @param secret  署名に使用するシークレット
 */
export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const header = toBase64Url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${header}.${body}`;

  const key = await importKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput));
  return `${signingInput}.${toBase64Url(signature)}`;
}

/**
 * JWT を検証してペイロードを返す。
 * 署名不正・有効期限切れの場合は null を返す。
 */
export async function verifyJwt(
  token: string,
  secret: string,
): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, sig] = parts;
  const signingInput = `${header}.${body}`;

  try {
    const key = await importKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(sig),
      encoder.encode(signingInput),
    );
    if (!valid) return null;

    const decoded = new TextDecoder().decode(fromBase64Url(body));
    const payload: JwtPayload = JSON.parse(decoded);
    if (payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}
