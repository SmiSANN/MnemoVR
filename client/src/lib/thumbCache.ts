/**
 * サムネイル URL のメモリキャッシュ（簡易 LRU）。
 * 長時間セッションでの無制限な増加を防ぐため、上限件数を超えたら
 * 最も古くアクセスされたエントリから破棄する。
 */
const MAX_ENTRIES = 5000;

// Map は挿入順を保持するため、get 時に再挿入して「最近使った順」を維持する。
const thumbCache = new Map<string, string>();

export function getThumbCacheEntry(key: string): string | undefined {
  const value = thumbCache.get(key);
  if (value !== undefined) {
    // アクセスされたエントリを末尾（最新）へ移動
    thumbCache.delete(key);
    thumbCache.set(key, value);
  }
  return value;
}

export function setThumbCacheEntry(key: string, value: string): void {
  if (thumbCache.has(key)) thumbCache.delete(key);
  thumbCache.set(key, value);
  if (thumbCache.size > MAX_ENTRIES) {
    // 先頭（最も古い）エントリを削除
    const oldest = thumbCache.keys().next().value;
    if (oldest !== undefined) thumbCache.delete(oldest);
  }
}

export function clearThumbCache(): void {
  thumbCache.clear();
}
