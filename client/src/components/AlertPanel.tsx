import { AlertTriangle, XCircle, CheckCircle, X } from "lucide-react";
import { useAppStore } from "../store/useAppStore";

const styles = {
  success: "bg-green-900/50 border-green-500 text-green-200",
  warning: "bg-yellow-900/50 border-yellow-500 text-yellow-200",
  error: "bg-red-900/50 border-red-500 text-red-200",
};

const icons = {
  success: <CheckCircle className="w-4 h-4 shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 shrink-0" />,
  error: <XCircle className="w-4 h-4 shrink-0" />,
};

export function AlertPanel() {
  const { alerts, removeAlert } = useAppStore();

  if (alerts.length === 0) return null;

  return (
    <div className="px-6 pt-4 flex flex-col gap-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm ${styles[alert.type]}`}
        >
          {icons[alert.type]}
          <span className="flex-1">{alert.message}</span>
          <button
            onClick={() => removeAlert(alert.id)}
            className="p-1 hover:bg-white/10 rounded"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
