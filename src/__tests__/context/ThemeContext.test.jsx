import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  ThemeProvider,
  useTheme,
  resolveTheme,
  readStoredPreference,
  writeStoredPreference,
  systemPrefersDark,
  THEME_STORAGE_KEY,
  SYSTEM,
} from "../../context/ThemeContext";

/**
 * Installs a `matchMedia` stub that reports `dark` and can be driven mid-test.
 *
 * The suite-wide stub in setupTests.js always answers `matches: false` and ignores its listeners,
 * which is fine for a test that only needs a light default but cannot express "the OS theme
 * changed" - the exact event this provider exists to react to.
 */
function installMatchMedia(initialDark = false) {
  const listeners = new Set();
  const query = {
    matches: initialDark,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_type, handler) => listeners.add(handler),
    removeEventListener: (_type, handler) => listeners.delete(handler),
    addListener: (handler) => listeners.add(handler),
    removeListener: (handler) => listeners.delete(handler),
    dispatchEvent: () => {},
  };
  window.matchMedia = () => query;
  return {
    query,
    /** Simulates the user changing their OS appearance setting. */
    setDark(next) {
      query.matches = next;
      act(() => {
        listeners.forEach((handler) => handler({ matches: next }));
      });
    },
    listenerCount: () => listeners.size,
  };
}

function ThemeConsumer({ onReady }) {
  const ctx = useTheme();
  onReady?.(ctx);
  return <div data-testid="theme-display">{ctx?.theme || "none"}</div>;
}

function renderProvider() {
  let ctx;
  const utils = render(
    <ThemeProvider>
      <ThemeConsumer onReady={(c) => { ctx = c; }} />
    </ThemeProvider>
  );
  return { ...utils, getCtx: () => ctx };
}

const painted = () => screen.getByTestId("theme-display").textContent;
const hasDarkClass = () => document.documentElement.classList.contains("dark");

const originalMatchMedia = window.matchMedia;

describe("ThemeContext", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    installMatchMedia(false);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  describe("resolveTheme", () => {
    it("honours an explicit preference regardless of the system setting", () => {
      expect(resolveTheme("light", true)).toBe("light");
      expect(resolveTheme("dark", false)).toBe("dark");
    });

    it("follows the system setting when the preference is 'system'", () => {
      expect(resolveTheme(SYSTEM, true)).toBe("dark");
      expect(resolveTheme(SYSTEM, false)).toBe("light");
    });

    it("treats an unrecognised preference as 'system'", () => {
      expect(resolveTheme("sepia", true)).toBe("dark");
      expect(resolveTheme(undefined, false)).toBe("light");
    });
  });

  describe("stored preference", () => {
    it("reads back the three valid preferences", () => {
      localStorage.setItem(THEME_STORAGE_KEY, "dark");
      expect(readStoredPreference()).toBe("dark");
      localStorage.setItem(THEME_STORAGE_KEY, "light");
      expect(readStoredPreference()).toBe("light");
      localStorage.setItem(THEME_STORAGE_KEY, SYSTEM);
      expect(readStoredPreference()).toBe(SYSTEM);
    });

    it("falls back to 'system' for an absent or unrecognised value", () => {
      expect(readStoredPreference()).toBe(SYSTEM);
      localStorage.setItem(THEME_STORAGE_KEY, "solarized");
      expect(readStoredPreference()).toBe(SYSTEM);
    });

    it("clears the key rather than storing 'system' literally", () => {
      localStorage.setItem(THEME_STORAGE_KEY, "dark");
      expect(writeStoredPreference(SYSTEM)).toBe(true);
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    });

    it("reports failure instead of throwing when the store rejects a write", () => {
      const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("QuotaExceededError");
      });
      expect(writeStoredPreference("dark")).toBe(false);
      setItem.mockRestore();
    });

    it("reports 'system' instead of throwing when the store rejects a read", () => {
      const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("SecurityError");
      });
      expect(readStoredPreference()).toBe(SYSTEM);
      getItem.mockRestore();
    });
  });

  describe("systemPrefersDark", () => {
    it("reflects the media query", () => {
      installMatchMedia(true);
      expect(systemPrefersDark()).toBe(true);
      installMatchMedia(false);
      expect(systemPrefersDark()).toBe(false);
    });

    it("answers false where matchMedia is missing or throws", () => {
      window.matchMedia = undefined;
      expect(systemPrefersDark()).toBe(false);
      window.matchMedia = () => { throw new Error("blocked"); };
      expect(systemPrefersDark()).toBe(false);
    });
  });

  describe("provider", () => {
    it("provides the theme, the preference and the actions", () => {
      const { getCtx } = renderProvider();
      const ctx = getCtx();
      expect(ctx.theme).toBe("light");
      expect(ctx.preference).toBe(SYSTEM);
      expect(ctx.isSystem).toBe(true);
      expect(typeof ctx.toggleTheme).toBe("function");
      expect(typeof ctx.followSystem).toBe("function");
      expect(typeof ctx.setPreference).toBe("function");
    });

    it("defaults to light when the OS asks for light", () => {
      expect(renderProvider().getCtx().theme).toBe("light");
    });

    it("defaults to dark when the OS asks for dark", () => {
      installMatchMedia(true);
      expect(renderProvider().getCtx().theme).toBe("dark");
      expect(hasDarkClass()).toBe(true);
    });

    it("reads an explicit preference from localStorage", () => {
      localStorage.setItem(THEME_STORAGE_KEY, "dark");
      expect(renderProvider().getCtx().theme).toBe("dark");
    });

    it("toggles light to dark and dark to light", () => {
      const { getCtx } = renderProvider();
      act(() => getCtx().toggleTheme());
      expect(painted()).toBe("dark");
      act(() => getCtx().toggleTheme());
      expect(painted()).toBe("light");
    });

    it("persists an explicit choice", () => {
      const { getCtx } = renderProvider();
      act(() => getCtx().toggleTheme());
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
      expect(getCtx().isSystem).toBe(false);
    });

    it("adds and removes the dark class on the document root", () => {
      const { getCtx } = renderProvider();
      act(() => getCtx().toggleTheme());
      expect(hasDarkClass()).toBe(true);
      act(() => getCtx().toggleTheme());
      expect(hasDarkClass()).toBe(false);
    });

    it("returns the fallback context outside a provider instead of undefined", () => {
      let ctx;
      render(<ThemeConsumer onReady={(c) => { ctx = c; }} />);
      expect(ctx).toBeDefined();
      expect(ctx.theme).toBe("light");
      expect(ctx.isSystem).toBe(true);
      // The consumers destructure and call these; a missing provider must degrade the control
      // rather than throw.
      expect(() => ctx.toggleTheme()).not.toThrow();
      expect(() => ctx.followSystem()).not.toThrow();
    });
  });

  // The regression this file exists for.
  describe("following the system theme", () => {
    it("writes nothing to storage on a first visit", () => {
      renderProvider();
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    });

    it("writes nothing when painting a dark system theme either", () => {
      installMatchMedia(true);
      renderProvider();
      expect(painted()).toBe("dark");
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    });

    it("keeps following the OS across a remount, having never been chosen", () => {
      const media = installMatchMedia(false);

      // First visit.
      const first = renderProvider();
      expect(painted()).toBe("light");
      first.unmount();

      // Second visit, in the same store. Before this fix the first visit had written
      // theme=light, so this mount treated it as a choice and stopped following the OS.
      const media2 = installMatchMedia(true);
      renderProvider();
      expect(painted()).toBe("dark");
      expect(media2.query.matches).toBe(true);
      expect(media.listenerCount()).toBe(0);
    });

    it("repaints live when the OS setting changes", () => {
      const media = installMatchMedia(false);
      renderProvider();
      expect(painted()).toBe("light");

      media.setDark(true);
      expect(painted()).toBe("dark");
      expect(hasDarkClass()).toBe(true);

      media.setDark(false);
      expect(painted()).toBe("light");
      expect(hasDarkClass()).toBe(false);
    });

    it("ignores an OS change once the user has chosen", () => {
      const media = installMatchMedia(false);
      const { getCtx } = renderProvider();

      act(() => getCtx().toggleTheme());
      expect(painted()).toBe("dark");

      media.setDark(false);
      expect(painted()).toBe("dark");
      media.setDark(true);
      expect(painted()).toBe("dark");
    });

    it("follows the OS again after followSystem, landing on its current value", () => {
      const media = installMatchMedia(false);
      const { getCtx } = renderProvider();

      act(() => getCtx().toggleTheme());
      expect(painted()).toBe("dark");
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

      // The OS flipped while the explicit choice was masking it.
      media.setDark(true);
      act(() => getCtx().followSystem());

      expect(getCtx().isSystem).toBe(true);
      expect(painted()).toBe("dark");
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();

      media.setDark(false);
      expect(painted()).toBe("light");
    });

    it("detaches its media listener on unmount", () => {
      const media = installMatchMedia(false);
      const { unmount } = renderProvider();
      expect(media.listenerCount()).toBe(1);
      unmount();
      expect(media.listenerCount()).toBe(0);
    });

    it("renders without matchMedia at all", () => {
      window.matchMedia = undefined;
      expect(() => renderProvider()).not.toThrow();
      expect(painted()).toBe("light");
    });
  });
});
