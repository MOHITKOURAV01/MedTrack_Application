import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import useDialog, { focusableWithin, useBackdropDismiss } from "../../hooks/useDialog";

/** A minimal dialog wired the way the shared modals are, so the hook is exercised in place. */
function Harness({ open, onClose, children }) {
  const { panelRef } = useDialog({ open, onClose });
  const backdrop = useBackdropDismiss(onClose);
  if (!open) return null;
  return (
    <div data-testid="overlay" {...backdrop}>
      <div ref={panelRef} data-testid="panel" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

beforeEach(() => {
  document.body.style.overflow = "";
});

describe("focusableWithin", () => {
  it("finds the tab stops in document order", () => {
    const { container } = render(
      <div>
        <a href="/x">link</a>
        <button>one</button>
        <input />
        <textarea />
        <select><option>a</option></select>
      </div>
    );
    const found = focusableWithin(container).map((el) => el.tagName);
    expect(found).toEqual(["A", "BUTTON", "INPUT", "TEXTAREA", "SELECT"]);
  });

  it("skips elements that are not tab stops", () => {
    const { container } = render(
      <div>
        <button disabled>disabled</button>
        <button tabIndex={-1}>programmatic only</button>
        <button aria-hidden="true">hidden from AT</button>
        <button>real</button>
      </div>
    );
    expect(focusableWithin(container).map((el) => el.textContent)).toEqual(["real"]);
  });

  it("returns an empty list rather than throwing for a missing root", () => {
    expect(focusableWithin(null)).toEqual([]);
    expect(focusableWithin(undefined)).toEqual([]);
    expect(focusableWithin({})).toEqual([]);
  });
});

describe("useDialog", () => {
  it("moves focus to the first focusable element in the panel", () => {
    render(
      <Harness open onClose={() => {}}>
        <button>First</button>
        <button>Second</button>
      </Harness>
    );
    expect(document.activeElement).toBe(screen.getByText("First"));
  });

  it("focuses the panel itself when it holds nothing focusable", () => {
    render(<Harness open onClose={() => {}}><p>Read-only detail</p></Harness>);
    expect(document.activeElement).toBe(screen.getByTestId("panel"));
  });

  it("returns focus to the element that opened it", () => {
    function Page() {
      const [open, setOpen] = require("react").useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open row</button>
          <Harness open={open} onClose={() => setOpen(false)}>
            <button>Inside</button>
          </Harness>
        </>
      );
    }
    render(<Page />);
    const opener = screen.getByText("Open row");
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement).toBe(screen.getByText("Inside"));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("panel")).toBeNull();
    // Without this the next Tab starts from wherever focus fell to - the page behind the overlay.
    expect(document.activeElement).toBe(opener);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose}><button>Inside</button></Harness>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on any other key", () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose}><button>Inside</button></Harness>);
    for (const key of ["Enter", "a", " ", "ArrowDown", "Esc"]) {
      fireEvent.keyDown(document, { key });
    }
    expect(onClose).not.toHaveBeenCalled();
  });

  it("wraps Tab from the last focusable element back to the first", () => {
    render(
      <Harness open onClose={() => {}}>
        <button>First</button>
        <button>Last</button>
      </Harness>
    );
    const last = screen.getByText("Last");
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByText("First"));
  });

  it("wraps Shift+Tab from the first focusable element back to the last", () => {
    render(
      <Harness open onClose={() => {}}>
        <button>First</button>
        <button>Last</button>
      </Harness>
    );
    expect(document.activeElement).toBe(screen.getByText("First"));
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByText("Last"));
  });

  it("pulls focus back in when it has escaped the panel", () => {
    render(
      <>
        <button>Behind the overlay</button>
        <Harness open onClose={() => {}}>
          <button>First</button>
          <button>Last</button>
        </Harness>
      </>
    );
    screen.getByText("Behind the overlay").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByText("First"));
  });

  it("locks and restores the page's scroll", () => {
    document.body.style.overflow = "auto";
    const { unmount } = render(<Harness open onClose={() => {}}><button>x</button></Harness>);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("installs nothing while closed", () => {
    const onClose = vi.fn();
    render(<Harness open={false} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe("");
  });

  it("uses the latest onClose without reinstalling its listeners", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Harness open onClose={first}><button>x</button></Harness>);
    rerender(<Harness open onClose={second}><button>x</button></Harness>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("useBackdropDismiss", () => {
  it("closes on a click that begins and ends on the backdrop", () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose}><button>Inside</button></Harness>);
    const overlay = screen.getByTestId("overlay");
    fireEvent.mouseDown(overlay);
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores a release on the backdrop that began inside the panel", () => {
    // Selecting text in the panel and releasing a few pixels outside it fires a click on the
    // overlay - the nearest common ancestor of press and release. That used to discard the panel.
    const onClose = vi.fn();
    render(<Harness open onClose={onClose}><button>Inside</button></Harness>);
    const overlay = screen.getByTestId("overlay");
    fireEvent.mouseDown(screen.getByText("Inside"));
    fireEvent.click(overlay);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ignores a click that bubbled up from inside the panel", () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose}><button>Inside</button></Harness>);
    fireEvent.mouseDown(screen.getByText("Inside"));
    fireEvent.click(screen.getByText("Inside"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not leave the press flag set for the next gesture", () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose}><button>Inside</button></Harness>);
    const overlay = screen.getByTestId("overlay");
    fireEvent.mouseDown(overlay);
    fireEvent.click(overlay);
    // A second click with no press of its own must not close again.
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
