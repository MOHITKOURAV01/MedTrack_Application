import { createContext, useContext, useMemo, useState, useCallback } from "react";

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info", duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // The provider previously built a fresh object literal on every render, so every consumer of
  // the context re-rendered whenever anything above it did, whether or not a toast had changed.
  const value = useMemo(
    () => ({ toasts, addToast, removeToast, isAvailable: true }),
    [toasts, addToast, removeToast]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

/**
 * What `useToast()` returns when no `ToastProvider` is mounted above the caller.
 *
 * Frozen and defined at module level rather than built per call, so a component sitting outside a
 * provider still gets a stable identity across renders and does not re-run every effect that
 * lists the toast API in its dependencies.
 */
const NO_PROVIDER_TOAST = Object.freeze({
  toasts: Object.freeze([]),
  addToast: () => null,
  removeToast: () => {},
  /** Lets a caller that genuinely needs a real toast system tell the difference. */
  isAvailable: false,
});

/**
 * Access the toast API.
 *
 * Outside a `ToastProvider` this returns a working no-op rather than `null`. The reason is the
 * shape of every call site:
 *
 *     const { addToast } = useToast();
 *
 * With a `null` context that line throws `TypeError: Cannot destructure property 'addToast' of
 * 'useToast(...)' as it is null` *during render*, which React treats as a render error and
 * unmounts the subtree to the ErrorBoundary. A page loses its entire content because a
 * notification was unavailable - and a toast is advisory. Nothing on these pages depends on one
 * being shown: `ProcurementRequestWizard` calls `addToast` once, after a successful create,
 * purely to say so. The form should still submit, the page should still render, the navigation
 * should still happen.
 *
 * The alternative design - throwing a named "useToast must be used within a ToastProvider" - is
 * defensible for a context whose absence really is a programming error. It is the wrong trade for
 * an advisory channel, and it is roughly what the previous code produced *accidentally*, in the
 * least useful form available: a destructuring TypeError pointing at the consumer rather than at
 * the missing provider.
 *
 * `ToastContainer` is the one consumer that needs a real provider, and with the fallback it
 * renders an empty list - the correct output for "no toast system is mounted".
 */
export const useToast = () => useContext(ToastContext) ?? NO_PROVIDER_TOAST;

export { ToastContext, NO_PROVIDER_TOAST };
