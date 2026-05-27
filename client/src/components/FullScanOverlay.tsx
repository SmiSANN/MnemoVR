import { useEffect, useState } from "react";
import { strings } from "../lib/strings";

export function FullScanOverlay() {
  const [textIdx, setTextIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIdx((prev) => (prev + 1) % strings.fullScan.funTexts.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col items-center justify-center gap-6">
      <div className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-lg text-slate-200 animate-pulse">{strings.fullScan.funTexts[textIdx]}</p>
      <div className="w-64 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full bg-teal-500 rounded-full animate-[progress_2s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
