import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DEFAULT_DEMO_RULES,
  RULES_STORAGE_KEY,
  getLocalRules,
  saveLocalRules,
} from "../../../components/hospital/PreventiveMaintenanceDemoRules";
import {
  DEMO_EVENTS,
  EVENTS_STORAGE_KEY,
  getLocalDemoEvents,
  saveLocalDemoEvents,
} from "../../../components/hospital/ActivityCenterDemoEvents";

/**
 * The two local demo stores are the same function twice over, against different keys and defaults,
 * so they are asserted through one table rather than in two copies that could drift.
 */
const STORES = [
  {
    name: "PreventiveMaintenanceDemoRules",
    key: RULES_STORAGE_KEY,
    defaults: DEFAULT_DEMO_RULES,
    read: getLocalRules,
    write: saveLocalRules,
    sample: [{ id: 1, name: "Only rule", active: true }],
  },
  {
    name: "ActivityCenterDemoEvents",
    key: EVENTS_STORAGE_KEY,
    defaults: DEMO_EVENTS,
    read: getLocalDemoEvents,
    write: saveLocalDemoEvents,
    sample: [{ id: "evt-x", title: "Only event", read: false }],
  },
];

describe.each(STORES)("$name", ({ key, defaults, read, write, sample }) => {
  let warn;

  beforeEach(() => {
    localStorage.clear();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("seeds the defaults when nothing is stored", () => {
    expect(read()).toEqual(defaults);
    expect(JSON.parse(localStorage.getItem(key))).toEqual(defaults);
  });

  it("returns what was stored", () => {
    write(sample);
    expect(read()).toEqual(sample);
  });

  // The regression this file exists for.
  it("honours a deliberately emptied list instead of restoring the defaults", () => {
    write(sample);
    write([]);

    expect(read()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(key))).toEqual([]);

    // And it survives the next load, which is where the old behaviour resurrected the defaults.
    expect(read()).toEqual([]);
  });

  it("re-seeds when the stored entry is unparseable", () => {
    localStorage.setItem(key, "{ broken");
    expect(read()).toEqual(defaults);
    expect(warn).toHaveBeenCalled();
  });

  it("re-seeds when the stored entry is the wrong shape", () => {
    localStorage.setItem(key, JSON.stringify({ nope: true }));
    expect(read()).toEqual(defaults);
  });

  it("returns the defaults without throwing when the store cannot be read", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(() => read()).not.toThrow();
    expect(read()).toEqual(defaults);
    getItem.mockRestore();
  });

  // The crash: the previous implementation guarded its read and then seeded through a bare setItem
  // on the next line, so a blocked store threw out of a function called from a mount effect.
  it("returns the defaults without throwing when the store cannot be written", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(() => read()).not.toThrow();
    expect(read()).toEqual(defaults);
    setItem.mockRestore();
  });

  it("reports whether a save succeeded", () => {
    expect(write(sample)).toBe(true);

    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(write(sample)).toBe(false);
    setItem.mockRestore();
  });
});

describe("demo store defaults", () => {
  it("ship a non-empty starting set, so the seeding path is meaningful", () => {
    expect(DEFAULT_DEMO_RULES.length).toBeGreaterThan(0);
    expect(DEMO_EVENTS.length).toBeGreaterThan(0);
  });

  it("use distinct storage keys", () => {
    expect(RULES_STORAGE_KEY).not.toBe(EVENTS_STORAGE_KEY);
  });
});
