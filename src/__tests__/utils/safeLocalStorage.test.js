import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MISS,
  readJson,
  readJsonOr,
  readString,
  writeJson,
  remove,
  storageAvailable,
} from "../../utils/safeLocalStorage";

/**
 * Makes one `Storage.prototype` method throw for the duration of a test.
 *
 * Spying on the prototype rather than replacing `window.localStorage` matters: the module captured
 * its availability at import time against the real store, so the tests exercise the per-call guards
 * rather than the unavailable-store short circuit, which is what a store that goes bad mid-session
 * actually looks like.
 */
function breaking(method, error = new DOMException("SecurityError")) {
  return vi.spyOn(Storage.prototype, method).mockImplementation(() => {
    throw error;
  });
}

describe("safeLocalStorage", () => {
  let warn;

  beforeEach(() => {
    localStorage.clear();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports the store as available under jsdom", () => {
    expect(storageAvailable).toBe(true);
  });

  describe("readJson", () => {
    it("round-trips a value written by writeJson", () => {
      writeJson("k", { a: 1, b: ["x"] });
      expect(readJson("k")).toEqual({ a: 1, b: ["x"] });
    });

    it("returns MISS for an absent key", () => {
      expect(readJson("nope")).toBe(MISS);
    });

    // The distinction this module exists for.
    it("returns a stored empty array as a value, not a miss", () => {
      writeJson("k", []);
      expect(readJson("k")).toEqual([]);
      expect(readJson("k")).not.toBe(MISS);
    });

    it("returns a stored empty object, empty string, zero, false and null as values", () => {
      writeJson("obj", {});
      writeJson("str", "");
      writeJson("num", 0);
      writeJson("bool", false);
      writeJson("null", null);
      expect(readJson("obj")).toEqual({});
      expect(readJson("str")).toBe("");
      expect(readJson("num")).toBe(0);
      expect(readJson("bool")).toBe(false);
      expect(readJson("null")).toBeNull();
      expect(readJson("null")).not.toBe(MISS);
    });

    it("discards an unparseable entry and reports a miss", () => {
      localStorage.setItem("k", "{not json");
      expect(readJson("k")).toBe(MISS);
      expect(localStorage.getItem("k")).toBeNull();
      expect(warn).toHaveBeenCalled();
    });

    it("rejects a value the validator refuses, and clears it", () => {
      writeJson("k", { not: "an array" });
      expect(readJson("k", { validate: Array.isArray })).toBe(MISS);
      expect(localStorage.getItem("k")).toBeNull();
    });

    it("accepts a value the validator allows", () => {
      writeJson("k", [1, 2]);
      expect(readJson("k", { validate: Array.isArray })).toEqual([1, 2]);
    });

    it("reports a miss instead of throwing when getItem throws", () => {
      const spy = breaking("getItem");
      expect(readJson("k")).toBe(MISS);
      spy.mockRestore();
    });
  });

  describe("readJsonOr", () => {
    it("returns the stored value when there is one", () => {
      writeJson("k", [1]);
      expect(readJsonOr("k", ["fallback"])).toEqual([1]);
    });

    it("returns the fallback on a miss", () => {
      expect(readJsonOr("k", ["fallback"])).toEqual(["fallback"]);
    });

    it("returns a stored empty array rather than the fallback", () => {
      writeJson("k", []);
      expect(readJsonOr("k", ["fallback"])).toEqual([]);
    });
  });

  describe("writeJson", () => {
    it("reports success", () => {
      expect(writeJson("k", 1)).toBe(true);
    });

    it("reports failure instead of throwing when the quota is exceeded", () => {
      const spy = breaking("setItem", new DOMException("QuotaExceededError"));
      expect(writeJson("k", 1)).toBe(false);
      expect(warn).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("readString", () => {
    it("reads a raw string without parsing it", () => {
      localStorage.setItem("k", "dark");
      expect(readString("k")).toBe("dark");
    });

    it("returns the fallback for an absent key", () => {
      expect(readString("k", "light")).toBe("light");
      expect(readString("k")).toBeNull();
    });

    it("returns the fallback instead of throwing when getItem throws", () => {
      const spy = breaking("getItem");
      expect(readString("k", "light")).toBe("light");
      spy.mockRestore();
    });
  });

  describe("remove", () => {
    it("removes a key", () => {
      writeJson("k", 1);
      remove("k");
      expect(localStorage.getItem("k")).toBeNull();
    });

    it("swallows a throwing removeItem", () => {
      const spy = breaking("removeItem");
      expect(() => remove("k")).not.toThrow();
      spy.mockRestore();
    });
  });
});
