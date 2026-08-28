import { meterAria, percentWidth } from "../../utils/percent";

const TONE_FILL = {
  sky: "bg-sky-500",
  rose: "bg-rose-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
};

/**
 * Shared full-width progress bar for the simulated hub consoles.
 *
 * `pct` goes through `percentWidth` rather than an inline `Math.min/Math.max` pair. The five call
 * sites include three that compute a ratio - enrollment matched over enrolled, care tasks done
 * over total, shipment legs completed over legs - and each of those is `NaN` when the denominator
 * is zero, which is the ordinary state of a list that has not filled in yet. `NaN%` is not a valid
 * CSS length, so React dropped the `style` attribute entirely and the fill took the track's full
 * width: an empty trial arm rendered as fully enrolled. See src/utils/percent.js.
 *
 * @param {unknown} pct the reading, 0-100; anything unreadable draws an empty bar
 * @param {string} tone fill colour key; an unknown tone falls back to sky
 * @param {string} label accessible name; omit only where a visible label sits beside the bar
 */
export function ProgressBar({ pct, tone = "sky", label }) {
  const cls = TONE_FILL[tone] || TONE_FILL.sky;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
      {...meterAria(pct, label)}
    >
      <div
        className={`h-full rounded-full ${cls} transition-all duration-700`}
        style={{ width: percentWidth(pct) }}
      />
    </div>
  );
}

export default ProgressBar;
