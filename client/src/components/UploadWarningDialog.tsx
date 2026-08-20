import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { strings } from "../lib/strings";

interface Props {
  onConfirm: (skipInFuture: boolean) => void;
  onCancel: () => void;
}

export function UploadWarningDialog({ onConfirm, onCancel }: Props) {
  const [skipInFuture, setSkipInFuture] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="bg-slate-800 rounded-2xl p-6 max-w-sm mx-4 w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 warning-icon shrink-0" />
          <h3 className="text-sm font-semibold text-app-primary">{strings.uploadWarning.title}</h3>
        </div>

        <p className="text-xs text-slate-200 leading-relaxed mb-4">
          {strings.uploadWarning.message}
        </p>

        <label className="flex items-center gap-2 cursor-pointer mb-5">
          <input
            type="checkbox"
            checked={skipInFuture}
            onChange={(e) => setSkipInFuture(e.target.checked)}
            className="w-4 h-4 accent-teal-500 cursor-pointer"
          />
          <span className="text-xs text-slate-300">{strings.uploadWarning.doNotShowAgain}</span>
        </label>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
          >
            {strings.common.cancel}
          </button>
          <button
            onClick={() => onConfirm(skipInFuture)}
            className="flex-1 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded-lg transition-colors"
          >
            {strings.uploadWarning.upload}
          </button>
        </div>
      </div>
    </div>
  );
}
