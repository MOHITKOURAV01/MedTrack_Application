/**
 * Shared sparkline primitives.
 *
 * Eleven hub pages previously defined their own (near-identical) `Sparkline`
 * or `MiniSparkline` component inline. This module is the single source of
 * truth. `MiniSparkline` is a superset of the page-local versions:
 *   - `min`/`max` clamp the y-range (some pages passed these props to a
 *     component that ignored them - now honored)
 *   - `filled` renders the subtle area fill under the line (disabled where a
 *     page did not render it)
 *   - `ariaLabel` is configurable (previously each page hardcoded its own)
 *
 * Both exports go through the same `plot()` helper, because both had the same
 * two defects: a reading outside the given bounds was drawn outside the SVG
 * box, and a non-finite value was emitted into the coordinate list where it
 * silently truncated the line.
 */

const SPARK_STROKES = {
  sky: "#38bdf8",
  rose: "#fb7185",
  amber: "#fbbf24",
  emerald: "#34d399",
  violet: "#a78bfa",
  cyan: "#22d3ee",
};

/** Fallback stroke for an unrecognised tone. */
const DEFAULT_STROKE = "#38bdf8";

/**
 * Keeps only the entries that can be plotted.
 *
 * Nothing rejected `NaN`, `Infinity`, `null` or a string before. One of them produced a coordinate
 * such as `"12.0,NaN"`, which is an invalid `points` list - browsers stop drawing at the invalid
 * pair, with no console error and no visual cue. The card renders, the axis renders, and the trend
 * is simply shorter or absent. A gap in the data should not look like a flat reading either, so the
 * bad entries are dropped rather than substituted.
 *
 * @param {unknown} points
 * @returns {number[]} the finite numeric entries, in order
 */
export function finitePoints(points) {
  if (!Array.isArray(points)) {
    return [];
  }
  return points.filter((value) => typeof value === "number" && Number.isFinite(value));
}

/**
 * The y-range to plot against.
 *
 * Reduces rather than spreading into `Math.min`/`Math.max`: a spread call throws
 * `RangeError: Maximum call stack size exceeded` past the engine's argument limit, which is a hard
 * ceiling on series length that a shared primitive should not have.
 *
 * Bounds arriving inverted (`min` above `max`) are normalised rather than rendered upside down, and
 * a zero-height range is widened so a flat series draws along the middle instead of dividing by
 * zero.
 *
 * @param {number[]} values finite readings
 * @param {number|null} min explicit lower bound, or null to take it from the data
 * @param {number|null} max explicit upper bound, or null to take it from the data
 * @returns {{lo: number, hi: number, range: number}}
 */
export function plotRange(values, min = null, max = null) {
  const dataLo = values.reduce((acc, v) => (v < acc ? v : acc), values[0]);
  const dataHi = values.reduce((acc, v) => (v > acc ? v : acc), values[0]);

  const requestedLo = Number.isFinite(min) ? min : dataLo;
  const requestedHi = Number.isFinite(max) ? max : dataHi;

  const lo = Math.min(requestedLo, requestedHi);
  const hi = Math.max(requestedLo, requestedHi);
  const range = hi - lo || 1;

  return { lo, hi, range };
}

/**
 * Projects readings onto the chart box, clamped to it.
 *
 * The clamp is the fix. `MiniSparkline` accepted explicit bounds and then plotted against them
 * without one, so `(p - lo) / range` could exceed 1 and put `y` above the top of the box - negative,
 * for a large enough excursion. The element carries `overflow-visible` (so the end-cap circle at
 * `cx={width - 1}` is not shaved in half), which meant the line was painted over whatever sat above
 * or below the component.
 *
 * The callers pass the *alarm* range - `min={u.rangeMin - 2} max={u.rangeMax + 2}` in the cold-chain
 * console - so the readings that escaped were exactly the excursions the chart exists to show.
 *
 * Clamping is the right behaviour for a bounded sparkline: the reading is out of range, and the
 * chart's job is to show it sitting at the boundary, not to redraw itself around it. A caller that
 * wants the outlier in view passes wider bounds, or none at all.
 *
 * @param {number[]} values finite readings
 * @param {{width: number, height: number, pad: number, lo: number, hi: number, range: number}} box
 * @returns {Array<{x: number, y: number}>}
 */
export function plot(values, { width, height, pad, lo, hi, range }) {
  const usable = Math.max(0, height - pad * 2);
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  return values.map((value, index) => {
    const clamped = Math.min(hi, Math.max(lo, value));
    return {
      x: index * step,
      y: height - pad - ((clamped - lo) / range) * usable,
    };
  });
}

const toPath = (coords) =>
  coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

const toPoints = (coords) => coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

export function Sparkline({ points, color = "#34d399", w = 88, h = 24, ariaLabel = "trend sparkline" }) {
  const values = finitePoints(points);
  // The placeholder honours `h`. It was a hardcoded `h-6` (24px), so a Sparkline rendered at h={44}
  // collapsed to 24px whenever its series was short and the surrounding card jumped 20px when the
  // data arrived. MiniSparkline already did this correctly.
  if (values.length < 2) {
    return <div style={{ height: h }} />;
  }

  const { lo, hi, range } = plotRange(values);
  const coords = plot(values, { width: w, height: h, pad: 2, lo, hi, range });
  const last = coords[coords.length - 1];

  return (
    <svg width={w} height={h} className="overflow-visible" role="img" aria-label={ariaLabel}>
      <path d={toPath(coords)} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w - 1} cy={last.y} r="2.2" fill={color} />
    </svg>
  );
}

export function MiniSparkline({ points, tone = "sky", width = 130, height = 38, min = null, max = null, filled = true, ariaLabel = "trend sparkline" }) {
  const values = finitePoints(points);
  if (values.length < 2) {
    return <div style={{ height }} />;
  }

  const { lo, hi, range } = plotRange(values, min, max);
  const coords = plot(values, { width, height, pad: 3, lo, hi, range });
  const stroke = SPARK_STROKES[tone] || DEFAULT_STROKE;
  const last = coords[coords.length - 1];
  const points2d = toPoints(coords);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" role="img" aria-label={ariaLabel}>
      {filled && <polygon points={`0,${height} ${points2d} ${width},${height}`} fill={stroke} opacity="0.08" />}
      <polyline points={points2d} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" opacity="0.95" />
      <circle cx={width - 1} cy={last.y} r="2.4" fill={stroke} />
    </svg>
  );
}
