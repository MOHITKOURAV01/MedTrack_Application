import { useCallback, useEffect, useRef, useState } from "react";

/** How long a hub toast stays up before it dismisses itself. */
export const DEFAULT_TOAST_MS = 4200;

/**
 * The state behind every self-dismissing toast tray in the hub consoles.
 *
 * Four copies of this existed - `useToastTray`, `useKindToasts`, `useSeverityToasts` and
 * `useToasts` - differing only in the shape of the toast object and the dismissal delay. They
 * shared three defects, and sharing one implementation is how they stop diverging again.
 *
 * **The cap was off by one.** `[...prev.slice(-max), next]` keeps `max` existing toasts and then
 * appends, so a tray documented as holding four holds five. `slice(-(max - 1))` is the expression
 * that actually caps at `max`.
 *
 * **The dismissal timers outlived the component.** Nothing cleared them, so leaving a console with
 * toasts on screen left timers armed against a tray that no longer exists. React discards the
 * resulting state update silently, which is why this never surfaced as an error - but the timer,
 * its closure, and the toast list it captured stay reachable until it fires. These consoles push a
 * toast on every simulation tick.
 *
 * **A toast could not be dismissed.** Three of the four trays offered no way to close one; a nurse
 * who wanted the alert out of the way waited. `dismiss` is returned from all of them now.
 *
 * @param {object} [options]
 * @param {number} [options.max] how many toasts stay on screen
 * @param {number} [options.durationMs] how long each stays up
 * @returns {{toasts: Array, push: Function, dismiss: Function}}
 */
export default function useTransientToasts({ max = 4, durationMs = DEFAULT_TOAST_MS } = {}) {
  const [toasts, setToasts] = useState([]);

  // Ids come from a counter rather than Date.now(): two toasts pushed in the same tick of the
  // simulation loop get the same millisecond, and a duplicate React key drops one of them.
  const seqRef = useRef(0);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (fields) => {
      seqRef.current += 1;
      const id = `T-${seqRef.current}`;
      const keep = Math.max(0, max - 1);

      setToasts((prev) => [...prev.slice(-keep), { ...fields, id }]);

      timersRef.current.set(
        id,
        setTimeout(() => {
          timersRef.current.delete(id);
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, durationMs)
      );

      return id;
    },
    [max, durationMs]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return { toasts, push, dismiss };
}

/**
 * The container props every tray needs to be announced.
 *
 * A toast is the only notice these consoles give that a cold-chain unit drifted out of range or a
 * dose exceeded its ceiling. Rendered into a plain `<div>`, it reaches a screen reader only if the
 * user happens to be reading that corner of the page when it appears - which, for a notice that
 * removes itself after four seconds, means never.
 *
 * `role="log"` with `aria-live` is the right pairing for a stack that accumulates entries: the
 * region is announced as each toast is added, rather than the whole list being re-read. `polite`
 * waits for a pause in whatever is being read; `assertive` interrupts, and is reserved for the
 * trays that carry clinical severity.
 *
 * @param {"polite"|"assertive"} [politeness]
 * @param {string} [label] accessible name for the region
 */
export function toastRegionProps(politeness = "polite", label = "Notifications") {
  return {
    role: "log",
    "aria-live": politeness,
    "aria-relevant": "additions",
    "aria-label": label,
  };
}
