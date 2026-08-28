import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useKeyboardShortcuts, {
  matchesShortcut,
  parseShortcut,
} from "../../hooks/useKeyboardShortcuts";

const keydown = (init) => new KeyboardEvent("keydown", { ...init, cancelable: true });
const dispatch = (init) => act(() => window.dispatchEvent(keydown(init)));

let warn;
let error;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  error.mockRestore();
});

describe("parseShortcut", () => {
  it("splits a descriptor into modifiers and key", () => {
    expect(parseShortcut("ctrl+k")).toEqual({ key: "k", modifiers: ["ctrl"] });
    expect(parseShortcut("escape")).toEqual({ key: "escape", modifiers: [] });
    expect(parseShortcut("meta+shift+?")).toEqual({ key: "?", modifiers: ["meta", "shift"] });
  });

  it("is order-insensitive and case-insensitive", () => {
    expect(parseShortcut("Shift+Ctrl+K").modifiers.sort()).toEqual(["ctrl", "shift"]);
    expect(parseShortcut("CTRL+K").key).toBe("k");
  });

  it("accepts the modifier spellings people actually type", () => {
    expect(parseShortcut("cmd+k").modifiers).toEqual(["meta"]);
    expect(parseShortcut("command+k").modifiers).toEqual(["meta"]);
    expect(parseShortcut("super+k").modifiers).toEqual(["meta"]);
    expect(parseShortcut("control+k").modifiers).toEqual(["ctrl"]);
    expect(parseShortcut("option+k").modifiers).toEqual(["alt"]);
  });

  it("rejects a descriptor naming something that is not a modifier", () => {
    // The old parser ignored the segment, which turned "hyper+k" into a bare "k".
    expect(parseShortcut("hyper+k")).toBeNull();
    expect(parseShortcut("fn+k")).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("rejects an empty or non-string descriptor", () => {
    expect(parseShortcut("")).toBeNull();
    expect(parseShortcut("   ")).toBeNull();
    expect(parseShortcut(undefined)).toBeNull();
    expect(parseShortcut(null)).toBeNull();
    expect(parseShortcut(42)).toBeNull();
  });

  it("reads a trailing plus as the plus key", () => {
    expect(parseShortcut("ctrl++")).toEqual({ key: "+", modifiers: ["ctrl"] });
  });

  it("de-duplicates a repeated modifier", () => {
    expect(parseShortcut("ctrl+ctrl+k").modifiers).toEqual(["ctrl"]);
  });
});

describe("matchesShortcut", () => {
  it("matches a key that needs Shift to be typed at all", () => {
    // The whole reason "?" was unmatchable: pressing it sets shiftKey, and an exact comparison
    // demanded shiftKey === false.
    expect(matchesShortcut(keydown({ key: "?", shiftKey: true }), "?")).toBe(true);
    expect(matchesShortcut(keydown({ key: ":", shiftKey: true }), ":")).toBe(true);
    expect(matchesShortcut(keydown({ key: "~", shiftKey: true }), "~")).toBe(true);
    expect(matchesShortcut(keydown({ key: "?", shiftKey: true }), "shift+?")).toBe(true);
  });

  it("still requires the modifiers a descriptor does name", () => {
    expect(matchesShortcut(keydown({ key: "?", shiftKey: true, ctrlKey: true }), "?")).toBe(false);
    expect(matchesShortcut(keydown({ key: "?", shiftKey: true }), "meta+?")).toBe(false);
    expect(matchesShortcut(keydown({ key: "?", shiftKey: true, metaKey: true }), "meta+?")).toBe(true);
  });

  it("keeps Shift meaningful for letters and digits", () => {
    expect(matchesShortcut(keydown({ key: "a" }), "a")).toBe(true);
    expect(matchesShortcut(keydown({ key: "A", shiftKey: true }), "a")).toBe(false);
    expect(matchesShortcut(keydown({ key: "a", shiftKey: true }), "shift+a")).toBe(true);
  });

  it("matches nothing for a descriptor with an unknown modifier", () => {
    // Previously this matched a bare "k" - a shortcut nobody registered.
    expect(matchesShortcut(keydown({ key: "k" }), "cmmd+k")).toBe(false);
    expect(matchesShortcut(keydown({ key: "k", metaKey: true }), "cmmd+k")).toBe(false);
  });

  it("understands the modifier aliases", () => {
    expect(matchesShortcut(keydown({ key: "k", metaKey: true }), "cmd+k")).toBe(true);
    expect(matchesShortcut(keydown({ key: "k", ctrlKey: true }), "control+k")).toBe(true);
    expect(matchesShortcut(keydown({ key: "k", altKey: true }), "option+k")).toBe(true);
  });

  it("returns false rather than throwing for an event with no key", () => {
    // A global window listener that throws takes every later listener down with it.
    expect(() => matchesShortcut({ ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, "escape")).not.toThrow();
    expect(matchesShortcut({}, "escape")).toBe(false);
    expect(matchesShortcut(null, "escape")).toBe(false);
  });
});

describe("useKeyboardShortcuts", () => {
  it("ignores auto-repeat, so a held shortcut fires once", () => {
    // App.jsx binds ctrl+k to setPaletteOpen((open) => !open). Held down, the palette opened and
    // closed on every repeat - dozens of times a second.
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts({ "ctrl+k": handler }));
    dispatch({ key: "k", ctrlKey: true });
    dispatch({ key: "k", ctrlKey: true, repeat: true });
    dispatch({ key: "k", ctrlKey: true, repeat: true });
    dispatch({ key: "k", ctrlKey: true, repeat: true });
    expect(handler).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("repeats when the caller asks for it", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({ arrowdown: handler }, { allowRepeat: true })
    );
    dispatch({ key: "ArrowDown" });
    dispatch({ key: "ArrowDown", repeat: true });
    expect(handler).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("does not fire a mistyped modifier combo as a bare-letter shortcut", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts({ "cmnd+k": handler }));
    dispatch({ key: "k" });
    dispatch({ key: "k", metaKey: true });
    expect(handler).not.toHaveBeenCalled();
    unmount();
  });

  it("does not hijack a capital letter typed into an input", () => {
    // "shift+f" contains a "+", so the old guard treated it as a command combo and let it fire
    // while the user was typing. Shift is not a command modifier.
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts({ "shift+f": handler }));
    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "f", shiftKey: true, bubbles: true, cancelable: true }));
    });
    document.body.removeChild(input);
    expect(handler).not.toHaveBeenCalled();
    unmount();
  });

  it("still fires a shift-only shortcut outside a text field", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts({ "shift+f": handler }));
    dispatch({ key: "f", shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("treats a select and a role=textbox as places the user is typing", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts({ k: handler }));

    for (const build of [
      () => document.createElement("select"),
      () => {
        const div = document.createElement("div");
        div.setAttribute("role", "textbox");
        return div;
      },
      () => {
        const div = document.createElement("div");
        div.setAttribute("role", "combobox");
        return div;
      },
    ]) {
      const el = build();
      document.body.appendChild(el);
      act(() => {
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "k", bubbles: true, cancelable: true }));
      });
      document.body.removeChild(el);
    }

    expect(handler).not.toHaveBeenCalled();
    unmount();
  });

  it("keeps running the other handlers when one throws", () => {
    const boom = vi.fn(() => {
      throw new Error("handler exploded");
    });
    const after = vi.fn();
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({ "ctrl+k": boom, "control+k": after })
    );
    expect(() => dispatch({ key: "k", ctrlKey: true })).not.toThrow();
    expect(boom).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
    unmount();
  });

  it("ignores an entry whose handler is not a function", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({ "ctrl+k": undefined, "control+k": handler })
    );
    expect(() => dispatch({ key: "k", ctrlKey: true })).not.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("survives a missing shortcut map", () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts(undefined));
    expect(() => dispatch({ key: "k", ctrlKey: true })).not.toThrow();
    unmount();
  });

  it("only prevents default for a shortcut it actually handles", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts({ "ctrl+k": handler }));

    const unhandled = keydown({ key: "j", ctrlKey: true });
    act(() => window.dispatchEvent(unhandled));
    expect(unhandled.defaultPrevented).toBe(false);

    const handled = keydown({ key: "k", ctrlKey: true });
    act(() => window.dispatchEvent(handled));
    expect(handled.defaultPrevented).toBe(true);

    unmount();
  });

  it("does not swallow a plain key the user is typing, even when it is registered", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts({ k: handler }));
    const input = document.createElement("input");
    document.body.appendChild(input);
    const typed = new KeyboardEvent("keydown", { key: "k", bubbles: true, cancelable: true });
    act(() => { input.dispatchEvent(typed); });
    document.body.removeChild(input);
    expect(handler).not.toHaveBeenCalled();
    expect(typed.defaultPrevented).toBe(false);
    unmount();
  });
});
