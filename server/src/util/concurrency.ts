/**
 * 配列を最大 `limit` 並列で非同期マップする。
 * 外部 API（VRChat 等）への同時リクエスト数を抑え、レート制限・負荷を避ける。
 * 結果は入力と同じ順序で返る。
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await fn(items[i], i);
    }
  });

  await Promise.all(workers);
  return results;
}
