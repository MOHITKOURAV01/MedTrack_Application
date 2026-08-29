import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("lucide-react", () => ({
  Search: (props) => <svg data-testid="search-icon" {...props} />,
}));

import { SearchBox, CompactSearch, resolveSearchLabel } from "../../../components/common/SearchBox";

describe("resolveSearchLabel", () => {
  it("prefers an explicit label", () => {
    expect(resolveSearchLabel("Search devices", "Search devices, rooms…")).toBe("Search devices");
  });

  it("falls back to the placeholder", () => {
    expect(resolveSearchLabel(undefined, "Search analyzers, samples, QC runs…")).toBe(
      "Search analyzers, samples, QC runs…"
    );
  });

  it("ignores a whitespace-only label", () => {
    expect(resolveSearchLabel("   ", "Search cases")).toBe("Search cases");
  });

  it("trims the name it returns", () => {
    expect(resolveSearchLabel("  Search cases  ", undefined)).toBe("Search cases");
  });

  it("never returns an empty name", () => {
    // A nameless field is the defect. Something generic beats nothing.
    expect(resolveSearchLabel(undefined, undefined)).toBe("Search");
    expect(resolveSearchLabel("", "")).toBe("Search");
    expect(resolveSearchLabel(null, null)).toBe("Search");
  });

  it("ignores non-string labels", () => {
    expect(resolveSearchLabel(42, "Search studies")).toBe("Search studies");
  });
});

describe.each([
  ["SearchBox", SearchBox],
  ["CompactSearch", CompactSearch],
])("%s naming", (name, Component) => {
  it("is findable by its placeholder text as an accessible name", () => {
    render(<Component value="" onChange={() => {}} placeholder="Search studies, modalities, AI jobs…" />);
    expect(screen.getByLabelText("Search studies, modalities, AI jobs…")).toBeInTheDocument();
  });

  it("prefers an explicit label over the placeholder", () => {
    render(
      <Component
        value=""
        onChange={() => {}}
        placeholder="Search studies, modalities, AI jobs…"
        label="Search radiology studies"
      />
    );
    expect(screen.getByLabelText("Search radiology studies")).toBeInTheDocument();
  });

  it("keeps the name once the field has content", () => {
    // The placeholder disappears on the first keystroke; the name must not.
    render(<Component value="vent" onChange={() => {}} placeholder="Search devices…" label="Search devices" />);
    const input = screen.getByLabelText("Search devices");
    expect(input).toHaveValue("vent");
  });

  it("is still named when no placeholder is given", () => {
    render(<Component value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });
});

describe.each([
  ["SearchBox", SearchBox],
  ["CompactSearch", CompactSearch],
])("%s role and type", (name, Component) => {
  it("exposes the field as a searchbox, not a plain textbox", () => {
    render(<Component value="" onChange={() => {}} placeholder="Search…" />);
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("uses type=search", () => {
    render(<Component value="" onChange={() => {}} placeholder="Search…" />);
    expect(screen.getByRole("searchbox")).toHaveAttribute("type", "search");
  });
});

describe.each([
  ["SearchBox", SearchBox],
  ["CompactSearch", CompactSearch],
])("%s icon", (name, Component) => {
  it("keeps the decorative icon out of the accessibility tree", () => {
    render(<Component value="" onChange={() => {}} placeholder="Search…" />);
    expect(screen.getByTestId("search-icon")).toHaveAttribute("aria-hidden", "true");
  });

  it("makes the icon inert so it cannot swallow the click", () => {
    // CompactSearch's icon was missing pointer-events-none while SearchBox's
    // had it, so clicking the magnifier on nine consoles did nothing.
    render(<Component value="" onChange={() => {}} placeholder="Search…" />);
    expect(screen.getByTestId("search-icon").getAttribute("class")).toContain("pointer-events-none");
  });
});

describe.each([
  ["SearchBox", SearchBox],
  ["CompactSearch", CompactSearch],
])("%s behaviour", (name, Component) => {
  it("reports the typed value", () => {
    const onChange = vi.fn();
    render(<Component value="" onChange={onChange} placeholder="Search…" />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "MRI" } });
    expect(onChange).toHaveBeenCalledWith("MRI");
  });

  it("reports an emptied field", () => {
    const onChange = vi.fn();
    render(<Component value="MRI" onChange={onChange} placeholder="Search…" />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("renders the value it is given", () => {
    render(<Component value="ICU West" onChange={() => {}} placeholder="Search…" />);
    expect(screen.getByRole("searchbox")).toHaveValue("ICU West");
  });

  it("still shows the placeholder", () => {
    render(<Component value="" onChange={() => {}} placeholder="Search analyzers…" />);
    expect(screen.getByRole("searchbox")).toHaveAttribute("placeholder", "Search analyzers…");
  });
});

describe("SearchBox styling", () => {
  it("uses the sky focus ring by default", () => {
    render(<SearchBox value="" onChange={() => {}} placeholder="Search…" />);
    expect(screen.getByRole("searchbox").className).toContain("focus:ring-sky-500/20");
  });

  it("uses the cyan focus ring for the cold-chain console", () => {
    render(<SearchBox value="" onChange={() => {}} placeholder="Search…" accent="cyan" />);
    expect(screen.getByRole("searchbox").className).toContain("focus:ring-cyan-500/20");
  });

  it("keeps the variant-A width", () => {
    const { container } = render(<SearchBox value="" onChange={() => {}} placeholder="Search…" />);
    expect(container.firstChild.className).toContain("w-full sm:w-72");
  });
});

describe("CompactSearch styling", () => {
  it("keeps the variant-B fixed width and emerald focus border", () => {
    render(<CompactSearch value="" onChange={() => {}} placeholder="Search…" />);
    const input = screen.getByRole("searchbox");
    expect(input.className).toContain("w-64");
    expect(input.className).toContain("focus:border-emerald-500/50");
  });
});
