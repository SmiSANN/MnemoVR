import { Rocket } from "lucide-react";
import { strings } from "../lib/strings";

interface Props {
  onAccept: () => void;
  onSkip: () => void;
}

export function AutoStartDialog({ onAccept, onSkip }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 border border-slate-600 rounded-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Rocket className="w-6 h-6 text-teal-400 shrink-0" />
          <h2 className="text-base font-semibold text-app-primary">
            {strings.autoStartDialog.title}
          </h2>
        </div>

        <p className="text-sm text-slate-200 mb-6">
          {strings.autoStartDialog.message}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onAccept}
            className="flex-1 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {strings.autoStartDialog.accept}
          </button>
          <button
            onClick={onSkip}
            className="px-4 py-2 text-sm text-slate-100 hover:text-app-primary hover:bg-slate-700 rounded-lg transition-colors"
          >
            {strings.autoStartDialog.skip}
          </button>
        </div>
      </div>
    </div>
  );
}
