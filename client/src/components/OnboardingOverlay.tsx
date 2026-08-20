import { useState } from "react";
import { LogIn, Rocket, UserCheck } from "lucide-react";
import { setSetting, setAutostartEnabled, setRunInBackground } from "../api";
import type { AuthStatus } from "../api/auth";
import { useOAuthLogin } from "../hooks/useOAuthLogin";
import { TermsContent } from "./TermsContent";
import { strings } from "../lib/strings";

type Step = "terms" | "autostart" | "login";

interface Props {
  /** 同意+ログイン（またはゲスト選択）が完了したときに呼ぶコールバック */
  onComplete: (auth: AuthStatus | null) => void;
}

export function OnboardingOverlay({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("terms");
  const [agreed, setAgreed] = useState(false);

  function handleAgree() {
    if (!agreed) return;
    setStep("autostart");
  }

  async function handleGuest() {
    await setSetting("terms_agreed", "1");
    onComplete(null);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 flex items-center justify-center">
      <div className="w-full max-w-lg mx-4">
        {step === "terms" ? (
          <TermsStep
            agreed={agreed}
            onToggle={() => setAgreed((v) => !v)}
            onNext={handleAgree}
          />
        ) : step === "autostart" ? (
          <AutoStartStep onNext={() => setStep("login")} />
        ) : (
          <LoginStep onComplete={onComplete} onGuest={handleGuest} />
        )}
      </div>
    </div>
  );
}

function AutoStartStep({ onNext }: { onNext: () => void }) {
  async function handle(enable: boolean) {
    if (enable) {
      await setAutostartEnabled(true).catch(() => {});
      await setRunInBackground(true).catch(() => {});
    }
    await setSetting("autostart_asked", "1").catch(() => {});
    onNext();
  }

  return (
    <div className="bg-slate-800 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <Rocket className="w-6 h-6 text-teal-400 shrink-0" />
        <h2 className="text-lg font-semibold text-app-primary">{strings.autoStartDialog.title}</h2>
      </div>
      <p className="text-sm text-slate-300 mb-6">{strings.autoStartDialog.message}</p>
      <div className="flex gap-3">
        <button
          onClick={() => handle(true)}
          className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {strings.autoStartDialog.accept}
        </button>
        <button
          onClick={() => handle(false)}
          className="px-4 py-2 text-sm text-slate-100 hover:text-app-primary hover:bg-slate-700 rounded-lg transition-colors"
        >
          {strings.autoStartDialog.skip}
        </button>
      </div>
    </div>
  );
}

function TermsStep({
  agreed,
  onToggle,
  onNext,
}: {
  agreed: boolean;
  onToggle: () => void;
  onNext: () => void;
}) {
  return (
    <div className="bg-slate-800 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-app-primary mb-4">{strings.onboarding.termsTitle}</h2>

      <div className="bg-slate-900 rounded-lg p-4 h-56 overflow-y-auto text-xs text-slate-300 leading-relaxed mb-4">
        <TermsContent />
      </div>

      <label className="flex items-start gap-3 cursor-pointer mb-5">
        <input
          type="checkbox"
          checked={agreed}
          onChange={onToggle}
          className="mt-0.5 w-4 h-4 accent-teal-500 cursor-pointer"
        />
        <span className="text-sm text-slate-200">{strings.onboarding.termsCheckbox}</span>
      </label>

      <button
        onClick={onNext}
        disabled={!agreed}
        className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {strings.onboarding.agreeButton}
      </button>
    </div>
  );
}

function LoginStep({
  onComplete,
  onGuest,
}: {
  onComplete: (auth: AuthStatus) => void;
  onGuest: () => void;
}) {
  const { isLoggingIn, loginError, login, cancel } = useOAuthLogin({
    onSuccess: async (auth) => {
      await setSetting("terms_agreed", "1");
      onComplete(auth);
    },
  });

  return (
    <div className="bg-slate-800 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-app-primary mb-1">{strings.onboarding.loginTitle}</h2>
      <p className="text-xs text-slate-300 mb-5">{strings.onboarding.loginDescription}</p>

      {loginError && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 text-xs rounded-lg px-3 py-2 mb-4">
          {loginError}
        </div>
      )}

      {isLoggingIn ? (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-200 text-center">{strings.common.browserLoginPrompt}</p>
          <button
            onClick={cancel}
            className="text-xs text-slate-300 hover:text-slate-100 underline transition-colors"
          >
            {strings.common.cancel}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <button
              onClick={login}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <LogIn className="w-4 h-4" />
              {strings.common.discordLogin}
            </button>
          </div>

          <div className="relative flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-xs text-slate-300">{strings.onboarding.or}</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          <button
            onClick={onGuest}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
          >
            <UserCheck className="w-4 h-4" />
            {strings.onboarding.guestButton}
          </button>
          <p className="text-xs text-slate-300 mt-2 text-center">{strings.onboarding.guestHint}</p>
        </>
      )}
    </div>
  );
}
