import { useState, useEffect, useCallback } from "react";
import { Trophy, Medal, Award, RefreshCw, LogIn } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { fetchRankings, getAuthStatus, syncToServer } from "../api";
import type { RankingEntry, RankingsData } from "../api/server";
import type { AuthStatus } from "../api/auth";
import { useOAuthLogin } from "../hooks/useOAuthLogin";
import { strings } from "../lib/strings";

const rankIcons = [
  <Trophy className="w-5 h-5 text-yellow-400" />,
  <Medal className="w-5 h-5 text-slate-200" />,
  <Award className="w-5 h-5 text-amber-600" />,
];

/** ランキング 1 カテゴリのカラム。 */
function RankingColumn({ title, data }: { title: string; data: RankingEntry[] }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 flex-1 min-w-0 border border-teal-400/10">
      <h3 className="text-sm font-semibold text-teal-400 mb-4 text-center glow-teal-sm">{title}</h3>
      {data.length === 0 ? (
        <p className="text-center text-sm text-slate-300">{strings.ranking.noDataShort}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.map((item, idx) => (
            <RankingRow key={item.world_id} item={item} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}

function RankingRow({ item, index }: { item: RankingEntry; index: number }) {
  const isTop = index < 3;
  return (
    <div
      onClick={() => openUrl(`https://vrchat.com/home/world/${item.world_id}`)}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all hover:bg-teal-400/8 hover:border-teal-400/20 border border-transparent cursor-pointer min-w-0 ${
        isTop ? "bg-teal-400/5" : ""
      }`}
    >
      <span className="w-6 text-center">
        {isTop ? rankIcons[index] : <span className="text-xs text-slate-300">{index + 1}</span>}
      </span>
      <span className={`flex-1 text-sm truncate ${isTop ? "text-white font-medium" : "text-slate-300"}`}>
        {item.world_name}
      </span>
      <span className="text-xs text-slate-300">{item.score}</span>
    </div>
  );
}

/** ログインしていないときに表示するゲート。 */
function LoginGate({ onLoggedIn }: { onLoggedIn: (auth: AuthStatus) => void }) {
  const { isLoggingIn, loginError, login, cancel } = useOAuthLogin({ onSuccess: onLoggedIn });

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-4">{strings.ranking.title}</h2>
      <div className="bg-slate-800 rounded-xl p-8 flex flex-col items-center gap-4 max-w-sm mx-auto mt-8">
        <Trophy className="w-10 h-10 text-teal-400 opacity-60" />
        <div className="text-center">
          <p className="text-white font-medium mb-1">{strings.ranking.loginRequired}</p>
          <p className="text-xs text-slate-300">{strings.ranking.loginDescription}</p>
        </div>

        {loginError && (
          <div className="w-full bg-red-900/50 border border-red-500 text-red-200 text-xs rounded-lg px-3 py-2">
            {loginError}
          </div>
        )}

        {isLoggingIn ? (
          <div className="w-full flex flex-col items-center gap-3 py-1">
            <div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-200 text-center">{strings.common.browserLoginPrompt}</p>
            <button
              onClick={cancel}
              className="text-xs text-slate-300 hover:text-slate-100 underline transition-colors"
            >
              {strings.common.cancel}
            </button>
          </div>
        ) : (
          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <LogIn className="w-4 h-4" />
            {strings.common.discordLogin}
          </button>
        )}
      </div>
    </div>
  );
}

const SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10分（ランキングキャッシュと同じ間隔）

export function RankingView() {
  const [rankings, setRankings] = useState<RankingsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // undefined = 認証チェック前、null = 未ログイン、AuthStatus = ログイン済み
  const [authStatus, setAuthStatus] = useState<AuthStatus | null | undefined>(undefined);

  useEffect(() => {
    getAuthStatus().then(setAuthStatus);
  }, []);

  const loadRankings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRankings();
      setRankings(data);
    } catch (e) {
      setError(`${strings.ranking.fetchFailed}${e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // ログイン済みなら起動時に同期 → ランキング取得
  useEffect(() => {
    if (!authStatus) return;
    const lastSync = Number(sessionStorage.getItem("lastSyncAt") || "0");
    if (Date.now() - lastSync > SYNC_INTERVAL_MS) {
      syncToServer()
        .then(() => sessionStorage.setItem("lastSyncAt", String(Date.now())))
        .catch(() => {});
    }
    loadRankings();
  }, [loadRankings, authStatus]);

  if (authStatus === undefined) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-300 text-sm">
        {strings.common.loading}
      </div>
    );
  }

  if (authStatus === null) {
    return <LoginGate onLoggedIn={setAuthStatus} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">{strings.ranking.title}</h2>
        <button
          onClick={loadRankings}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1 text-sm bg-slate-800 hover:bg-slate-700 disabled:text-slate-300 rounded-full transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          {strings.ranking.refresh}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {rankings ? (
        <div className="flex gap-4">
          <RankingColumn title={strings.ranking.colAllTime} data={rankings.all_time} />
          <RankingColumn title={strings.ranking.colWeekly} data={rankings.weekly} />
          <RankingColumn title={strings.ranking.colDaily} data={rankings.daily} />
        </div>
      ) : !error ? (
        <div className="flex items-center justify-center py-20 text-slate-300">
          {loading ? strings.common.loading : strings.ranking.noData}
        </div>
      ) : null}
    </div>
  );
}
