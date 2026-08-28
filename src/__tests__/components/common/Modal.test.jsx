import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Thermometer } from "lucide-react";
import { DetailModal, InspectionModal, SimpleModal } from "../../../components/common/Modal";

beforeEach(() => {
  document.body.style.overflow = "";
});

/**
 * The three modals are asserted against the same checklist, because the whole point of the shared
 * module is that a page should not have to know which of the three it got.
 */
const variants = [
  {
    name: "InspectionModal",
    render: (props) => <InspectionModal open title="Storage unit" icon={Thermometer} {...props} />,
    closeLabel: "Close inspection panel",
  },
  {
    name: "SimpleModal",
    render: (props) => <SimpleModal title="Confirm disposal" {...props} />,
    closeLabel: "Close",
  },
  {
    name: "DetailModal",
    render: (props) => <DetailModal title="Transfusion detail" {...props} />,
    closeLabel: "Close",
  },
];

describe.each(variants)("$name", ({ render: renderVariant, closeLabel }) => {
  const mount = (props) => render(renderVariant(props));

  it("is exposed as a modal dialog", () => {
    mount({ onClose: () => {}, children: <p>Body</p> });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("closes on Escape", () => {
    // Only InspectionModal did this before; the other two left Escape doing nothing at all.
    const onClose = vi.fn();
    mount({ onClose, children: <p>Body</p> });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus inside the panel on open", () => {
    mount({ onClose: () => {}, children: <button>Confirm</button> });
    // The close button is the first tab stop in the panel - it sits in the header, above the
    // children - so that is where focus lands. What matters is that it landed inside the dialog:
    // before this, focus stayed on whatever the user had clicked on the page behind the overlay.
    expect(document.activeElement).toBe(screen.getByLabelText(closeLabel));
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });

  it("traps Tab inside the panel", () => {
    mount({ onClose: () => {}, children: <button>Confirm</button> });
    const close = screen.getByLabelText(closeLabel);
    close.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    // Whatever it wrapped to, it stayed inside the dialog rather than walking the page behind.
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });

  it("restores focus to the opener when it unmounts", () => {
    render(<button>Row 4</button>);
    const opener = screen.getByText("Row 4");
    opener.focus();
    const { unmount } = mount({ onClose: () => {}, children: <button>Confirm</button> });
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
    unmount();
    expect(document.activeElement).toBe(opener);
  });

  it("stops the page behind it from scrolling, and lets it scroll again on close", () => {
    document.body.style.overflow = "auto";
    const { unmount } = mount({ onClose: () => {}, children: <p>Body</p> });
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("closes from its close button", () => {
    const onClose = vi.fn();
    mount({ onClose, children: <p>Body</p> });
    fireEvent.click(screen.getByLabelText(closeLabel));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("gives its close button an explicit type so it cannot submit a surrounding form", () => {
    mount({ onClose: () => {}, children: <p>Body</p> });
    expect(screen.getByLabelText(closeLabel)).toHaveAttribute("type", "button");
  });

  it("does not close when a click inside the panel bubbles out", () => {
    const onClose = vi.fn();
    mount({ onClose, children: <button>Confirm</button> });
    const confirm = screen.getByText("Confirm");
    fireEvent.mouseDown(confirm);
    fireEvent.click(confirm);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders its title, subtitle and children", () => {
    mount({ onClose: () => {}, subtitle: "Bay 3", children: <p>Body copy</p> });
    expect(screen.getByText("Bay 3")).toBeInTheDocument();
    expect(screen.getByText("Body copy")).toBeInTheDocument();
  });
});

describe("InspectionModal", () => {
  it("renders nothing while closed, and installs no scroll lock", () => {
    const { container } = render(
      <InspectionModal open={false} onClose={() => {}} title="x" icon={Thermometer}>
        <p>Body</p>
      </InspectionModal>
    );
    expect(container).toBeEmptyDOMElement();
    expect(document.body.style.overflow).toBe("");
  });

  it("renders without an icon rather than throwing", () => {
    // `<Icon size={18} />` with no `icon` prop took the whole page down.
    expect(() =>
      render(<InspectionModal open onClose={() => {}} title="No icon"><p>Body</p></InspectionModal>)
    ).not.toThrow();
    expect(screen.getByText("No icon")).toBeInTheDocument();
  });

  it("keeps the wide layout opt-in", () => {
    const { container: narrow } = render(
      <InspectionModal open onClose={() => {}} title="x" icon={Thermometer}><p>b</p></InspectionModal>
    );
    expect(narrow.querySelector(".max-w-xl")).not.toBeNull();

    const { container: wide } = render(
      <InspectionModal open onClose={() => {}} title="x" icon={Thermometer} wide><p>b</p></InspectionModal>
    );
    expect(wide.querySelector(".max-w-3xl")).not.toBeNull();
  });

  it("keeps the configurable icon accent", () => {
    const { container } = render(
      <InspectionModal open onClose={() => {}} title="x" icon={Thermometer} accent="text-cyan-400"><p>b</p></InspectionModal>
    );
    expect(container.querySelector(".text-cyan-400")).not.toBeNull();
  });

  it("closes on a click that begins on the backdrop", () => {
    const onClose = vi.fn();
    const { container } = render(
      <InspectionModal open onClose={onClose} title="x" icon={Thermometer}><p>b</p></InspectionModal>
    );
    const backdrop = container.querySelector(".absolute.inset-0");
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when a text selection is released on the backdrop", () => {
    const onClose = vi.fn();
    const { container } = render(
      <InspectionModal open onClose={onClose} title="x" icon={Thermometer}>
        <p>Technician note in progress</p>
      </InspectionModal>
    );
    fireEvent.mouseDown(screen.getByText("Technician note in progress"));
    fireEvent.click(container.querySelector(".absolute.inset-0"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not put a React node into aria-label", () => {
    render(
      <InspectionModal open onClose={() => {}} title={<span>Rich title</span>} icon={Thermometer}>
        <p>b</p>
      </InspectionModal>
    );
    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-label");
  });
});

describe("SimpleModal", () => {
  it("uses the caller's close icon", () => {
    const CustomIcon = ({ size }) => <svg data-testid="custom-close" width={size} />;
    render(<SimpleModal title="x" onClose={() => {}} closeIcon={CustomIcon}><p>b</p></SimpleModal>);
    expect(screen.getByTestId("custom-close")).toBeInTheDocument();
  });

  it("closes on a click that begins on the backdrop", () => {
    const onClose = vi.fn();
    const { container } = render(<SimpleModal title="x" onClose={onClose}><p>b</p></SimpleModal>);
    const backdrop = container.firstChild;
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("DetailModal", () => {
  it("closes on a click that begins on the backdrop", () => {
    const onClose = vi.fn();
    const { container } = render(<DetailModal title="x" onClose={onClose}><p>b</p></DetailModal>);
    const backdrop = container.firstChild;
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when a text selection is released on the backdrop", () => {
    const onClose = vi.fn();
    const { container } = render(
      <DetailModal title="x" onClose={onClose}><p>Crossmatch note</p></DetailModal>
    );
    fireEvent.mouseDown(screen.getByText("Crossmatch note"));
    fireEvent.click(container.firstChild);
    expect(onClose).not.toHaveBeenCalled();
  });
});
