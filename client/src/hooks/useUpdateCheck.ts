import { useEffect, useState } from "react";
import { checkForUpdate, getSetting, setSetting } from "../api";

const SKIPPED_VERSION_KEY = "skipped_update_version";

interface UseUpdateCheckResult {
  /** 新しいバージョンが存在し、かつスキップ済みでない場合の文字列（例: "v0.1.7"）。それ以外は null。 */
  newVersion: string | null;
  /**
   * ダイアログを閉じる。`skipThisVersion=true` なら次回以降このバージョンを無視する。
   */
  dismiss: (skipThisVersion: boolean) => Promise<void>;
}

/**
 * 起動時に最新バージョン確認を行うフック。
 *
 * - サーバー失敗時は無視（起動を妨げない）
 * - 「このバージョンをスキップする」を選択した場合、その文字列を設定 DB に保存して再表示しない
 *
 * 別プロジェクトに移植する際は、`api/server.ts` の `checkForUpdate` と
 * `api/storage.ts` の `getSetting/setSetting` 相当があれば動く。
 */
export function useUpdateCheck(): UseUpdateCheckResult {
  const [newVersion, setNewVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const skipped = await getSetting(SKIPPED_VERSION_KEY).catch(() => null);
      const latest = await checkForUpdate().catch(() => null);
      if (cancelled) return;
      if (latest && latest !== skipped) {
        setNewVersion(latest);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function dismiss(skipThisVersion: boolean): Promise<void> {
    if (skipThisVersion && newVersion) {
      await setSetting(SKIPPED_VERSION_KEY, newVersion).catch(() => {});
    }
    setNewVersion(null);
  }

  return { newVersion, dismiss };
}
