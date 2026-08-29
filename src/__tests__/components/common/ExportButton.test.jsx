import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

vi.mock("lucide-react", () => ({
  Download: (props) => <svg data-testid="download-icon" {...props} />,
}));

import {
  ExportButton,
  ExportCsvButton,
  EXPORT_BUSY_MS,
} from "../../../components/common/ExportButton";

const VARIANTS = [
  ["ExportButton", ExportButton],
  ["ExportCsvButton", ExportCsvButton],
];

const getButton = () => screen.getByRole("button", { name: /export csv|writing/i });

describe.each(VARIANTS)("%s double-click guard", (name, Component) => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("fires the handler once for a single click", () => {
    const onClick = vi.fn();
    render(<Component onClick={onClick} />);
    fireEvent.click(getButton());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("drops a second click while the export is in flight", () => {
    // The regression: exportCsv is synchronous and ends in downloadCsv with
    // Date.now() in the filename, so a second click wrote a second file.
    const onClick = vi.fn();
    render(<Component onClick={onClick} />);
    const btn = getButton();
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("drops two clicks landing in the same frame", () => {
    // Both reads of the `busy` state would see its pre-update value, so the
    // guard has to be a ref that is already written by the second click.
    const onClick = vi.fn();
    render(<Component onClick={onClick} />);
    const btn = getButton();
    act(() => {
      btn.click();
      btn.click();
    });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("accepts a genuine second export once the window has passed", () => {
    const onClick = vi.fn();
    render(<Component onClick={onClick} />);
    fireEvent.click(getButton());
    act(() => vi.advanceTimersByTime(EXPORT_BUSY_MS + 10));
    fireEvent.click(getButton());
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("disables the button while busy and re-enables it after", () => {
    render(<Component onClick={() => {}} />);
    fireEvent.click(getButton());
    expect(getButton()).toBeDisabled();
    act(() => vi.advanceTimersByTime(EXPORT_BUSY_MS + 10));
    expect(getButton()).toBeEnabled();
  });

  it("shows the writing label while busy", () => {
    render(<Component onClick={() => {}} />);
    fireEvent.click(getButton());
    expect(screen.getByRole("button", { name: /writing/i })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(EXPORT_BUSY_MS + 10));
    expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();
  });

  it("survives a missing onClick", () => {
    render(<Component />);
    expect(() => fireEvent.click(getButton())).not.toThrow();
  });
});

describe.each(VARIANTS)("%s busy announcement", (name, Component) => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("marks the control busy for assistive technology", () => {
    render(<Component onClick={() => {}} />);
    expect(getButton()).toHaveAttribute("aria-busy", "false");
    fireEvent.click(getButton());
    expect(getButton()).toHaveAttribute("aria-busy", "true");
  });

  it("announces the export through a polite live region", () => {
    // The label swap alone is a change a sighted user sees and a screen reader
    // user does not, on a control that has just become unfocusable.
    render(<Component onClick={() => {}} />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("");
    fireEvent.click(getButton());
    expect(screen.getByRole("status")).toHaveTextContent("Writing CSV export");
  });

  it("clears the announcement when the export finishes", () => {
    render(<Component onClick={() => {}} />);
    fireEvent.click(getButton());
    act(() => vi.advanceTimersByTime(EXPORT_BUSY_MS + 10));
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("hides the decorative icon", () => {
    render(<Component onClick={() => {}} />);
    expect(screen.getByTestId("download-icon")).toHaveAttribute("aria-hidden", "true");
  });

  it("is type=button so it cannot submit a surrounding form", () => {
    render(<Component onClick={() => {}} />);
    expect(getButton()).toHaveAttribute("type", "button");
  });
});

describe.each(VARIANTS)("%s page-supplied exporting flag", (name, Component) => {
  it("honours an exporting flag from the page", () => {
    render(<Component onClick={() => {}} exporting />);
    expect(getButton()).toBeDisabled();
    expect(getButton()).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: /writing/i })).toBeInTheDocument();
  });

  it("is idle when the page reports not exporting", () => {
    render(<Component onClick={() => {}} exporting={false} />);
    expect(getButton()).toBeEnabled();
    expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();
  });

  it("does not fire while the page reports busy", () => {
    // The six variant-A consoles already hold their own flag; it must still win.
    const onClick = vi.fn();
    render(<Component onClick={onClick} exporting />);
    fireEvent.click(getButton());
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("ExportButton accents", () => {
  it("uses the sky accent by default", () => {
    render(<ExportButton onClick={() => {}} />);
    expect(getButton().className).toContain("text-sky-400");
  });

  it("uses the cyan accent for the cold-chain console", () => {
    render(<ExportButton onClick={() => {}} accent="cyan" />);
    expect(getButton().className).toContain("text-cyan-400");
  });

  it("falls back to sky for an unrecognised accent", () => {
    // ACCENTS[accent] used to interpolate `undefined` into the class list,
    // leaving the button with no border, background or text colour at all.
    render(<ExportButton onClick={() => {}} accent="chartreuse" />);
    const cls = getButton().className;
    expect(cls).not.toContain("undefined");
    expect(cls).toContain("text-sky-400");
  });
});

describe("ExportCsvButton styling", () => {
  it("keeps the variant-B slate palette and emerald hover", () => {
    render(<ExportCsvButton onClick={() => {}} />);
    const cls = getButton().className;
    expect(cls).toContain("border-slate-700");
    expect(cls).toContain("hover:text-emerald-300");
  });
});
