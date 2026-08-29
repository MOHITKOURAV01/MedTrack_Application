import { Search } from "lucide-react";

/**
 * Shared search input primitives.
 *
 * Seven hub pages previously defined their own `SearchBox` component inline
 * (byte-identical except the Cold Chain hub's cyan focus ring), and nine
 * variant-B pages each rendered a compact inline search input with an
 * emerald focus ring. This module is the single source of truth for both:
 *
 *  - `SearchBox`      - the full-width panel search (variant A): `w-full
 *    sm:w-72`, larger padding, sky focus ring by default (`accent="cyan"`
 *    for the Cold Chain hub).
 *  - `CompactSearch`  - the toolbar search (variant B): fixed `w-64`,
 *    smaller padding, emerald focus ring.
 *
 * Naming
 * ------
 * Both used to carry a `placeholder` and nothing else, which is not a label:
 * it vanishes on the first keystroke, screen readers are not required to
 * announce it (and several do not), and it is explicitly not a programmatic
 * name under WCAG 3.3.2 / 4.1.2. That mattered most on the variant-A consoles,
 * where the placeholder is computed per tab - ``Search ${activeMeta.label}…`` -
 * so it was the only thing that ever said *which* of the three tabs the box
 * filtered, and it said it only while the field was empty.
 *
 * `label` supplies the accessible name and falls back to the placeholder, so
 * every existing call site gets a named field without changing, while a caller
 * that wants a name outliving the user's first keystroke can pass one.
 */

/**
 * Resolves the accessible name for a search field.
 *
 * The placeholder fallback is deliberate: it is a poor label but a correct
 * name, and it is strictly better than the nothing that was there before. A
 * field with neither gets a generic name rather than staying anonymous.
 *
 * @param {string|undefined} label explicit name from the caller
 * @param {string|undefined} placeholder the visible placeholder text
 * @returns {string} the accessible name to apply
 */
export function resolveSearchLabel(label, placeholder) {
  const explicit = typeof label === "string" ? label.trim() : "";
  if (explicit) return explicit;
  const fromPlaceholder = typeof placeholder === "string" ? placeholder.trim() : "";
  if (fromPlaceholder) return fromPlaceholder;
  return "Search";
}

export function SearchBox({ value, onChange, placeholder, accent = "sky", label }) {
  const focusCls = accent === "cyan"
    ? "focus:border-cyan-500/50 focus:ring-cyan-500/20"
    : "focus:border-sky-500/50 focus:ring-sky-500/20";
  return (
    <div className="relative w-full sm:w-72">
      {/* pointer-events-none keeps the icon out of the hit path: it sits on top
          of the input's pl-10 gutter, so without this it swallows the click. */}
      <Search
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
      />
      <input
        type="search"
        aria-label={resolveSearchLabel(label, placeholder)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-600 outline-none transition ${focusCls}`}
      />
    </div>
  );
}

export function CompactSearch({ value, onChange, placeholder, label }) {
  return (
    <div className="relative">
      {/* This icon was missing pointer-events-none while SearchBox's had it, so
          on the nine variant-B consoles clicking the magnifier - the most
          obvious target in a search box - did nothing, and the user had to
          notice and click to the right of it. */}
      <Search
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
      />
      <input
        type="search"
        aria-label={resolveSearchLabel(label, placeholder)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-64 rounded-xl border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
      />
    </div>
  );
}
