import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import QrScannerModal, {
  parseAssetTag,
  getScanHistory,
  addScanHistory,
} from "../../../components/common/QrScannerModal";

/**
 * jsdom has no BarcodeDetector, which is the same position every non-Chromium
 * browser is in: the modal falls back to manual entry and the scan history.
 * That is the path these tests exercise, and it is the path most users get.
 */
beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("parseAssetTag", () => {
  it("returns null for empty input", () => {
    expect(parseAssetTag("")).toBeNull();
    expect(parseAssetTag(null)).toBeNull();
    expect(parseAssetTag(undefined)).toBeNull();
  });

  it("reads a MedTrack multi-line asset tag", () => {
    const parsed = parseAssetTag("MedTrack Asset:\nID: 42\nCode: EQ-042\nName: MRI Scanner\nSN: SN-1\nDept: Radiology");
    expect(parsed).toMatchObject({ id: "42", code: "EQ-042", name: "MRI Scanner" });
  });

  it("falls back to the code when no ID line is present", () => {
    const parsed = parseAssetTag("Code: EQ-007\nName: Ventilator");
    expect(parsed).toMatchObject({ id: "EQ-007", code: "EQ-007", name: "Ventilator" });
  });

  it("accepts a bare equipment code", () => {
    expect(parseAssetTag("EQ-001")).toMatchObject({ id: "EQ-001", code: "EQ-001" });
  });

  it("accepts a bare numeric id", () => {
    expect(parseAssetTag("12")).toMatchObject({ id: "12", code: "12" });
  });

  it("passes through an unrecognised third-party label", () => {
    expect(parseAssetTag("SOMEVENDOR//9931")).toMatchObject({ id: "SOMEVENDOR//9931", code: null });
  });
});

describe("scan history", () => {
  it("starts empty", () => {
    expect(getScanHistory()).toEqual([]);
  });

  it("records the most recent scan first", () => {
    addScanHistory({ id: "EQ-001", name: "MRI" });
    addScanHistory({ id: "EQ-002", name: "CT" });
    expect(getScanHistory().map((e) => e.id)).toEqual(["EQ-002", "EQ-001"]);
  });

  it("de-duplicates by id", () => {
    addScanHistory({ id: "EQ-001", name: "MRI" });
    addScanHistory({ id: "EQ-001", name: "MRI" });
    expect(getScanHistory()).toHaveLength(1);
  });

  it("survives a corrupt stored value", () => {
    window.localStorage.setItem("medtrack-scan-history", "{not json");
    expect(getScanHistory()).toEqual([]);
  });
});

describe("QrScannerModal visibility", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<QrScannerModal open={false} onClose={() => {}} onScan={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    render(<QrScannerModal open onClose={() => {}} onScan={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("QrScannerModal dialog semantics", () => {
  it("is a modal dialog", () => {
    render(<QrScannerModal open onClose={() => {}} onScan={() => {}} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("is named by its own heading", () => {
    render(<QrScannerModal open onClose={() => {}} onScan={() => {}} title="Scan Equipment Tag" />);
    expect(screen.getByRole("dialog", { name: "Scan Equipment Tag" })).toBeInTheDocument();
  });

  it("uses the default title when none is given", () => {
    render(<QrScannerModal open onClose={() => {}} onScan={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Scan Asset Tag" })).toBeInTheDocument();
  });

  it("names the manual entry field", () => {
    // On every non-Chromium browser this input IS the scanner, and it had a
    // placeholder where its label should have been.
    render(<QrScannerModal open onClose={() => {}} onScan={() => {}} />);
    expect(screen.getByLabelText("Asset ID")).toBeInTheDocument();
  });
});

describe("QrScannerModal dismissal", () => {
  it("closes on Escape", () => {
    // Escape did nothing, so the only way out of a live camera was a mouse.
    const onClose = vi.fn();
    render(<QrScannerModal open onClose={onClose} onScan={() => {}} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on Escape once it is shut", () => {
    const onClose = vi.fn();
    const { rerender } = render(<QrScannerModal open onClose={onClose} onScan={() => {}} />);
    rerender(<QrScannerModal open={false} onClose={onClose} onScan={() => {}} />);
    onClose.mockClear();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on a backdrop click", () => {
    const onClose = vi.fn();
    render(<QrScannerModal open onClose={onClose} onScan={() => {}} />);
    fireEvent.mouseDown(screen.getByTestId("qr-scanner-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on a click inside the panel", () => {
    const onClose = vi.fn();
    render(<QrScannerModal open onClose={onClose} onScan={() => {}} />);
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close when a drag started inside is released on the backdrop", () => {
    // A plain onClick on the backdrop also fires for a text selection that
    // begins in the panel and ends outside it.
    const onClose = vi.fn();
    render(<QrScannerModal open onClose={onClose} onScan={() => {}} />);
    fireEvent.mouseDown(screen.getByRole("dialog"));
    fireEvent.click(screen.getByTestId("qr-scanner-backdrop"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes from the close button", () => {
    const onClose = vi.fn();
    render(<QrScannerModal open onClose={onClose} onScan={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Close scanner" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the Cancel button", () => {
    const onClose = vi.fn();
    render(<QrScannerModal open onClose={onClose} onScan={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("QrScannerModal focus management", () => {
  it("moves focus into the dialog on open", () => {
    render(<QrScannerModal open onClose={() => {}} onScan={() => {}} />);
    expect(screen.getByRole("button", { name: "Close scanner" })).toHaveFocus();
  });

  it("returns focus to the trigger on close", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(<QrScannerModal open onClose={() => {}} onScan={() => {}} />);
    expect(trigger).not.toHaveFocus();

    rerender(<QrScannerModal open={false} onClose={() => {}} onScan={() => {}} />);
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it("wraps Tab from the last focusable back to the first", () => {
    render(<QrScannerModal open onClose={() => {}} onScan={() => {}} />);
    const dialog = screen.getByRole("dialog");
    const focusables = dialog.querySelectorAll("button, input");
    const last = focusables[focusables.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(focusables[0]).toHaveFocus();
  });

  it("wraps Shift+Tab from the first focusable back to the last", () => {
    render(<QrScannerModal open onClose={() => {}} onScan={() => {}} />);
    const dialog = screen.getByRole("dialog");
    const focusables = dialog.querySelectorAll("button, input");
    focusables[0].focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(focusables[focusables.length - 1]).toHaveFocus();
  });
});

describe("QrScannerModal manual entry", () => {
  it("reports a parsed result", () => {
    const onScan = vi.fn();
    render(<QrScannerModal open onClose={() => {}} onScan={onScan} />);
    fireEvent.change(screen.getByLabelText("Asset ID"), { target: { value: "EQ-001" } });
    fireEvent.click(screen.getByRole("button", { name: "Look Up" }));
    expect(onScan).toHaveBeenCalledWith(expect.objectContaining({ id: "EQ-001" }));
  });

  it("rejects an empty submission with a message", () => {
    const onScan = vi.fn();
    render(<QrScannerModal open onClose={() => {}} onScan={onScan} />);
    fireEvent.click(screen.getByRole("button", { name: "Look Up" }));
    expect(onScan).not.toHaveBeenCalled();
    expect(screen.getByText(/Enter an asset ID/)).toBeInTheDocument();
  });

  it("trims whitespace around the id", () => {
    const onScan = vi.fn();
    render(<QrScannerModal open onClose={() => {}} onScan={onScan} />);
    fireEvent.change(screen.getByLabelText("Asset ID"), { target: { value: "  EQ-002  " } });
    fireEvent.click(screen.getByRole("button", { name: "Look Up" }));
    expect(onScan).toHaveBeenCalledWith(expect.objectContaining({ id: "EQ-002" }));
  });

  it("dispatches a result only once", () => {
    // A detect() promise already in flight could otherwise resolve after a
    // manual submit and dispatch a second, different result for one scan.
    const onScan = vi.fn();
    render(<QrScannerModal open onClose={() => {}} onScan={onScan} />);
    fireEvent.change(screen.getByLabelText("Asset ID"), { target: { value: "EQ-003" } });
    fireEvent.click(screen.getByRole("button", { name: "Look Up" }));
    fireEvent.click(screen.getByRole("button", { name: "Look Up" }));
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it("records the manual lookup in history", () => {
    render(<QrScannerModal open onClose={() => {}} onScan={() => {}} />);
    fireEvent.change(screen.getByLabelText("Asset ID"), { target: { value: "EQ-004" } });
    fireEvent.click(screen.getByRole("button", { name: "Look Up" }));
    expect(getScanHistory().map((e) => e.id)).toContain("EQ-004");
  });
});

describe("QrScannerModal scan history reuse", () => {
  it("offers the last scanned assets", () => {
    addScanHistory({ id: "EQ-100", name: "Ventilator" });
    render(<QrScannerModal open onClose={() => {}} onScan={() => {}} />);
    expect(screen.getByRole("button", { name: /Ventilator \(EQ-100\)/ })).toBeInTheDocument();
  });

  it("reports a reused entry", () => {
    addScanHistory({ id: "EQ-100", name: "Ventilator" });
    const onScan = vi.fn();
    render(<QrScannerModal open onClose={() => {}} onScan={onScan} />);
    fireEvent.click(screen.getByRole("button", { name: /Ventilator \(EQ-100\)/ }));
    expect(onScan).toHaveBeenCalledWith(expect.objectContaining({ id: "EQ-100" }));
  });

  it("dispatches a reused entry only once", () => {
    addScanHistory({ id: "EQ-100", name: "Ventilator" });
    const onScan = vi.fn();
    render(<QrScannerModal open onClose={() => {}} onScan={onScan} />);
    const chip = screen.getByRole("button", { name: /Ventilator \(EQ-100\)/ });
    fireEvent.click(chip);
    fireEvent.click(chip);
    expect(onScan).toHaveBeenCalledTimes(1);
  });
});

describe("QrScannerModal fallback messaging", () => {
  it("explains that live scanning is unavailable without BarcodeDetector", () => {
    render(<QrScannerModal open onClose={() => {}} onScan={() => {}} />);
    expect(screen.getByText(/not supported in this browser/i)).toBeInTheDocument();
  });
});

describe("QrScannerModal button types", () => {
  it("gives every button an explicit type", () => {
    render(<QrScannerModal open onClose={() => {}} onScan={() => {}} />);
    const dialog = screen.getByRole("dialog");
    dialog.querySelectorAll("button").forEach((btn) => {
      expect(btn.getAttribute("type")).toBeTruthy();
    });
  });
});

describe("QrScannerModal camera lifetime", () => {
  let getUserMedia;
  let stopTrack;

  beforeEach(() => {
    stopTrack = vi.fn();
    getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });

    // Stand in for the Chromium-only API so the camera path can be exercised.
    window.BarcodeDetector = class {
      constructor() {}
      detect() {
        return Promise.resolve([]);
      }
    };
    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      writable: true,
      value: { getUserMedia },
    });
    // jsdom's HTMLMediaElement has no play().
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete window.BarcodeDetector;
  });

  it("starts the camera once when opened", async () => {
    render(<QrScannerModal open onClose={() => {}} onScan={() => {}} />);
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
  });

  it("does not restart the camera when the parent re-renders with a new onScan", async () => {
    // The latent defect. Both call sites declare handleScanResult as a plain
    // function in the component body, so its identity changes on every parent
    // render. That identity used to flow through handleResult -> scanFrame ->
    // the camera effect's dependency array, so any parent state update while
    // the scanner was open stopped the stream and called getUserMedia again.
    const { rerender } = render(
      <QrScannerModal open onClose={() => {}} onScan={() => {}} />
    );
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));

    for (let i = 0; i < 5; i++) {
      rerender(
        <QrScannerModal
          open
          onClose={() => {}}
          onScan={(parsed) => parsed}
        />
      );
    }

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(stopTrack).not.toHaveBeenCalled();
  });

  it("releases the camera when the modal closes", async () => {
    const { rerender } = render(<QrScannerModal open onClose={() => {}} onScan={() => {}} />);
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    rerender(<QrScannerModal open={false} onClose={() => {}} onScan={() => {}} />);
    expect(stopTrack).toHaveBeenCalled();
  });

  it("releases the camera as soon as a result is dispatched", async () => {
    // handleResult used to leave the stream running and rely on the caller
    // closing the modal. A caller that kept it open to show a confirmation
    // would have been left recording and no longer reading.
    render(<QrScannerModal open onClose={() => {}} onScan={() => {}} />);
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Asset ID"), { target: { value: "EQ-500" } });
    fireEvent.click(screen.getByRole("button", { name: "Look Up" }));

    expect(stopTrack).toHaveBeenCalled();
  });
});
