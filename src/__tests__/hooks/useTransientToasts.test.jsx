import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import useTransientToasts, { DEFAULT_TOAST_MS, toastRegionProps } from "../../hooks/useTransientToasts";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useTransientToasts", () => {
  it("holds exactly `max` toasts, not one more", () => {
    // `[...prev.slice(-max), next]` keeps `max` and then appends. A tray documented as holding
    // four held five.
    const { result } = renderHook(() => useTransientToasts({ max: 4 }));

    for (let i = 1; i <= 6; i += 1) {
      act(() => { result.current.push({ msg: `toast ${i}` }); });
    }

    expect(result.current.toasts).toHaveLength(4);
    expect(result.current.toasts.map((t) => t.msg)).toEqual(["toast 3", "toast 4", "toast 5", "toast 6"]);
  });

  it("keeps the newest toasts and drops the oldest", () => {
    const { result } = renderHook(() => useTransientToasts({ max: 3 }));
    act(() => { result.current.push({ msg: "a" }); });
    act(() => { result.current.push({ msg: "b" }); });
    act(() => { result.current.push({ msg: "c" }); });
    act(() => { result.current.push({ msg: "d" }); });
    expect(result.current.toasts.map((t) => t.msg)).toEqual(["b", "c", "d"]);
  });

  it("carries the caller's fields through untouched", () => {
    const { result } = renderHook(() => useTransientToasts());
    act(() => { result.current.push({ message: "Excursion on Unit 3", severity: "High" }); });
    expect(result.current.toasts[0]).toMatchObject({ message: "Excursion on Unit 3", severity: "High" });
  });

  it("gives every toast a distinct id, even within one millisecond", () => {
    // Date.now() + Math.random() collides often enough for a duplicate React key when a simulation
    // tick pushes two toasts in the same frame. A counter cannot.
    const { result } = renderHook(() => useTransientToasts({ max: 50 }));
    act(() => {
      for (let i = 0; i < 20; i += 1) result.current.push({ msg: String(i) });
    });
    const ids = result.current.toasts.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("dismisses a toast after the configured delay", () => {
    const { result } = renderHook(() => useTransientToasts());
    act(() => { result.current.push({ msg: "a" }); });
    expect(result.current.toasts).toHaveLength(1);

    act(() => { vi.advanceTimersByTime(DEFAULT_TOAST_MS - 1); });
    expect(result.current.toasts).toHaveLength(1);

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.toasts).toHaveLength(0);
  });

  it("honours a custom duration", () => {
    const { result } = renderHook(() => useTransientToasts({ durationMs: 6500 }));
    act(() => { result.current.push({ msg: "a" }); });
    act(() => { vi.advanceTimersByTime(4200); });
    expect(result.current.toasts).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(2300); });
    expect(result.current.toasts).toHaveLength(0);
  });

  it("dismisses on demand and cancels that toast's timer", () => {
    const { result } = renderHook(() => useTransientToasts());
    let id;
    act(() => { id = result.current.push({ msg: "a" }); });
    act(() => { result.current.push({ msg: "b" }); });

    act(() => { result.current.dismiss(id); });
    expect(result.current.toasts.map((t) => t.msg)).toEqual(["b"]);

    // The cancelled timer must not fire later and disturb the remaining toasts.
    act(() => { vi.advanceTimersByTime(DEFAULT_TOAST_MS); });
    expect(result.current.toasts).toHaveLength(0);
  });

  it("ignores a dismissal for an id it does not hold", () => {
    const { result } = renderHook(() => useTransientToasts());
    act(() => { result.current.push({ msg: "a" }); });
    expect(() => act(() => { result.current.dismiss("T-999"); })).not.toThrow();
    expect(result.current.toasts).toHaveLength(1);
  });

  it("clears every pending timer when the console unmounts", () => {
    // Nothing cleared these. Leaving a console with toasts on screen left timers armed against a
    // tray that no longer existed - and these consoles push a toast on every simulation tick.
    const { result, unmount } = renderHook(() => useTransientToasts());
    act(() => {
      result.current.push({ msg: "a" });
      result.current.push({ msg: "b" });
    });
    expect(vi.getTimerCount()).toBe(2);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("toastRegionProps", () => {
  it("marks the container as a live log region", () => {
    expect(toastRegionProps()).toEqual({
      role: "log",
      "aria-live": "polite",
      "aria-relevant": "additions",
      "aria-label": "Notifications",
    });
  });

  it("takes an assertive politeness and a custom label for the severity trays", () => {
    expect(toastRegionProps("assertive", "Alerts")).toMatchObject({
      "aria-live": "assertive",
      "aria-label": "Alerts",
    });
  });

  it("is spreadable onto a container", () => {
    render(<div {...toastRegionProps("assertive", "Alerts")} />);
    const region = screen.getByRole("log", { name: "Alerts" });
    expect(region).toHaveAttribute("aria-live", "assertive");
  });
});
