import { describe, it, expect } from "vitest";
import { meterAria, percentWidth, toPercent } from "../../utils/percent";

/**
 * The behaviour these assert is the difference between an empty bar and a full one, so they are
 * written against the value rather than against the rendered attribute wherever possible.
 */
describe("toPercent", () => {
  it("passes an in-range number through untouched", () => {
    expect(toPercent(0)).toBe(0);
    expect(toPercent(37.5)).toBe(37.5);
    expect(toPercent(100)).toBe(100);
  });

  it("clamps to the ends of the range", () => {
    expect(toPercent(-1)).toBe(0);
    expect(toPercent(-1e6)).toBe(0);
    expect(toPercent(101)).toBe(100);
    expect(toPercent(1e6)).toBe(100);
  });

  it("reads a numeric string, because a reading straight off a JSON payload is one", () => {
    expect(toPercent("72")).toBe(72);
    expect(toPercent("72.5")).toBe(72.5);
    expect(toPercent(" 72 ")).toBe(72);
    expect(toPercent("120")).toBe(100);
    expect(toPercent("-5")).toBe(0);
  });

  it("returns 0 - not 100 - for every value it cannot read", () => {
    // This is the whole point. Each of these produced NaN under the old expression, which React
    // dropped from the style attribute, which left the fill at the track's full width.
    expect(toPercent(undefined)).toBe(0);
    expect(toPercent(NaN)).toBe(0);
    expect(toPercent(Infinity)).toBe(0);
    expect(toPercent(-Infinity)).toBe(0);
    expect(toPercent("n/a")).toBe(0);
    expect(toPercent("")).toBe(0);
    expect(toPercent({})).toBe(0);
    expect(toPercent([1, 2])).toBe(0);
    expect(toPercent(() => 50)).toBe(0);
  });

  it("treats null as zero, matching what the old expression already did", () => {
    expect(toPercent(null)).toBe(0);
  });

  it("returns 0 for the divide-by-zero shapes the call sites actually compute", () => {
    // ClinicalTrialHub: (matched.length / patients.length) * 100 for an arm with no patients.
    expect(toPercent((0 / 0) * 100)).toBe(0);
    // TelehealthHub: (a.tasksDone / a.tasksTotal) * 100 for a patient with no care tasks.
    expect(toPercent((3 / 0) * 100)).toBe(0);
    // SurgicalRoboticsHub: (i.uses / i.limit) * 100 for an instrument with no recorded limit.
    expect(toPercent((12 / undefined) * 100)).toBe(0);
  });
});

describe("percentWidth", () => {
  it("always produces a valid CSS length", () => {
    for (const value of [undefined, null, NaN, Infinity, "n/a", {}, -3, 250, 42]) {
      expect(percentWidth(value)).toMatch(/^\d+(\.\d+)?%$/);
    }
  });

  it("formats the clamped value", () => {
    expect(percentWidth(42)).toBe("42%");
    expect(percentWidth(42.5)).toBe("42.5%");
    expect(percentWidth(-1)).toBe("0%");
    expect(percentWidth(1000)).toBe("100%");
    expect(percentWidth(undefined)).toBe("0%");
  });
});

describe("meterAria", () => {
  it("describes the meter as a progressbar over 0-100", () => {
    expect(meterAria(60, "Time in range")).toEqual({
      role: "progressbar",
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-valuenow": 60,
      "aria-label": "Time in range",
    });
  });

  it("reports the value that is actually drawn, not the one that was passed", () => {
    expect(meterAria(140)["aria-valuenow"]).toBe(100);
    expect(meterAria(-40)["aria-valuenow"]).toBe(0);
    expect(meterAria(undefined)["aria-valuenow"]).toBe(0);
  });

  it("omits the label rather than emitting an empty accessible name", () => {
    expect(meterAria(10)).not.toHaveProperty("aria-label");
    expect(meterAria(10, "")).not.toHaveProperty("aria-label");
  });
});
