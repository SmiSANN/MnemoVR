const thumbCache = new Map<string, string>();

export function getThumbCacheEntry(key: string): string | undefined {
  return thumbCache.get(key);
}

export function setThumbCacheEntry(key: string, value: string): void {
  thumbCache.set(key, value);
}

export function clearThumbCache(): void {
  thumbCache.clear();
}
