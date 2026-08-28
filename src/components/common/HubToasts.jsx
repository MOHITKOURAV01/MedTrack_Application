import { useCallback } from "react";
import { AlertTriangle, Bell, CheckCircle2, ShieldAlert, X } from "lucide-react";
import useTransientToasts, { toastRegionProps } from "../../hooks/useTransientToasts";

/**
 * Shared toast state + renderers for the new hub pages.
 *
 * Two flavors exist, matching the two toast conventions the new hub pages copied from their seed
 * data:
 *
 *  - `useKindToasts` / `KindToastTray`  - `{ id, msg, kind }` with kind = "info" | "warn" | "error",
 *    bottom-right stack (blood bank, cardiology, pathology, neonatal). Keeps three toasts.
 *  - `useSeverityToasts` / `SeverityToastTray` - `{ id, message, severity }` with severity =
 *    "Low" | "Medium" | "High", top-right stack (transfusion, oncology, renal, sterile). Keeps four.
 *
 * Both auto-dismiss after 4.2s and now share their state with every other hub tray through
 * `useTransientToasts`, which is where the cap, the ids and the timer cleanup live. Each kept its
 * own copy before, and each carried the same three defects: the cap was one too high, the
 * dismissal timers were never cleared when the console unmounted, and a toast could not be closed.
 *
 * Both trays are live regions, so an alert is announced rather than being visible only to whoever
 * is looking at that corner of the screen when it appears.
 */

export function useKindToasts() {
  const { toasts, push, dismiss } = useTransientToasts({ max: 3 });

  const addToast = useCallback((msg, kind = "info") => push({ msg, kind }), [push]);

  // `removeToast` is the name six consoles already destructure and pass as `onDismiss`.
  return { toasts, addToast, removeToast: dismiss, dismiss };
}

export function KindToastTray({ toasts, onDismiss }) {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 space-y-2"
      {...toastRegionProps("polite", "Notifications")}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${
            t.kind === "error"
              ? "border-rose-500/50 bg-rose-950/90 text-rose-200"
              : t.kind === "warn"
                ? "border-amber-500/50 bg-amber-950/90 text-amber-200"
                : "border-emerald-500/50 bg-emerald-950/90 text-emerald-200"
          }`}
        >
          {t.kind === "error" ? <AlertTriangle className="h-4 w-4 shrink-0" /> : t.kind === "warn" ? <Bell className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          <span className="flex-1">{t.msg}</span>
          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 opacity-60 transition hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function useSeverityToasts() {
  const { toasts, push, dismiss } = useTransientToasts({ max: 4 });

  const toast = useCallback((message, severity = "Low") => push({ message, severity }), [push]);

  return { toasts, toast, removeToast: dismiss, dismiss };
}

export function SeverityToastTray({ toasts, onDismiss }) {
  return (
    <div
      className="fixed right-4 top-4 z-[60] flex w-80 flex-col gap-2"
      {...toastRegionProps("assertive", "Alerts")}
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-2 rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-xl backdrop-blur"
        >
          {item.severity === "High" ? (
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-red-400" />
          ) : item.severity === "Medium" ? (
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
          ) : (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
          )}
          <p className="flex-1 text-xs text-slate-300">{item.message}</p>
          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              aria-label="Dismiss notification"
              className="shrink-0 text-slate-600 transition hover:text-white"
            >
              <X size={13} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
