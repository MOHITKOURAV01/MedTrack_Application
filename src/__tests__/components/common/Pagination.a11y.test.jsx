import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import Pagination, { visiblePageRange } from "../../../components/common/Pagination";

/**
 * Theme and announced state (#26).
 *
 * Pagination is the only shared component that hard-coded light-theme greys, and it is the sole
 * navigation control on five list consoles - Equipment, Maintenance, Retired Assets, Orders and
 * Tasks - so in dark mode those consoles had no legible way to reach page two.
 *
 * A note on what is asserted here. Class-name assertions are a weak test: they check the stylesheet
 * rather than the contract, which is how the original suite passed while the control was invisible.
 * The behavioural properties below (`aria-current`, the accessible names, the landmark, the
 * announced total) are asserted directly. Contrast cannot be computed in jsdom - Tailwind classes
 * are never resolved to colours - so the dark-variant coverage is deliberately narrow: it asserts
 * that every colour utility the component paints has a dark counterpart, which is the part that can
 * actually regress silently. It is not a substitute for looking at the page.
 */

const setup = (props = {}) =>
  render(
    <Pagination page={0} totalPages={9} onPageChange={() => {}} {...props} />
  );

describe("landmark and announced position", () => {
  it("exposes a named navigation landmark", () => {
    setup();
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
  });

  it("announces the position and the total", () => {
    // With a 5-button window the total is not derivable from what is rendered: on page 1 of 9 the
    // buttons read 1..5 and nothing on screen says there are nine.
    setup({ page: 0, totalPages: 9 });
    expect(screen.getByText("Page 1 of 9")).toBeInTheDocument();
  });

  it("keeps the announced position in step with the current page", () => {
    setup({ page: 5, totalPages: 9 });
    expect(screen.getByText("Page 6 of 9")).toBeInTheDocument();
  });
});

describe("the active page is announced, not only painted", () => {
  it("marks exactly one button with aria-current", () => {
    setup({ page: 3, totalPages: 9 });
    const current = screen
      .getAllByRole("button")
      .filter((node) => node.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName("Page 4");
  });

  it("names page buttons rather than leaving them as bare digits", () => {
    setup({ page: 0, totalPages: 3 });
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 3" })).toBeInTheDocument();
  });

  it("hides the chevron glyphs from assistive technology", () => {
    // The buttons carry their own labels; the icons would otherwise be read as extra content.
    setup();
    const prev = screen.getByRole("button", { name: "Previous page" });
    expect(within(prev).queryByRole("img")).toBeNull();
    expect(prev.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("dark-mode coverage", () => {
  /**
   * The colour utilities on one button, split into the light set and the dark set and keyed by what
   * they paint rather than by shade.
   *
   * "text-slate-600" pairs with "dark:text-slate-300", not "dark:text-slate-600" - the whole point
   * of a dark variant is a different shade - so the pairing is checked per property (`text`,
   * `bg`, `hover:bg`), which is the level at which a missing variant actually shows up.
   */
  const paintedProperties = (node) => {
    const light = new Set();
    const dark = new Set();
    for (const cls of node.classList) {
      const match = /^(dark:)?((?:hover:)?(?:bg|text))-(?:slate|gray|blue)-\d{2,3}$/.exec(cls);
      if (!match) continue;
      (match[1] ? dark : light).add(match[2]);
    }
    return { light, dark };
  };

  it("pairs every painted property with a dark counterpart, on every button", () => {
    const { container } = setup({ page: 2, totalPages: 9 });
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.length).toBeGreaterThan(1);

    for (const node of buttons) {
      const { light, dark } = paintedProperties(node);
      const name = node.getAttribute("aria-label");
      expect(light.size, `${name} paints no colour at all`).toBeGreaterThan(0);
      for (const property of light) {
        expect(dark.has(property), `${name} has no dark variant for "${property}"`).toBe(true);
      }
    }
  });

  it("paints no bare gray-* utility", () => {
    // The originals were text-gray-700 / hover:bg-gray-100 with no dark pair. The rest of the
    // shared components use the slate scale; drifting back to gray here is how it regresses.
    const { container } = setup({ page: 2, totalPages: 9 });
    const classes = Array.from(container.querySelectorAll("button")).flatMap((node) =>
      Array.from(node.classList)
    );
    expect(classes.filter((cls) => /(?:^|:)(?:bg|text)-gray-/.test(cls))).toEqual([]);
  });

  it("gives disabled arrows a visible disabled treatment", () => {
    setup({ page: 0, totalPages: 9 });
    const prev = screen.getByRole("button", { name: "Previous page" });
    expect(prev).toBeDisabled();
    expect(prev.className).toContain("disabled:opacity-40");
    // Without this a disabled arrow still lit up on hover, which reads as clickable.
    expect(prev.className).toContain("disabled:hover:bg-transparent");
  });

  it("gives every control a visible focus ring", () => {
    const { container } = setup({ page: 2, totalPages: 9 });
    for (const node of container.querySelectorAll("button")) {
      expect(node.className, node.getAttribute("aria-label")).toContain("focus-visible:ring-2");
    }
  });
});

describe("the sliding window", () => {
  it("shows the first five pages at the start", () => {
    expect(visiblePageRange(0, 9)).toEqual([0, 1, 2, 3, 4]);
  });

  it("centres on the current page in the middle", () => {
    expect(visiblePageRange(5, 9)).toEqual([3, 4, 5, 6, 7]);
  });

  it("clamps to the last five pages at the end", () => {
    expect(visiblePageRange(8, 9)).toEqual([4, 5, 6, 7, 8]);
  });

  it("does not pad past the real range when there are fewer pages than the window", () => {
    expect(visiblePageRange(1, 3)).toEqual([0, 1, 2]);
  });

  it("always contains the current page", () => {
    for (let total = 2; total <= 12; total += 1) {
      for (let page = 0; page < total; page += 1) {
        expect(visiblePageRange(page, total), `page ${page} of ${total}`).toContain(page);
      }
    }
  });
});

describe("navigation still works", () => {
  it("moves to the clicked page as a 0-based index", () => {
    const onPageChange = vi.fn();
    setup({ page: 0, totalPages: 9, onPageChange });
    fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("steps with the arrows", () => {
    const onPageChange = vi.fn();
    setup({ page: 4, totalPages: 9, onPageChange });
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenLastCalledWith(5);
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
  });

  it("declares type=button so a pager inside a form cannot submit it", () => {
    const { container } = setup();
    for (const node of container.querySelectorAll("button")) {
      expect(node).toHaveAttribute("type", "button");
    }
  });
});
