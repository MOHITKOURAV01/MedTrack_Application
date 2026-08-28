/**
 * Historical entry point for the shared meter.
 *
 * This file held a second, byte-identical copy of `MeterBar.jsx`'s component that nothing ever
 * imported - an extraction that was made twice and adopted once. It carried the same
 * `Math.min(100, Math.max(0, value))` defect as every other copy, so leaving it in place meant the
 * next page to reach for `common/Meter` would have picked up the bug again.
 *
 * It re-exports rather than being deleted so an import written against either path resolves to the
 * same component.
 */
export { Meter, default } from "./MeterBar";
