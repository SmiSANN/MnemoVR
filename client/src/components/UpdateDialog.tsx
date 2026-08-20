import { useState } from "react";
import { ExternalLink, ArrowUpCircle } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { strings } from "../lib/strings";

interface Props {
  latestVersion: string;
  onDismiss: (skipThisVersion: boolean) => void;
}

const RELEASES_URL = "https://github.com/SmiSANN/MnemoVR/releases/latest";

export function UpdateDialog({ latestVersion, onDismiss }: Props) {
  const [skip, setSkip] = useState(false);

  function handleOpenRelease() {
    openUrl(RELEASES_URL);
    onDismiss(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 border border-slate-600 rounded-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <ArrowUpCircle className="w-6 h-6 text-teal-400 shrink-0" />
          <h2 className="text-base font-semibold text-app-primary">
            {strings.updateDialog.title}
          </h2>
        </div>

        <p className="text-sm text-slate-200 mb-5">
          {strings.updateDialog.newVersionPrefix} <span className="text-teal-400 font-medium">{latestVersion}</span> {strings.updateDialog.newVersionSuffix}<br />
          {strings.updateDialog.downloadPrompt}
        </p>

        <label className="flex items-center gap-2 cursor-pointer mb-5">
          <input
            type="checkbox"
            checked={skip}
            onChange={(e) => setSkip(e.target.checked)}
            className="w-4 h-4 accent-teal-500 cursor-pointer"
          />
          <span className="text-xs text-slate-300">{strings.updateDialog.skipVersion}</span>
        </label>

        <div className="flex gap-3">
          <button
            onClick={handleOpenRelease}
            className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            {strings.updateDialog.openDownloadPage}
          </button>
          <button
            onClick={() => onDismiss(skip)}
            className="px-4 py-2 text-sm text-slate-100 hover:text-app-primary hover:bg-slate-700 rounded-lg transition-colors"
          >
            {strings.updateDialog.later}
          </button>
        </div>
      </div>
    </div>
  );
}
