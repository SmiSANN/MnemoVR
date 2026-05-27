import { useEffect, useState } from "react";
import {
  getAllPhotos,
  allowAssetDirectory,
  getAuthStatus,
  getAutostartEnabled,
  getSetting,
  getVrchatPicturePath,
  readImageAsDataUrl,
  scanLocalPhotos,
  setSetting,
  syncToServer,
} from "../api";
import { useAppStore } from "../store/useAppStore";
import { strings } from "../lib/strings";

interface UseInitAppResult {
  /**
   * 利用規約への同意状態。
   * `null` = チェック前（描画を止める）、`true` = オンボーディング表示、`false` = 表示不要。
   */
  showOnboarding: boolean | null;
  /** オンボーディング完了時に呼ぶ。利用規約同意を「表示不要」にする。 */
  setOnboardingDone: () => void;
}

/**
 * アプリ起動時の初期化処理を一括で担うフック。
 *
 * - 利用規約同意の状態確認
 * - DB から既存写真の即時ロード
 * - 認証状態のストア反映
 * - 写真フォルダのパス取得 → スキャン → 必要なら同期
 *
 * AppShell から肥大化したロジックを切り出したもの。
 */
export function useInitApp(): UseInitAppResult {
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const { setPhotos, setPicturePath, setAuthStatus, setIsScanning, addAlert, setBackgroundImage, setBackgroundDataUrl, setShowAutoStartDialog, setAutostartOn } = useAppStore();

  useEffect(() => {
    void init();
    // 初回マウント時のみ実行する初期化フロー
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    // 1. 利用規約への同意確認（未同意ならオンボーディングを表示）
    const termsAgreed = await getSetting("terms_agreed").catch(() => null);
    setShowOnboarding(termsAgreed !== "1");

    // 自動起動の確認ダイアログ（利用規約同意済みかつ未確認の場合のみ）
    if (termsAgreed === "1") {
      const autostartAsked = await getSetting("autostart_asked").catch(() => null);
      if (autostartAsked !== "1") {
        setShowAutoStartDialog(true);
      }
    }

    // 2. ログイン状態 + 自動起動状態をストアに保存
    const auth = await getAuthStatus().catch(() => null);
    setAuthStatus(auth);
    getAutostartEnabled().then(setAutostartOn).catch(() => {});

    // 3a. 背景画像設定をロード（data URL に変換してからストアに反映）
    const bgImage = await getSetting("background_image").catch(() => null);
    if (bgImage) {
      setBackgroundImage(bgImage);
      readImageAsDataUrl(bgImage)
        .then((url) => setBackgroundDataUrl(url))
        .catch(() => {});
    }

    // 3. DB から既存の写真を即座にロード（UI 表示用）
    try {
      const existing = await getAllPhotos();
      if (existing.length > 0) setPhotos(existing);
    } catch {
      // 初回起動時は DB が空の場合がある
    }

    // 4. 保存済みの写真フォルダパスを読み込み、なければ VRChat フォルダを自動検出
    const path = await loadOrDetectPicturePath();
    if (!path) {
      addAlert({
        id: "no-vrchat-folder",
        type: "warning",
        message: strings.appShell.noVrchatFolder,
      });
      return;
    }
    setPicturePath(path);
    // 写真フォルダを asset:// スコープに追加（production build でも convertFileSrc が動くようにする）
    allowAssetDirectory(path).catch(() => {});
    await runInitialScan(path);
  }

  async function loadOrDetectPicturePath(): Promise<string | null> {
    const saved = await getSetting("picture_path").catch(() => null);
    if (saved) return saved;

    try {
      const detected = await getVrchatPicturePath();
      await setSetting("picture_path", detected);
      return detected;
    } catch {
      return null;
    }
  }

  async function runInitialScan(path: string) {
    if (useAppStore.getState().isScanning) return;
    setIsScanning(true);
    try {
      const photos = await scanLocalPhotos(false, path);
      setPhotos(photos);

      // ログイン済みなら差分同期（未同期データがなければ即返る）
      const { authStatus, setAuthStatus: setAuth } = useAppStore.getState();
      if (authStatus) {
        syncToServer().catch((e: unknown) => {
          const msg = String(e);
          if (msg.includes(strings.common.authInvalid)) setAuth(null);
          addAlert({
            id: `sync-error-${Date.now()}`,
            type: "error",
            message: `${strings.appShell.syncFailed}${msg}`,
          });
        });
      }
    } catch (e) {
      addAlert({
        id: `scan-error-${Date.now()}`,
        type: "error",
        message: `${strings.common.scanError}${e}`,
      });
    } finally {
      setIsScanning(false);
    }
  }

  return {
    showOnboarding,
    setOnboardingDone: () => setShowOnboarding(false),
  };
}
