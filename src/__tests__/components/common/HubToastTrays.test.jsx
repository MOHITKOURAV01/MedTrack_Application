import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import ToastTray, { useToastTray } from "../../../components/common/ToastTray";
import {
  KindToastTray,
  SeverityToastTray,
  useKindToasts,
  useSeverityToasts,
} from "../../../components/common/HubToasts";
import ToastStack, { toneMeta, useToasts } from "../../../components/common/ToastStack";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * The four trays are asserted against one checklist. They are four renderings of the same idea and
 * had drifted into four different sets of defects; the point of the shared state is that they stop
 * being able to.
 */
const trays = [
  {
    name: "ToastTray",
    useTray: () => {
      const { toasts, toast, removeToast } = useToastTray();
      return { toasts, push: (text) => toast(text, "High"), removeToast };
    },
    Tray: ({ toasts, onDismiss }) => <ToastTray toasts={toasts} onDismiss={onDismiss} />,
    regionName: "Alerts",
    politeness: "assertive",
    max: 4,
  },
  {
    name: "KindToastTray",
    useTray: () => {
      const { toasts, addToast, removeToast } = useKindToasts();
      return { toasts, push: (text) => addToast(text, "warn"), removeToast };
    },
    Tray: ({ toasts, onDismiss }) => <KindToastTray toasts={toasts} onDismiss={onDismiss} />,
    regionName: "Notifications",
    politeness: "polite",
    max: 3,
  },
  {
    name: "SeverityToastTray",
    useTray: () => {
      const { toasts, toast, removeToast } = useSeverityToasts();
      return { toasts, push: (text) => toast(text, "High"), removeToast };
    },
    Tray: ({ toasts, onDismiss }) => <SeverityToastTray toasts={toasts} onDismiss={onDismiss} />,
    regionName: "Alerts",
    politeness: "assertive",
    max: 4,
  },
  {
    name: "ToastStack",
    useTray: () => {
      const { toasts, pushToast, dismissToast } = useToasts();
      return { toasts, push: (text) => pushToast(text, "body"), removeToast: dismissToast };
    },
    Tray: ({ toasts, onDismiss }) => (
      <ToastStack toasts={toasts} onDismiss={onDismiss} severityMeta={{ medium: { border: "border-slate-700", dot: "bg-slate-500" } }} />
    ),
    regionName: "Notifications",
    politeness: "polite",
    max: 4,
  },
];

describe.each(trays)("$name", ({ useTray, Tray, regionName, politeness, max }) => {
  function Console() {
    const { toasts, push, removeToast } = useTray();
    return (
      <>
        <button onClick={() => push(`alert ${toasts.length + 1}`)}>Push</button>
        <Tray toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  it("is a live region, so a toast is announced rather than only drawn", () => {
    render(<Console />);
    const region = screen.getByRole("log", { name: regionName });
    expect(region).toHaveAttribute("aria-live", politeness);
    expect(region).toHaveAttribute("aria-relevant", "additions");
  });

  it("caps the stack at its documented size", () => {
    const { result } = renderHook(() => useTray());
    for (let i = 0; i < max + 3; i += 1) {
      act(() => { result.current.push(`alert ${i}`); });
    }
    expect(result.current.toasts).toHaveLength(max);
  });

  it("offers a dismiss control for every toast on screen", () => {
    render(<Console />);
    act(() => { fireEvent.click(screen.getByText("Push")); });
    expect(screen.getAllByLabelText("Dismiss notification")).toHaveLength(1);
  });

  it("removes the toast when its dismiss control is used", () => {
    render(<Console />);
    act(() => { fireEvent.click(screen.getByText("Push")); });
    act(() => { fireEvent.click(screen.getByLabelText("Dismiss notification")); });
    expect(screen.queryByLabelText("Dismiss notification")).toBeNull();
  });

  it("leaves no timer armed once its console unmounts", () => {
    const { result, unmount } = renderHook(() => useTray());
    act(() => { result.current.push("alert"); });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("ToastTray", () => {
  it("shows the shield icon for the severities the page calls critical", () => {
    const { container } = render(
      <ToastTray toasts={[{ id: "T-1", msg: "Flagged run", sev: "Flagged" }]} critical={["Critical", "Flagged"]} />
    );
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("Flagged run")).toBeInTheDocument();
  });

  it("renders no dismiss control when the page does not supply one", () => {
    render(<ToastTray toasts={[{ id: "T-1", msg: "x", sev: "Low" }]} />);
    expect(screen.queryByLabelText("Dismiss notification")).toBeNull();
  });
});

describe("useKindToasts", () => {
  it("returns removeToast, which six consoles were already passing as onDismiss", () => {
    // `useKindToasts` returned only { toasts, addToast }, so `removeToast` was undefined at every
    // one of those call sites and the prop was dropped on the floor by a tray that ignored it.
    const { result } = renderHook(() => useKindToasts());
    expect(typeof result.current.removeToast).toBe("function");
    expect(typeof result.current.addToast).toBe("function");
  });

  it("defaults an unspecified kind to info", () => {
    const { result } = renderHook(() => useKindToasts());
    act(() => { result.current.addToast("no kind given"); });
    expect(result.current.toasts[0].kind).toBe("info");
  });
});

describe("useSeverityToasts", () => {
  it("defaults an unspecified severity to Low", () => {
    const { result } = renderHook(() => useSeverityToasts());
    act(() => { result.current.toast("no severity given"); });
    expect(result.current.toasts[0].severity).toBe("Low");
  });
});

describe("useToastTray", () => {
  it("respects the max its caller asks for", () => {
    const { result } = renderHook(() => useToastTray(2));
    act(() => { result.current.toast("a"); });
    act(() => { result.current.toast("b"); });
    act(() => { result.current.toast("c"); });
    expect(result.current.toasts.map((t) => t.msg)).toEqual(["b", "c"]);
  });
});

describe("toneMeta", () => {
  const meta = { critical: { border: "border-rose-500/30", dot: "bg-rose-500" }, medium: { border: "border-sky-500/30", dot: "bg-sky-500" } };

  it("uses the caller's entry for a known tone", () => {
    expect(toneMeta(meta, "critical")).toBe(meta.critical);
  });

  it("falls back to the caller's medium entry", () => {
    expect(toneMeta(meta, "chartreuse")).toBe(meta.medium);
  });

  it("returns a neutral entry rather than throwing when the map has no medium", () => {
    // `severityMeta[t.tone] || severityMeta.medium` was undefined for such a map, and the next line
    // read `meta.border` off it and took the console down.
    const partial = { high: { border: "b", dot: "d" } };
    expect(() => toneMeta(partial, "low")).not.toThrow();
    expect(toneMeta(partial, "low")).toHaveProperty("border");
    expect(toneMeta(partial, "low")).toHaveProperty("dot");
  });

  it("survives a missing map entirely", () => {
    expect(() => toneMeta(undefined, "low")).not.toThrow();
    expect(toneMeta(null, "low")).toHaveProperty("dot");
  });
});
