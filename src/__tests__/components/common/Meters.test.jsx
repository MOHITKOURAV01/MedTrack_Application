import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ProgressBar } from "../../../components/common/ProgressBar";
import { Meter } from "../../../components/common/MeterBar";
import { Meter as MeterFromLegacyPath } from "../../../components/common/Meter";

/**
 * These assert against the rendered DOM rather than against the helper, because the failure was
 * never in the arithmetic - it was in what React does with the arithmetic's result. `NaN%` is not
 * a valid CSS length, so React omits the whole `style` attribute, and a fill with no width of its
 * own takes the width of its track. The bar reads as full.
 *
 * `fillOf` therefore returns the element, and the assertions look at the attribute itself.
 */
const trackOf = (container) => container.firstChild;
const fillOf = (container) => trackOf(container).firstChild;

describe("ProgressBar", () => {
  it("sizes the fill to the value", () => {
    const { container } = render(<ProgressBar pct={42} />);
    expect(fillOf(container)).toHaveStyle({ width: "42%" });
  });

  it("clamps out-of-range values to the ends of the track", () => {
    expect(fillOf(render(<ProgressBar pct={-20} />).container)).toHaveStyle({ width: "0%" });
    expect(fillOf(render(<ProgressBar pct={180} />).container)).toHaveStyle({ width: "100%" });
  });

  it("draws an empty bar - never a full one - for a value it cannot read", () => {
    for (const pct of [undefined, null, NaN, Infinity, "n/a"]) {
      const fill = fillOf(render(<ProgressBar pct={pct} />).container);
      // The regression this guards: no style attribute at all, so `width` falls back to `auto`.
      expect(fill.getAttribute("style")).not.toBeNull();
      expect(fill).toHaveStyle({ width: "0%" });
    }
  });

  it("draws an empty bar for the ratio a hub computes from an empty list", () => {
    // ClinicalTrialHub.jsx: pct={(matched.length / patients.length) * 100}
    const matched = [];
    const patients = [];
    const fill = fillOf(render(<ProgressBar pct={(matched.length / patients.length) * 100} />).container);
    expect(fill).toHaveStyle({ width: "0%" });
  });

  it("keeps every tone's fill colour and falls back to sky for an unknown one", () => {
    const toneFill = { sky: "bg-sky-500", rose: "bg-rose-500", amber: "bg-amber-500", emerald: "bg-emerald-500", violet: "bg-violet-500" };
    for (const [tone, cls] of Object.entries(toneFill)) {
      expect(fillOf(render(<ProgressBar pct={50} tone={tone} />).container).className).toContain(cls);
    }
    expect(fillOf(render(<ProgressBar pct={50} tone="chartreuse" />).container).className).toContain("bg-sky-500");
  });

  it("announces itself as a progressbar carrying the drawn value", () => {
    const { container } = render(<ProgressBar pct={140} label="Enrollment" />);
    const track = trackOf(container);
    expect(track).toHaveAttribute("role", "progressbar");
    expect(track).toHaveAttribute("aria-valuenow", "100");
    expect(track).toHaveAttribute("aria-valuemin", "0");
    expect(track).toHaveAttribute("aria-valuemax", "100");
    expect(track).toHaveAttribute("aria-label", "Enrollment");
  });

  it("keeps the track's layout classes so the five consoles are unchanged visually", () => {
    const track = trackOf(render(<ProgressBar pct={50} />).container);
    expect(track.className).toContain("h-1.5");
    expect(track.className).toContain("w-full");
    expect(track.className).toContain("overflow-hidden");
  });
});

describe("Meter", () => {
  it("sizes the fill to the value and keeps the caller's colour", () => {
    const { container } = render(<Meter value={72} color="bg-amber-400" />);
    expect(fillOf(container)).toHaveStyle({ width: "72%" });
    expect(fillOf(container).className).toContain("bg-amber-400");
  });

  it("accepts a numeric string, which is what a raw payload delivers", () => {
    expect(fillOf(render(<Meter value="72" />).container)).toHaveStyle({ width: "72%" });
  });

  it("draws an empty bar for a missing reading rather than a full one", () => {
    // EndocrinologyMetabolicHub: <Meter value={p.timeInRange} /> for a patient with no CGM data.
    const patient = {};
    const fill = fillOf(render(<Meter value={patient.timeInRange} />).container);
    expect(fill.getAttribute("style")).not.toBeNull();
    expect(fill).toHaveStyle({ width: "0%" });
  });

  it("draws an empty bar for a divide-by-zero utilisation", () => {
    // SurgicalRoboticsHub: <Meter value={(i.uses / i.limit) * 100} />
    const instrument = { uses: 12, limit: 0 };
    expect(fillOf(render(<Meter value={(instrument.uses / instrument.limit) * 100} />).container))
      .toHaveStyle({ width: "0%" });
  });

  it("switches between the fixed and full-width tracks", () => {
    expect(trackOf(render(<Meter value={50} />).container).className).toContain("w-24");
    expect(trackOf(render(<Meter value={50} full />).container).className).toContain("w-full");
  });

  it("defaults its fill to emerald, as every copy it replaces did", () => {
    expect(fillOf(render(<Meter value={50} />).container).className).toContain("bg-emerald-400");
  });

  it("announces itself as a progressbar", () => {
    const track = trackOf(render(<Meter value={-3} label="Trust score" />).container);
    expect(track).toHaveAttribute("role", "progressbar");
    expect(track).toHaveAttribute("aria-valuenow", "0");
    expect(track).toHaveAttribute("aria-label", "Trust score");
  });
});

describe("common/Meter re-export", () => {
  it("resolves to the same component as common/MeterBar", () => {
    // The orphaned second copy is gone; both import paths now reach one implementation, so a page
    // written against either one cannot pick the unclamped version back up.
    expect(MeterFromLegacyPath).toBe(Meter);
  });

  it("clamps through the legacy path too", () => {
    const fill = fillOf(render(<MeterFromLegacyPath value={NaN} />).container);
    expect(fill).toHaveStyle({ width: "0%" });
  });
});
