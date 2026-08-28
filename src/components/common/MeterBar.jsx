import { meterAria, percentWidth } from "../../utils/percent";

/**
 * Shared thin progress meter - the single implementation behind every bar-style meter in the
 * hub consoles.
 *
 * The transfusion/oncology/renal/sterile hub pages each defined their own `Meter` inline -
 * identical except the track width (`w-24` vs `w-full`) - and seven more consoles
 * (endocrinology, security compliance, lab automation, radiology, pharmacovigilance,
 * regulatory audit, surgical robotics) kept a ninth and tenth copy of the same five lines.
 * `full` selects the wide variant.
 *
 * The fill is sized through `percentWidth`, which is the whole point of the consolidation: every
 * copy sized it with `Math.min(100, Math.max(0, value))`, which yields `NaN` for a missing or
 * non-numeric reading, which React drops from the `style` attribute, which leaves the fill at its
 * `auto` width - the full track. See src/utils/percent.js.
 *
 * @param {unknown} value the reading, 0-100; anything unreadable draws an empty bar
 * @param {string} color Tailwind background class for the fill
 * @param {boolean} full wide variant (`w-full`) rather than the fixed `w-24`
 * @param {string} label accessible name; omit only where a visible label sits beside the meter
 */
export const Meter = ({ value, color = "bg-emerald-400", full = false, label }) => (
  <div
    className={`h-1.5 ${full ? "w-full" : "w-24"} rounded-full bg-slate-800`}
    {...meterAria(value, label)}
  >
    <div className={`h-full rounded-full ${color}`} style={{ width: percentWidth(value) }} />
  </div>
);

export default Meter;
