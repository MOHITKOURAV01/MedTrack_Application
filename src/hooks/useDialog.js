import { useCallback, useEffect, useRef } from "react";

/**
 * The behaviour a `role="dialog" aria-modal="true"` element is claiming to have.
 *
 * Declaring the role is a promise about focus, not just a label. The three shared modals declared
 * it (or, in two cases, did not declare it while behaving as one anyway) and delivered none of it:
 * focus stayed on whatever was behind the overlay, Tab walked the page underneath, Escape closed
 * one of the three, and the background scrolled.
 *
 * This hook is the behaviour, kept out of the components so all three get the same one:
 *
 *  1. **Focus moves in.** On open, the first focusable element inside the panel takes focus, or the
 *     panel itself if it holds none. Without this a keyboard user's next Tab lands on the element
 *     after whatever they last clicked - somewhere on the page behind the overlay.
 *  2. **Focus is trapped.** Tab from the last focusable element wraps to the first, Shift+Tab from
 *     the first wraps to the last.
 *  3. **Focus is restored.** On close, focus returns to the element that had it when the dialog
 *     opened, so the list a user opened a row from is where their cursor comes back to.
 *  4. **Escape closes.** Every dialog, not one of the three.
 *  5. **The page behind stops scrolling**, so a wheel gesture over the overlay does not scroll the
 *     list underneath while the panel sits still.
 *
 * @param {object} options
 * @param {boolean} options.open whether the dialog is currently rendered
 * @param {Function} options.onClose called on Escape
 * @returns {{panelRef: object}} ref to attach to the dialog panel element
 */
export default function useDialog({ open, onClose }) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  // `onClose` is nearly always an inline arrow at the call site, so a new identity arrives on every
  // render of the page. Holding it in a ref keeps the listeners from being torn down and
  // reinstalled each time, which would drop the focus trap for a frame.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    restoreRef.current = document.activeElement;

    const panel = panelRef.current;
    if (panel) {
      const first = focusableWithin(panel)[0];
      if (first) {
        first.focus();
      } else {
        // Nothing to focus - make the panel itself the focus holder so Tab starts from inside it.
        panel.setAttribute("tabindex", "-1");
        panel.focus();
      }
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (typeof onCloseRef.current === "function") onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = focusableWithin(panelRef.current);
      if (focusable.length === 0) {
        // Nowhere to go: keep focus on the panel rather than letting it escape to the page behind.
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panelRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;

      const restore = restoreRef.current;
      restoreRef.current = null;
      if (restore && typeof restore.focus === "function" && document.contains(restore)) {
        restore.focus();
      }
    };
  }, [open]);

  return { panelRef };
}

/**
 * A backdrop click handler that only fires when the gesture *started* on the backdrop.
 *
 * The three modals closed on any click that reached the overlay. Selecting text inside the panel
 * and releasing the mouse a few pixels outside it produces exactly such a click, because the click
 * event fires on the nearest common ancestor of press and release - the overlay. On a modal
 * holding a half-typed note that is the user's work, thrown away by a text selection.
 *
 * Recording where the press landed and comparing it on release makes a stray release harmless
 * while an ordinary backdrop click still closes.
 *
 * @param {Function} onClose called for a click that began and ended on the backdrop
 * @returns {{onMouseDown: Function, onClick: Function}} props for the backdrop element
 */
export function useBackdropDismiss(onClose) {
  const pressedOnBackdrop = useRef(false);

  const onMouseDown = useCallback((event) => {
    pressedOnBackdrop.current = event.target === event.currentTarget;
  }, []);

  const onClick = useCallback(
    (event) => {
      const startedHere = pressedOnBackdrop.current;
      pressedOnBackdrop.current = false;
      if (startedHere && event.target === event.currentTarget && typeof onClose === "function") {
        onClose();
      }
    },
    [onClose]
  );

  return { onMouseDown, onClick };
}

/**
 * Every element inside `root` that can currently take focus, in tab order.
 *
 * `disabled` and `[tabindex="-1"]` are excluded because they are not tab stops. Hidden elements are
 * excluded via `offsetParent`, which is null for anything `display: none` - a collapsed section
 * inside a dialog should not be a place Tab lands.
 */
export function focusableWithin(root) {
  if (!root || typeof root.querySelectorAll !== "function") return [];

  const selector = [
    "a[href]",
    "button",
    "input",
    "select",
    "textarea",
    "[tabindex]",
  ].join(",");

  return Array.from(root.querySelectorAll(selector)).filter((el) => !isSkipped(el));
}

/**
 * Whether an element should be skipped as a tab stop.
 *
 * Deliberately not `offsetParent !== null`. That is the usual shorthand for "is this laid out", and
 * it is wrong in both directions here: jsdom does no layout, so every element reports null and the
 * whole list would come back empty, while a `position: fixed` element in a real browser reports
 * null while being perfectly visible - and these panels sit inside a fixed overlay.
 *
 * `checkVisibility()` is the platform's own answer and is used where it exists. Everywhere else the
 * attribute checks are the whole filter, which is the conservative direction: at worst a hidden
 * element stays in the cycle, rather than the trap having nothing to cycle through.
 */
function isSkipped(el) {
  if (el.hasAttribute("disabled")) return true;
  if (el.getAttribute("aria-hidden") === "true") return true;
  if (el.getAttribute("tabindex") === "-1") return true;
  if (el.hasAttribute("hidden") || el.closest("[hidden]")) return true;
  if (typeof el.checkVisibility === "function") return !el.checkVisibility();
  return false;
}
