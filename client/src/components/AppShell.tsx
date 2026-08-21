import { Outlet, NavLink } from "react-router-dom";
import {
  Calendar,
  ChevronRight,
  Globe,
  Star,
  Trophy,
  Settings,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useInitApp } from "../hooks/useInitApp";
import { usePhotoEvents } from "../hooks/usePhotoEvents";
import { useUpdateCheck } from "../hooks/useUpdateCheck";
import { useTheme } from "../hooks/useTheme";
import { AlertPanel } from "./AlertPanel";
import { AutoStartDialog } from "./AutoStartDialog";
import { FullScanOverlay } from "./FullScanOverlay";
import { OnboardingOverlay } from "./OnboardingOverlay";
import { UpdateDialog } from "./UpdateDialog";
import { MnemoIcon } from "./MnemoIcon";
import { strings } from "../lib/strings";
import { setAutostartEnabled, setRunInBackground, setSetting } from "../api";

const mainNavItems = [
  { to: "/ranking", icon: Trophy, label: strings.nav.ranking },
  { to: "/worlds", icon: Globe, label: strings.nav.worlds },
  { to: "/calendar", icon: Calendar, label: strings.nav.calendar },
  { to: "/favorites", icon: Star, label: strings.nav.favorites },
];

const bottomNavItems = [
  { to: "/settings", icon: Settings, label: strings.nav.settings },
];

export function AppShell() {
  const { isScanning, photos, backgroundDataUrl, showAutoStartDialog, setShowAutoStartDialog, setAutostartOn } = useAppStore();
  const { showOnboarding, setOnboardingDone } = useInitApp();
  const { newVersion, dismiss: dismissUpdate } = useUpdateCheck();
  useTheme();
  usePhotoEvents();

  // 規約同意チェックが完了するまで何も描画しない（メニューの一瞬表示を防ぐ）
  if (showOnboarding === null) {
    return <div className="h-screen w-screen bg-slate-900" />;
  }

  return (
    <div className="flex h-screen w-screen relative" data-has-bg={backgroundDataUrl ? "true" : undefined}>
      {/* 背景画像レイヤー（opacity なし・フル表示） */}
      {backgroundDataUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: `url(${backgroundDataUrl})` }}
        />
      )}

      <Sidebar />

      {/* main の背景色透明度で「どれだけ透かすか」を制御（固定 30%） */}
      <main
        className="flex-1 flex flex-col overflow-hidden bg-grid relative z-10"
        style={backgroundDataUrl ? { backgroundColor: "var(--app-main-overlay)" } : undefined}
      >
        <AlertPanel />
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </main>

      {/* 初回ロード時のフルスキャンオーバーレイ（DB空の場合のみ） */}
      {isScanning && photos.length === 0 && <FullScanOverlay />}

      {/* 初回起動時のオンボーディング（利用規約同意 + ログイン） */}
      {showOnboarding === true && <OnboardingOverlay onComplete={() => setOnboardingDone()} />}

      {/* 自動起動の初回確認（オンボーディング・アップデートダイアログが出ていない場合のみ） */}
      {showAutoStartDialog && showOnboarding !== true && !newVersion && (
        <AutoStartDialog
          onAccept={async () => {
            await setAutostartEnabled(true).catch(() => {});
            await setRunInBackground(true).catch(() => {});
            await setSetting("autostart_asked", "1").catch(() => {});
            setAutostartOn(true);
            setShowAutoStartDialog(false);
          }}
          onSkip={async () => {
            await setSetting("autostart_asked", "1").catch(() => {});
            setShowAutoStartDialog(false);
          }}
        />
      )}

      {/* アップデート通知（オンボーディング表示中は隠す） */}
      {newVersion && showOnboarding !== true && (
        <UpdateDialog latestVersion={newVersion} onDismiss={dismissUpdate} />
      )}
    </div>
  );
}
function Sidebar() {
  const { backgroundDataUrl } = useAppStore();
  return (
    <aside
      className="w-56 bg-slate-800 flex flex-col shrink-0 border-r border-slate-600/40 relative z-10"
      style={backgroundDataUrl ? { backgroundColor: "var(--app-sidebar-overlay)" } : undefined}
    >
      <div
        className="flex items-center gap-2 px-4 py-5 border-b border-slate-600/40"
        style={backgroundDataUrl ? undefined : { background: "var(--app-header-gradient)" }}
      >
        <MnemoIcon className="w-6 h-6 shrink-0 text-teal-400" />
        <h1 className="text-lg font-bold text-teal-400 tracking-wide">MnemoVR</h1>
      </div>
      <nav className="flex-1 py-3 px-2 flex flex-col">
        <div className="flex flex-col gap-2">
          {mainNavItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  isActive
                    ? "bg-teal-400/10 text-teal-300 border-teal-400/50"
                    : "bg-teal-950/20 text-teal-200/90 border-teal-400/20 hover:border-teal-400/35 hover:bg-teal-900/15"
                }`
              }
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-5 h-5 shrink-0" />
                <span className="truncate">{label}</span>
              </span>
              <ChevronRight className="w-4 h-4 shrink-0 text-teal-300/60 group-hover:text-teal-300/80" />
            </NavLink>
          ))}
        </div>
        <div className="mt-auto pt-3 border-t border-slate-600/40 flex flex-col gap-2">
          {bottomNavItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  isActive
                    ? "bg-teal-400/10 text-teal-300 border-teal-400/50"
                    : "bg-teal-950/20 text-teal-200/90 border-teal-400/20 hover:border-teal-400/35 hover:bg-teal-900/15"
                }`
              }
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-5 h-5 shrink-0" />
                <span className="truncate">{label}</span>
              </span>
              <ChevronRight className="w-4 h-4 shrink-0 text-teal-300/60 group-hover:text-teal-300/80" />
            </NavLink>
          ))}
        </div>
      </nav>
    </aside>
  );
}
