/**
 * The one percentage clamp for every bar-style meter in the application.
 *
 * Why this module exists
 * ----------------------
 * Nine components independently wrote this expression to size a meter fill:
 *
 *   style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
 *
 * It clamps a number correctly and fails silently on everything else, in the one direction that
 * matters. `Math.max(0, undefined)` is `NaN`, `Math.min(100, NaN)` is `NaN`, and the template
 * literal turns that into the string `"NaN%"`. React refuses to write an invalid CSS length, so it
 * drops the whole `style` attribute rather than the one declaration:
 *
 *   <div class="h-full rounded-full bg-emerald-400"></div>
 *
 * The fill is a block-level child of a block-level track with no width of its own, so its used
 * width is `auto` - the full width of the track. **A missing or non-numeric reading therefore
 * renders as a completely full bar**, and on every one of these meters the full bar is the
 * reassuring reading: 100% time in range, 100% of care tasks done, a fully enrolled trial arm.
 *
 * The value does not have to be absent for this to happen. `(a.tasksDone / a.tasksTotal) * 100` is
 * `NaN` when the patient has no tasks; `(matched.length / patients.length) * 100` is `NaN` for an
 * arm with no patients; `(i.uses / i.limit) * 100` is `NaN` for an instrument with no recorded use
 * limit. Every one of those is a live call site, and division by zero is not an exotic input in a
 * console whose lists start empty and fill in as data arrives.
 *
 * `toPercent` fails the other way. Anything it cannot read as a finite number becomes 0 - an empty
 * bar, which reads as "no data" rather than as "complete".
 */

/**
 * Coerces a value to a percentage in [0, 100].
 *
 * Numeric strings are accepted because a meter fed straight from a JSON payload or a CSV cell
 * receives `"72"` rather than `72`, and `Math.min/Math.max` already coerced those correctly - so
 * rejecting them here would be a regression rather than a fix.
 *
 * @param {unknown} value the reading; numbers and numeric strings are read, everything else is 0
 * @returns {number} a finite number between 0 and 100 inclusive
 */
export function toPercent(value) {
  const numeric = typeof value === "number" ? value : Number(value);

  // Number(null) is 0 and Number("") is 0, which happen to be the right answer. Number(undefined),
  // Number(NaN), Number("n/a") and Number([1,2]) are all NaN, which is the case this exists for.
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  if (numeric < 0) return 0;
  if (numeric > 100) return 100;
  return numeric;
}

/**
 * The CSS width for a meter fill, as a percentage string.
 *
 * Always returns a valid length, so the `style` attribute is never dropped and a fill never
 * inherits the track's width by accident.
 *
 * @param {unknown} value the reading
 * @returns {string} e.g. "72%", or "0%" for anything unreadable
 */
export function percentWidth(value) {
  return `${toPercent(value)}%`;
}

/**
 * The ARIA attributes a meter fill's track needs to be announced.
 *
 * A bar that carries a number a sighted user can read is a bar a screen-reader user cannot, unless
 * the number is exposed. `aria-valuenow` is the clamped value, matching what is actually drawn.
 *
 * @param {unknown} value the reading
 * @param {string} label an accessible name for the meter, e.g. "Time in range"
 * @returns {object} props to spread onto the track element
 */
export function meterAria(value, label) {
  return {
    role: "progressbar",
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-valuenow": toPercent(value),
    ...(label ? { "aria-label": label } : {}),
  };
}
