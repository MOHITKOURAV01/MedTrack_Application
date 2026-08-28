import { useCallback } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, X } from "lucide-react";
import useTransientToasts, { toastRegionProps } from "../../hooks/useTransientToasts";

/* ------------------------------------------------------------------ */
/*  Compact (variant B) toast tray                                     */
/* ------------------------------------------------------------------ */

/**
 * Toast state + push helper for the compact hubs: keeps up to `max` toasts and auto-dismisses each
 * after 4.2s.
 *
 * `max` is now honoured exactly. The previous `[...t.slice(-max), next]` kept `max` toasts and
 * *then* appended, so the default of 4 held five. See src/hooks/useTransientToasts.js for that and
 * for the timers this used to leave armed after the console unmounted.
 *
 * `dismiss` is new: the tray had no way to close a toast, so an alert covering the corner of a
 * console stayed there for its full 4.2 seconds.
 */
export function useToastTray(max = 4) {
  const { toasts, push, dismiss } = useTransientToasts({ max });

  const toast = useCallback((msg, sev = "Low") => push({ msg, sev }), [push]);

  return { toasts, toast, removeToast: dismiss, dismiss };
}

/**
 * Fixed top-right toast renderer. `critical` lists which severities get the red shield icon
 * (per-page wording differs: High/Critical vs Critical/Flagged).
 *
 * The region is a live one, so a toast is announced when it appears rather than being visible only
 * to a reader who happens to be looking at that corner of the screen. `assertive` because this
 * tray carries severities.
 */
export default function ToastTray({ toasts, critical = ["High", "Critical"], onDismiss }) {
  return (
    <div
      className="fixed right-4 top-4 z-[60] flex w-80 flex-col gap-2"
      {...toastRegionProps("assertive", "Alerts")}
    >
      {toasts.map((t) => (
        <div key={t.id} className="flex items-start gap-2 rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-xl backdrop-blur">
          {critical.includes(t.sev) ? (
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-red-400" />
          ) : t.sev === "Medium" ? (
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
          ) : (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
          )}
          <p className="flex-1 text-xs text-slate-300">{t.msg}</p>
          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
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
