import { useCallback, useEffect, useState } from "react";
import {
  getCachedImageUrl,
  getSetting,
  setCachedImageUrl,
  setSetting,
  uploadImage,
} from "../api";

export type UploadStatus = "idle" | "uploading" | "copied" | "error";

const COPIED_DISPLAY_MS = 2000;
const ERROR_DISPLAY_MS = 3000;
const WARNING_SKIP_KEY = "upload_warning_skip";

interface UseImageUploadResult {
  /** 現在のアップロードボタンの表示状態。 */
  status: UploadStatus;
  /** 警告ダイアログを表示すべきかどうか。 */
  showWarning: boolean;
  /** アップロードボタン押下時に呼ぶ。キャッシュ・警告スキップ設定を見て分岐する。 */
  requestUpload: () => Promise<void>;
  /** 警告ダイアログで「アップロード」を選んだときに呼ぶ。 */
  confirmWarning: (skipInFuture: boolean) => Promise<void>;
  /** 警告ダイアログをキャンセルしたときに呼ぶ。 */
  cancelWarning: () => void;
}

/**
 * 画像アップロードの状態機械を管理するフック。
 *
 * フロー:
 *   1. ボタン押下 → URL がキャッシュ済みならクリップボードに即コピー
 *   2. キャッシュなし → 警告スキップ設定を見て、未スキップなら警告ダイアログ表示
 *   3. 警告承認後 → アップロード実行 → URL をキャッシュ＆クリップボードへ
 *
 * filePath が変わると状態は自動で `idle` にリセットされる。
 */
export function useImageUpload(filePath: string): UseImageUploadResult {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [showWarning, setShowWarning] = useState(false);

  // 写真が切り替わったら状態をリセット
  useEffect(() => {
    setStatus("idle");
    setShowWarning(false);
  }, [filePath]);

  const doUpload = useCallback(async () => {
    setStatus("uploading");
    try {
      const imageUrl = await uploadImage(filePath);
      await setCachedImageUrl(filePath, imageUrl);
      await navigator.clipboard.writeText(imageUrl);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), COPIED_DISPLAY_MS);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), ERROR_DISPLAY_MS);
    }
  }, [filePath]);

  const requestUpload = useCallback(async () => {
    if (status === "uploading") return;

    const cached = await getCachedImageUrl(filePath);
    if (cached) {
      await navigator.clipboard.writeText(cached);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), COPIED_DISPLAY_MS);
      return;
    }

    const skip = await getSetting(WARNING_SKIP_KEY);
    if (skip === "1") {
      await doUpload();
    } else {
      setShowWarning(true);
    }
  }, [status, filePath, doUpload]);

  const confirmWarning = useCallback(
    async (skipInFuture: boolean) => {
      setShowWarning(false);
      if (skipInFuture) await setSetting(WARNING_SKIP_KEY, "1");
      await doUpload();
    },
    [doUpload],
  );

  const cancelWarning = useCallback(() => setShowWarning(false), []);

  return { status, showWarning, requestUpload, confirmWarning, cancelWarning };
}
