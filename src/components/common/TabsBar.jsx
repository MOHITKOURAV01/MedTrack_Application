import { useCallback, useId, useRef } from "react";

/**
 * Shared tab bar primitive.
 *
 * Sixteen hub pages previously rendered their module switcher inline with
 * (near-identical) `tabs.map(...)` blocks in two flavors:
 *
 *  - emerald accent (variant B): `tab === t.id`, `setTab(t.id)`, wrapped in a
 *    single `mt-5 flex flex-wrap gap-2` container. This variant is
 *    self-contained; render it where the old block sat.
 *  - sky/cyan accent (variant A): `activeTab === t.key`, `setActiveTab(t.key)`,
 *    inside a scrollable `flex gap-2 overflow-x-auto pb-1` row. The page keeps
 *    its own outer `mt-8` wrapper (it also holds the toolbar and tab content),
 *    so this variant renders ONLY the inner row.
 *
 * Both preserve the exact button markup of the page-local versions they
 * replace. `accent` selects the active-state color scheme; tabs may carry
 * either an `id` or a `key` field.
 *
 * Accessibility contract
 * ----------------------
 * These buttons are a tab strip, and until recently they said so nowhere. The
 * active tab was distinguished only by an emerald/sky/cyan tint, which meant:
 *
 *  - a screen reader announced three peer buttons with nothing marking the one
 *    whose panel was on screen;
 *  - a user who cannot separate `text-slate-400` from `text-emerald-300` on the
 *    same dark surface had no cue at all (WCAG 1.4.1);
 *  - every tab was its own tab stop, so reaching the last module on a console
 *    meant tabbing through all the others - and in the sky/cyan variant the
 *    later tabs are scrolled out of view inside `overflow-x-auto`, so that
 *    tabbing was done blind.
 *
 * The strip now follows the WAI-ARIA tabs pattern: `role="tablist"` /
 * `role="tab"` / `aria-selected`, a single tab stop with roving `tabIndex`, and
 * Left/Right/Home/End to move between tabs. The active tab additionally carries
 * an underline drawn in `currentColor`, so the selected state is a difference in
 * *shape* and not only in hue.
 *
 * `aria-controls` is emitted only when the caller supplies `panelIdFor`, because
 * pointing the attribute at an element id that does not exist is worse for a
 * screen reader than omitting it. Pages that give their tab panel an id can opt
 * in; pages that have not yet are no worse off than before.
 */

/** Keys that move the selection within a tab strip, per the ARIA tabs pattern. */
const NAVIGATION_KEYS = ["ArrowLeft", "ArrowRight", "Home", "End"];

/**
 * The index the given key should move focus to.
 *
 * Left/Right wrap, matching the pattern's "automatic activation" behaviour, so a
 * user at either end keeps moving rather than hitting a silent wall.
 *
 * @param {string} key the `event.key` value
 * @param {number} current index of the currently active tab
 * @param {number} count number of tabs
 * @returns {number} the index to move to
 */
export function nextTabIndex(key, current, count) {
  if (count <= 0) return 0;
  switch (key) {
    case "ArrowLeft":
      return (current - 1 + count) % count;
    case "ArrowRight":
      return (current + 1) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return current;
  }
}

/** A tab's identity, tolerating both the `id` and `key` shapes callers use. */
const tabIdOf = (tab) => tab.id ?? tab.key;

export function TabsBar({
  tabs,
  active,
  onChange,
  accent = "emerald",
  label = "Modules",
  panelIdFor,
}) {
  const emerald = accent === "emerald";
  const activeCls = emerald
    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
    : accent === "cyan"
      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400 shadow-lg shadow-cyan-500/10"
      : "border-sky-500/50 bg-sky-500/10 text-sky-400 shadow-lg shadow-sky-500/10";
  const inactiveCls = emerald
    ? "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
    : "border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:text-slate-200";
  const btnCls = emerald
    ? "flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
    : "flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition";
  const iconSize = emerald ? 15 : 16;

  // The non-color cue. `bg-current` inherits the button's text color, so the
  // underline is drawn in whatever the active accent happens to be without
  // needing a fourth per-accent class - and its presence, not its hue, is what
  // distinguishes the selected tab.
  const selectedCue =
    "relative after:absolute after:inset-x-4 after:-bottom-px after:h-0.5 after:rounded-full after:bg-current";

  const list = Array.isArray(tabs) ? tabs : [];
  const baseId = useId();
  const buttonRefs = useRef([]);

  const handleKeyDown = useCallback(
    (event) => {
      if (!NAVIGATION_KEYS.includes(event.key)) {
        return;
      }
      const currentIndex = list.findIndex((tab) => tabIdOf(tab) === active);
      // A strip whose `active` matches no tab still has to respond to Home/End;
      // treating "no match" as index 0 makes ArrowRight land on the second tab,
      // which is the least surprising thing an arrow key can do here.
      const from = currentIndex === -1 ? 0 : currentIndex;
      const target = nextTabIndex(event.key, from, list.length);
      if (target === currentIndex) {
        return;
      }
      // preventDefault stops Home/End scrolling the page and ArrowLeft/Right
      // scrolling the `overflow-x-auto` row out from under the moving focus.
      event.preventDefault();
      onChange(tabIdOf(list[target]));
      buttonRefs.current[target]?.focus();
    },
    [active, list, onChange]
  );

  const buttons = list.map((t, index) => {
    const Icon = t.icon;
    const id = tabIdOf(t);
    const isActive = active === id;
    return (
      <button
        key={id}
        // Held so a key press can move focus to the tab it just selected.
        ref={(node) => {
          buttonRefs.current[index] = node;
        }}
        type="button"
        role="tab"
        id={`${baseId}-tab-${id}`}
        aria-selected={isActive}
        aria-controls={panelIdFor ? panelIdFor(id) : undefined}
        // Roving tabIndex: the strip is one tab stop, and arrow keys move within
        // it. Without this every tab is a stop of its own.
        tabIndex={isActive ? 0 : -1}
        onKeyDown={handleKeyDown}
        onClick={() => onChange(id)}
        className={`${btnCls} ${isActive ? `${activeCls} ${selectedCue}` : inactiveCls}`}
      >
        {/* Guarded: a tab declared without an icon used to throw `Element type
            is invalid` out of this component and take the whole console down.
            Callers already vary between `id` and `key`; the icon gets the same
            tolerance. */}
        {Icon ? <Icon size={iconSize} aria-hidden="true" /> : null}
        {t.label}
      </button>
    );
  });

  if (emerald) {
    return (
      <div role="tablist" aria-label={label} className="mt-5 flex flex-wrap gap-2">
        {buttons}
      </div>
    );
  }
  return (
    <div role="tablist" aria-label={label} className="flex gap-2 overflow-x-auto pb-1">
      {buttons}
    </div>
  );
}
