import { useState, useEffect } from "react";
import { RefreshCw, Trash2, FolderOpen, Image, LogIn, LogOut, Upload, Wallpaper, FolderSearch } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import {
  scanLocalPhotos,
  getSetting,
  setSetting,
  clearThumbnailCache,
  setRunInBackground,
  oauthLogout,
  pickImageFile,
  readImageAsDataUrl,
  getAuthStatus,
  syncToServer,
  setAutostartEnabled,
} from "../api";
import type { AuthStatus } from "../api/auth";
import { useOAuthLogin } from "../hooks/useOAuthLogin";
import { clearThumbCache } from "../lib/thumbCache";
import { strings } from "../lib/strings";
import { AboutSection } from "../components/AboutSection";

export function SettingsView() {
  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-white mb-6">{strings.settings.title}</h2>

      <FolderSection />
      <DataSection />
      <CacheSection />
      <AccountSection />
      <BackgroundSection />
      <AutoStartSection />
      <WindowSection />
      <AboutSection />
    </div>
  );
}

// ─── 写真フォルダのパス指定 ──────────────────────────────────────

function FolderSection() {
  const { picturePath, setPicturePath, addAlert } = useAppStore();
  const [inputPath, setInputPath] = useState(picturePath);

  useEffect(() => {
    setInputPath(picturePath);
  }, [picturePath]);

  async function handleSave() {
    if (!inputPath) return;
    try {
      await setSetting("picture_path", inputPath);
      setPicturePath(inputPath);
      addAlert({ id: "path-saved", type: "success", message: strings.settings.pathSaved });
    } catch (e) {
      addAlert({
        id: `path-error-${Date.now()}`,
        type: "error",
        message: `${strings.settings.pathSaveFailed}${e}`,
      });
    }
  }

  return (
    <SettingsSection title={strings.settings.folderTitle} icon={<FolderOpen className="w-4 h-4" />}>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputPath}
          onChange={(e) => setInputPath(e.target.value)}
          placeholder="C:\Users\xxx\Pictures\VRChat"
          className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
        />
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded transition-colors"
        >
          {strings.settings.saveButton}
        </button>
      </div>
      <p className="text-xs text-slate-300 mt-2">{strings.settings.folderHint}</p>
    </SettingsSection>
  );
}

// ─── データ管理（フルスキャン） ──────────────────────────────────

function DataSection() {
  const { picturePath, setPicturePath, setPhotos, isScanning, setIsScanning, addAlert } =
    useAppStore();

  async function handleFullScan() {
    const path = picturePath;
    if (!path) {
      addAlert({ id: "no-path", type: "warning", message: strings.settings.noPath });
      return;
    }
    if (path !== picturePath) {
      await setSetting("picture_path", path);
      setPicturePath(path);
    }
    setIsScanning(true);
    try {
      const photos = await scanLocalPhotos(true, path);
      setPhotos(photos);
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

  return (
    <SettingsSection title={strings.settings.dataTitle}>
      <button
        onClick={handleFullScan}
        disabled={isScanning}
        className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-600 disabled:text-slate-300 text-white text-sm rounded-lg transition-colors"
      >
        <RefreshCw className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
        {isScanning ? strings.common.scanning : strings.settings.fullScanButton}
      </button>
    </SettingsSection>
  );
}

// ─── キャッシュ管理 ──────────────────────────────────────────────

function CacheSection() {
  const { addAlert } = useAppStore();

  async function handleClear() {
    try {
      await clearThumbnailCache();
      clearThumbCache();
      addAlert({ id: "thumb-cleared", type: "success", message: strings.settings.cacheCleared });
    } catch (e) {
      addAlert({
        id: `thumb-error-${Date.now()}`,
        type: "error",
        message: `${strings.settings.cacheClearFailed}${e}`,
      });
    }
  }

  return (
    <SettingsSection title={strings.settings.cacheTitle} icon={<Trash2 className="w-4 h-4" />}>
      <button
        onClick={handleClear}
        className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
      >
        <Image className="w-4 h-4" />
        {strings.settings.clearCacheButton}
      </button>
      <p className="text-xs text-slate-300 mt-2">{strings.settings.cacheHint}</p>
    </SettingsSection>
  );
}

// ─── アカウント（ログイン・同期・ログアウト） ─────────────────────

function AccountSection() {
  const { addAlert, setAuthStatus: setGlobalAuthStatus } = useAppStore();
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    getAuthStatus().then(setAuthStatus);
  }, []);

  const { isLoggingIn, login } = useOAuthLogin({
    onSuccess: (status) => {
      setAuthStatus(status);
      setGlobalAuthStatus(status);
      addAlert({
        id: "login-done",
        type: "success",
        message: `${status.display_name} ${strings.settings.loginSuccessSuffix}`,
      });
    },
    onError: (message) =>
      addAlert({ id: `login-error-${Date.now()}`, type: "error", message }),
  });

  async function handleLogout() {
    try {
      await oauthLogout();
      setAuthStatus(null);
      setGlobalAuthStatus(null);
      addAlert({ id: "logout-done", type: "success", message: strings.settings.logoutSuccess });
    } catch (e) {
      addAlert({
        id: `logout-error-${Date.now()}`,
        type: "error",
        message: `${strings.settings.logoutFailed}${e}`,
      });
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    try {
      const msg = await syncToServer();
      addAlert({ id: `sync-ok-${Date.now()}`, type: "success", message: msg });
    } catch (e) {
      const msg = String(e);
      if (msg.includes(strings.common.authInvalid)) {
        setAuthStatus(null);
        setGlobalAuthStatus(null);
      }
      addAlert({ id: `sync-error-${Date.now()}`, type: "error", message: msg });
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <SettingsSection title={strings.settings.accountTitle} icon={<LogIn className="w-4 h-4" />}>
      {authStatus ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">{authStatus.display_name}</p>
              <p className="text-xs text-slate-300">{strings.settings.loggedInWith}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              {strings.settings.logoutButton}
            </button>
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-600 disabled:text-slate-300 text-white text-sm rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            {isSyncing ? strings.settings.syncing : strings.settings.syncNowButton}
          </button>
        </div>
      ) : (
        <button
          onClick={login}
          disabled={isLoggingIn}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:text-slate-300 text-white text-sm rounded-lg transition-colors"
        >
          <LogIn className="w-4 h-4" />
          {isLoggingIn ? strings.settings.loggingIn : strings.common.discordLogin}
        </button>
      )}
      <p className="text-xs text-slate-300 mt-2">{strings.settings.loginHint}</p>
    </SettingsSection>
  );
}

// ─── 背景画像 ────────────────────────────────────────────────────

function BackgroundSection() {
  const { backgroundImage, setBackgroundImage, setBackgroundDataUrl, addAlert } = useAppStore();
  const [inputPath, setInputPath] = useState(backgroundImage);

  useEffect(() => {
    setInputPath(backgroundImage);
  }, [backgroundImage]);

  async function applyImage(path: string) {
    try {
      await setSetting("background_image", path);
      setBackgroundImage(path);
      if (path) {
        const url = await readImageAsDataUrl(path);
        setBackgroundDataUrl(url);
        addAlert({ id: "bg-saved", type: "success", message: strings.settings.bgSaved });
      } else {
        setBackgroundDataUrl("");
        addAlert({ id: "bg-cleared", type: "success", message: strings.settings.bgCleared });
      }
    } catch (e) {
      addAlert({ id: `bg-error-${Date.now()}`, type: "error", message: `${strings.settings.bgSaveFailed}${e}` });
    }
  }

  async function handleReset() {
    setInputPath("");
    await applyImage("");
  }

  async function handlePickFile() {
    const path = await pickImageFile().catch(() => null);
    if (path) {
      setInputPath(path);
      await applyImage(path);
    }
  }

  return (
    <SettingsSection title={strings.settings.bgTitle} icon={<Wallpaper className="w-4 h-4" />}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={inputPath}
            onChange={(e) => setInputPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyImage(inputPath)}
            placeholder="C:\Users\xxx\Pictures\background.png"
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 pr-8 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
          />
          {inputPath && (
            <button
              onClick={handleReset}
              title="背景をリセット"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              ×
            </button>
          )}
        </div>
        <button
          onClick={handlePickFile}
          title="ファイルを選択"
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded transition-colors"
        >
          <FolderSearch className="w-4 h-4" />
        </button>
      </div>
    </SettingsSection>
  );
}

// ─── 自動起動 ────────────────────────────────────────────────────

function AutoStartSection() {
  const { addAlert, autostartOn, setAutostartOn } = useAppStore();

  async function handleToggle() {
    const next = !autostartOn;
    try {
      await setAutostartEnabled(next);
      if (next) await setRunInBackground(true);
      setAutostartOn(next);
      addAlert({
        id: `autostart-${Date.now()}`,
        type: "success",
        message: next ? strings.settings.autostartEnabled : strings.settings.autostartDisabled,
      });
    } catch (e) {
      addAlert({
        id: `autostart-error-${Date.now()}`,
        type: "error",
        message: `${strings.settings.autostartFailed}${e}`,
      });
    }
  }

  return (
    <SettingsSection title={strings.settings.autostartTitle}>
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={handleToggle}
          className={`relative w-10 h-6 rounded-full transition-colors ${
            autostartOn ? "bg-teal-600" : "bg-slate-600"
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
              autostartOn ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </div>
        <span className="text-sm text-slate-200">{strings.settings.autostartLabel}</span>
      </label>
      <p className="text-xs text-slate-300 mt-2">{strings.settings.autostartHint}</p>
    </SettingsSection>
  );
}

// ─── ウィンドウ動作（バックグラウンド常駐） ──────────────────────

function WindowSection() {
  const { addAlert, autostartOn } = useAppStore();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    getSetting("run_in_background").then((v) => setEnabled(v === "1"));
  }, []);

  // 自動起動がONのときは常にON状態を描画
  const effective = autostartOn ? true : enabled;

  async function handleToggle() {
    if (autostartOn) return;
    const next = !enabled;
    try {
      await setRunInBackground(next);
      setEnabled(next);
    } catch (e) {
      addAlert({
        id: `rib-error-${Date.now()}`,
        type: "error",
        message: `${strings.settings.settingsSaveFailed}${e}`,
      });
    }
  }

  return (
    <SettingsSection title={strings.settings.windowTitle}>
      <label className={`flex items-center gap-3 ${autostartOn ? "cursor-not-allowed" : "cursor-pointer"}`}>
        <div
          onClick={handleToggle}
          className={`relative w-10 h-6 rounded-full transition-colors ${
            effective ? "bg-teal-600" : "bg-slate-600"
          } ${autostartOn ? "opacity-60" : ""}`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
              effective ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </div>
        <span className="text-sm text-slate-200">{strings.settings.backgroundToggleLabel}</span>
      </label>
      {autostartOn && (
        <p className="text-xs text-teal-400/70 mt-1">{strings.settings.backgroundToggleForcedHint}</p>
      )}
      <p className="text-xs text-slate-300 mt-2">{strings.settings.backgroundToggleHint}</p>
    </SettingsSection>
  );
}

// ─── 共通: セクションラッパー ────────────────────────────────────

function SettingsSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-slate-800 rounded-xl p-5 mb-4 border border-slate-600/30">
      <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}
