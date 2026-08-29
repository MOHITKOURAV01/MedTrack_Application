/**
 * Shared filter-chip cluster.
 *
 * Nine hub pages rendered their per-tab status filters inline as near-identical
 * clusters: `{options.map((f) => <button>)}` with emerald active styling. This
 * module is the single source of truth; pass the option list, the current
 * value, the setter, and a `label` naming what the cluster filters.
 *
 * Why these carry `aria-pressed` and a group label
 * ------------------------------------------------
 * The cluster used to emit bare buttons whose only selected-state cue was an
 * emerald tint. Two things went wrong with that.
 *
 * The applied filter was invisible to anything but the eye. There was no
 * `aria-pressed`, so nothing in the accessibility tree said which chip was on,
 * and the visual cue was a hue swap between two low-contrast tints of the same
 * dark surface - `text-emerald-300` on `bg-emerald-500/10` against
 * `text-slate-400` on `bg-slate-900`, with no weight, border or outline change
 * to fall back on (WCAG 1.4.1). A user could not tell whether the table below
 * was filtered at all.
 *
 * The cluster never said what it filtered. Each console renders one cluster per
 * tab, and the chip text alone carries no subject: on the Lab Automation fleet
 * tab a screen reader reads "All, Running, Idle, Maintenance" with nothing
 * tying those to analyzer status, and the same four words would do equally well
 * for samples or QC runs. `label` gives the cluster a name.
 *
 * `aria-pressed` is the right attribute rather than `role="radio"`: these
 * toggle a filter on a control surface rather than being a form field awaiting
 * submission, and the "All" chip is a reset rather than a peer option.
 */

/**
 * A stable React key for an option.
 *
 * Options are plain strings today and "All" appears in every cluster, so the
 * option's own text is unique *within* a cluster. Including the index keeps the
 * key stable if a caller ever passes a list with a repeated entry, which would
 * otherwise silently drop a chip.
 *
 * @param {string} option the option text
 * @param {number} index its position in the list
 * @returns {string} a key unique within the cluster
 */
const chipKey = (option, index) => `${index}-${option}`;

export function FilterChips({ options, value, onChange, label }) {
  const list = Array.isArray(options) ? options : [];

  return (
    <div
      className="flex gap-1.5"
      // Without a role there is no container for a name to attach to, so the
      // chips were an anonymous run of buttons whose text never said what they
      // filtered. `label` is optional so a caller that omits it is no worse off
      // than before, and the group only appears once there is a name for it.
      role={label ? "group" : undefined}
      aria-label={label || undefined}
    >
      {list.map((f, index) => {
        const isActive = value === f;
        return (
          <button
            key={chipKey(f, index)}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(f)}
            className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
              isActive
                ? // font-bold and the ring are the non-colour cues: the selected
                  // chip differs in weight and outline, not only in hue.
                  "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-bold ring-1 ring-inset ring-emerald-400/40"
                : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
            }`}
          >
            {f}
          </button>
        );
      })}
    </div>
  );
}
