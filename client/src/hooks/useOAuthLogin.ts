import { useCallback, useRef, useState } from "react";
import { oauthLogin, type AuthStatus } from "../api";
import { strings } from "../lib/strings";

interface UseOAuthLoginResult {
  /** ログイン処理中（ブラウザ待ち含む）。 */
  isLoggingIn: boolean;
  /** 直近のログイン失敗メッセージ。成功・初期状態では null。 */
  loginError: string | null;
  /** ログインフローを開始する。成功時の AuthStatus は内部の onSuccess で扱う。 */
  login: () => Promise<void>;
  /** 進行中のログインを中断する（ブラウザ側がまだ完了していなくても、戻り値を無視する）。 */
  cancel: () => void;
}

interface UseOAuthLoginOptions {
  /** ログイン成功時に呼ばれる。AuthStatus を上流のストアに渡すなどの用途。 */
  onSuccess?: (auth: AuthStatus) => void | Promise<void>;
  /**
   * ログイン失敗時に呼ばれる。指定した場合は内部の loginError には記録されない。
   * （フックの error 表示を使わず、独自のトースト/アラートに流したいときに使う）
   */
  onError?: (message: string) => void;
}

/**
 * Discord OAuth ログインフローを管理するフック。
 * SettingsView / RankingView / OnboardingOverlay で同じパターンを使うため共通化。
 *
 * - cancel 後に Rust 側の非同期結果が返ってきても無視する（cancelledRef）
 * - エラーメッセージは strings.common.loginFailed をプレフィックスとして整形
 */
export function useOAuthLogin(options: UseOAuthLoginOptions = {}): UseOAuthLoginResult {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const login = useCallback(async () => {
    cancelledRef.current = false;
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const auth = await oauthLogin();
      if (cancelledRef.current) return;
      await options.onSuccess?.(auth);
    } catch (e) {
      if (cancelledRef.current) return;
      const message = `${strings.common.loginFailed}${e}`;
      if (options.onError) options.onError(message);
      else setLoginError(message);
    } finally {
      if (!cancelledRef.current) setIsLoggingIn(false);
    }
  }, [options]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setIsLoggingIn(false);
    setLoginError(null);
  }, []);

  return { isLoggingIn, loginError, login, cancel };
}
