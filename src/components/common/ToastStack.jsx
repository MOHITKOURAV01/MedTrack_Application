import { useCallback } from "react";
import { X } from "lucide-react";
import useTransientToasts, { toastRegionProps } from "../../hooks/useTransientToasts";

/** How long a ToastStack toast stays up; longer than the other trays because these carry a body. */
const TOAST_MS = 6500;

/**
 * Toast state for the simulated hub pages: keeps the four most recent toasts, auto-dismisses each
 * after 6.5s, and returns a `dismissToast` for manual dismissal. Pages keep their own `seqRef` for
 * domain sequence numbers.
 *
 * The state now comes from `useTransientToasts`, shared with the other three hub trays. The cap is
 * honoured exactly - `[...prev.slice(-3), next]` held four only because `max` was hardcoded to
 * match - and the dismissal timers are cleared when the console unmounts, which they were not.
 */
export function useToasts() {
  const { toasts, push, dismiss } = useTransientToasts({ max: 4, durationMs: TOAST_MS });

  const pushToast = useCallback(
    (title, body, tone = "medium") => push({ title, body, tone }),
    [push]
  );

  return { toasts, pushToast, dismissToast: dismiss, removeToast: dismiss };
}

/**
 * Fixed bottom-right toast stack. `severityMeta` maps a tone to `{ border, dot }` classes (pages
 * pass their domain severity map, e.g. SEVERITY_META).
 *
 * A tone missing from the caller's map used to reach `severityMeta[t.tone] || severityMeta.medium`
 * and, for a map without a `medium` entry, produce `undefined` - then throw on `meta.border` and
 * take the console down with it. `toneMeta` settles on a neutral entry instead.
 */
const NEUTRAL_META = { border: "border-slate-700", dot: "bg-slate-500" };

export function toneMeta(severityMeta, tone) {
  const map = severityMeta || {};
  return map[tone] || map.medium || NEUTRAL_META;
}

export default function ToastStack({ toasts, onDismiss, severityMeta }) {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2"
      {...toastRegionProps("polite", "Notifications")}
    >
      {toasts.map((t) => {
        const meta = toneMeta(severityMeta, t.tone);
        return (
          <div key={t.id} className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-slate-900 p-3 shadow-2xl shadow-black/50 animate-fadeSlideIn ${meta.border}`}>
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white">{t.title}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{t.body}</p>
            </div>
            <button type="button" onClick={() => onDismiss(t.id)} className="text-slate-600 transition hover:text-white" aria-label="Dismiss notification">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
