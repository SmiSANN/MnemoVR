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
import { AlertPanel } from "./AlertPanel";
import { AutoStartDialog } from "./AutoStartDialog";
import { FullScanOverlay } from "./FullScanOverlay";
import { OnboardingOverlay } from "./OnboardingOverlay";
import { UpdateDialog } from "./UpdateDialog";
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
        style={backgroundDataUrl ? { backgroundColor: "rgba(12, 20, 33, 0.70)" } : undefined}
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
      style={backgroundDataUrl ? { backgroundColor: "rgba(20, 32, 50, 0.80)" } : undefined}
    >
      <div
        className="flex items-center gap-2 px-4 py-5 border-b border-slate-600/40"
        style={backgroundDataUrl ? undefined : { background: "linear-gradient(to right, #142032, rgba(5,80,96,0.1))" }}
      >
        <MnemoIcon className="w-6 h-6 glow-teal" />
        <h1 className="text-lg font-bold text-teal-400 glow-teal-sm tracking-wide">MnemoVR</h1>
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
                    ? "bg-teal-400/10 text-teal-300 border-teal-400/50 glow-teal-sm"
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
                    ? "bg-teal-400/10 text-teal-300 border-teal-400/50 glow-teal-sm"
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

function MnemoIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <clipPath id="mi-ul"><polygon points="0,0 100,0 0,100"/></clipPath>
        <clipPath id="mi-lr"><polygon points="100,0 100,100 0,100"/></clipPath>
        <clipPath id="mi-box"><rect x="4" y="4" width="92" height="92" rx="6"/></clipPath>
      </defs>
      <g clipPath="url(#mi-box)">
        <g clipPath="url(#mi-ul)">
          {([14,24,34,44,54,64,74] as const).map(y => (
            <g key={y}>
              <line x1="10" y1={y} x2="26" y2={y} stroke="currentColor" strokeWidth="4.375" strokeLinecap="round"/>
              <line x1="46" y1={y} x2="62" y2={y} stroke="currentColor" strokeWidth="4.375" strokeLinecap="round"/>
            </g>
          ))}
          <line x1="46" y1="84" x2="62" y2="84" stroke="currentColor" strokeWidth="4.375" strokeLinecap="round"/>
        </g>
        <g clipPath="url(#mi-lr)">
          <circle cx="80" cy="42" r="8" fill="none" stroke="currentColor" strokeWidth="4.375"/>
          <polyline points="4,96 45,55 55,62 65,50 80,58 96,70 96,96" fill="none" stroke="currentColor" strokeWidth="6.25" strokeLinejoin="round" strokeLinecap="round"/>
        </g>
        <line x1="4" y1="96" x2="96" y2="4" stroke="currentColor" strokeWidth="6.25" strokeLinecap="round"/>
      </g>
      <rect x="4" y="4" width="92" height="92" rx="6" fill="none" stroke="currentColor" strokeWidth="7.5"/>
    </svg>
  );
}
