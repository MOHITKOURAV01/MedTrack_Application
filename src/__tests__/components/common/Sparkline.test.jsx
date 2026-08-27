import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Sparkline,
  MiniSparkline,
  finitePoints,
  plotRange,
  plot,
} from "../../../components/common/Sparkline";

/** Every "x,y" pair in a polyline/polygon `points` attribute. */
const parsePoints = (attr) =>
  attr
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",");
      return { x: Number(x), y: Number(y) };
    });

/** Every "x,y" pair in a path `d` attribute of the form "M..L..L..". */
const parsePath = (d) =>
  d
    .trim()
    .split(/\s+/)
    .map((segment) => {
      const [x, y] = segment.slice(1).split(",");
      return { x: Number(x), y: Number(y) };
    });

const polyline = () => document.querySelector("polyline");
const polygon = () => document.querySelector("polygon");
const path = () => document.querySelector("path");

describe("finitePoints", () => {
  it("keeps finite numbers in order", () => {
    expect(finitePoints([3, 1, 2])).toEqual([3, 1, 2]);
  });

  it("drops NaN, Infinity, null, undefined and strings", () => {
    expect(finitePoints([1, NaN, 2, Infinity, 3, -Infinity, null, undefined, "4", 5]))
      .toEqual([1, 2, 3, 5]);
  });

  it("returns an empty list for a non-array", () => {
    expect(finitePoints(undefined)).toEqual([]);
    expect(finitePoints(null)).toEqual([]);
    expect(finitePoints("nope")).toEqual([]);
  });
});

describe("plotRange", () => {
  it("takes the range from the data when no bounds are given", () => {
    expect(plotRange([4, 1, 9])).toEqual({ lo: 1, hi: 9, range: 8 });
  });

  it("honours explicit bounds", () => {
    expect(plotRange([4, 1, 9], 0, 100)).toEqual({ lo: 0, hi: 100, range: 100 });
  });

  it("honours a single explicit bound and takes the other from the data", () => {
    expect(plotRange([4, 1, 9], 0, null)).toEqual({ lo: 0, hi: 9, range: 9 });
    expect(plotRange([4, 1, 9], null, 20)).toEqual({ lo: 1, hi: 20, range: 19 });
  });

  it("normalises inverted bounds rather than rendering upside down", () => {
    expect(plotRange([5], 100, 0)).toEqual({ lo: 0, hi: 100, range: 100 });
  });

  it("widens a zero-height range instead of dividing by zero", () => {
    const { range } = plotRange([7, 7, 7]);
    expect(range).toBe(1);
    expect(Number.isFinite(range)).toBe(true);
  });

  it("handles a series long enough to break a spread call", () => {
    // Math.min(...values) throws RangeError past the engine's argument limit. A shared primitive
    // should not carry that ceiling.
    const long = Array.from({ length: 200000 }, (_, i) => i % 500);
    expect(() => plotRange(long)).not.toThrow();
    expect(plotRange(long)).toEqual({ lo: 0, hi: 499, range: 499 });
  });
});

describe("plot", () => {
  const box = { width: 100, height: 40, pad: 3, lo: 0, hi: 100, range: 100 };

  it("spreads x evenly across the width", () => {
    const coords = plot([0, 50, 100], box);
    expect(coords.map((c) => c.x)).toEqual([0, 50, 100]);
  });

  it("puts the lower bound on the floor and the upper bound on the ceiling", () => {
    const coords = plot([0, 100], box);
    expect(coords[0].y).toBe(37); // height - pad
    expect(coords[1].y).toBe(3); // pad
  });

  // The regression this file exists for.
  it("clamps a reading above the upper bound to the ceiling", () => {
    const coords = plot([0, 400], box);
    expect(coords[1].y).toBe(3);
    expect(coords[1].y).toBeGreaterThanOrEqual(0);
  });

  it("clamps a reading below the lower bound to the floor", () => {
    const coords = plot([-250, 50], box);
    expect(coords[0].y).toBe(37);
    expect(coords[0].y).toBeLessThanOrEqual(box.height);
  });

  it("keeps every y inside the box for wildly out-of-range data", () => {
    const coords = plot([-1e6, 0, 50, 100, 1e6], box);
    coords.forEach(({ y }) => {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(box.height);
    });
  });
});

describe("MiniSparkline", () => {
  it("renders a polyline for a plottable series", () => {
    render(<MiniSparkline points={[1, 2, 3]} />);
    expect(polyline()).toBeTruthy();
  });

  it("renders a placeholder of the configured height for a short series", () => {
    const { container } = render(<MiniSparkline points={[1]} height={44} />);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.firstChild.style.height).toBe("44px");
  });

  it("renders a placeholder for a missing or empty series", () => {
    const { container } = render(<MiniSparkline points={undefined} height={20} />);
    expect(container.firstChild.style.height).toBe("20px");
  });

  // The reproduction from the issue.
  it("keeps an out-of-range reading inside its own box", () => {
    render(<MiniSparkline points={[10, 20, 30, 400]} min={0} max={100} width={200} height={40} />);
    const coords = parsePoints(polyline().getAttribute("points"));

    coords.forEach(({ y }) => {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(40);
    });
    // Pinned to the ceiling rather than plotted a hundred pixels above it.
    expect(coords[3].y).toBe(3);
  });

  it("keeps a reading below the lower bound inside the box", () => {
    render(<MiniSparkline points={[50, -400]} min={0} max={100} width={200} height={40} />);
    const coords = parsePoints(polyline().getAttribute("points"));
    expect(coords[1].y).toBe(37);
  });

  it("emits no non-finite coordinate when the series contains one", () => {
    render(<MiniSparkline points={[10, NaN, 30]} width={100} height={40} />);
    const attr = polyline().getAttribute("points");

    expect(attr).not.toContain("NaN");
    expect(attr).not.toContain("Infinity");
    // The bad reading is dropped, not substituted - a gap should not look like a flat value.
    expect(parsePoints(attr)).toHaveLength(2);
  });

  it("still draws when every reading is identical", () => {
    render(<MiniSparkline points={[7, 7, 7]} width={100} height={40} />);
    const coords = parsePoints(polyline().getAttribute("points"));
    coords.forEach(({ y }) => expect(Number.isFinite(y)).toBe(true));
  });

  it("renders the area fill by default and omits it when asked", () => {
    const { unmount } = render(<MiniSparkline points={[1, 2, 3]} />);
    expect(polygon()).toBeTruthy();
    unmount();

    render(<MiniSparkline points={[1, 2, 3]} filled={false} />);
    expect(polygon()).toBeNull();
  });

  it("uses the tone's stroke, and falls back for an unknown tone", () => {
    const { unmount } = render(<MiniSparkline points={[1, 2, 3]} tone="rose" />);
    expect(polyline().getAttribute("stroke")).toBe("#fb7185");
    unmount();

    render(<MiniSparkline points={[1, 2, 3]} tone="chartreuse" />);
    expect(polyline().getAttribute("stroke")).toBe("#38bdf8");
  });

  it("carries the configured accessible name", () => {
    render(<MiniSparkline points={[1, 2, 3]} ariaLabel="freezer temperature trend" />);
    expect(screen.getByRole("img", { name: "freezer temperature trend" })).toBeTruthy();
  });

  it("places the end cap on the last plotted point", () => {
    render(<MiniSparkline points={[0, 100]} min={0} max={100} width={200} height={40} />);
    const coords = parsePoints(polyline().getAttribute("points"));
    expect(Number(document.querySelector("circle").getAttribute("cy"))).toBe(coords[1].y);
  });
});

describe("Sparkline", () => {
  it("renders a path for a plottable series", () => {
    render(<Sparkline points={[1, 2, 3]} />);
    expect(path()).toBeTruthy();
  });

  // The placeholder was a hardcoded h-6, so a Sparkline at h={44} collapsed to 24px whenever its
  // series was short and the card jumped 20px when the data arrived.
  it("renders a placeholder of the configured height for a short series", () => {
    const { container } = render(<Sparkline points={[1]} h={44} />);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.firstChild.style.height).toBe("44px");
  });

  it("emits no non-finite coordinate when the series contains one", () => {
    render(<Sparkline points={[10, Infinity, 30]} />);
    const d = path().getAttribute("d");
    expect(d).not.toContain("NaN");
    expect(d).not.toContain("Infinity");
  });

  it("keeps every point inside the box", () => {
    render(<Sparkline points={[5, 50, 500]} w={88} h={24} />);
    parsePath(path().getAttribute("d")).forEach(({ y }) => {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(24);
    });
  });

  it("has an accessible name", () => {
    render(<Sparkline points={[1, 2, 3]} ariaLabel="uptime trend" />);
    expect(screen.getByRole("img", { name: "uptime trend" })).toBeTruthy();
  });

  it("places the end cap on the last plotted point", () => {
    render(<Sparkline points={[1, 5]} w={88} h={24} />);
    const coords = parsePath(path().getAttribute("d"));
    expect(Number(document.querySelector("circle").getAttribute("cy"))).toBe(coords[1].y);
  });
});
