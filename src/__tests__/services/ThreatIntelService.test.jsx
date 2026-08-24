import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE = "http://localhost:8081";

const server = setupServer(
  http.get(`${BASE}/api/auth/threat-intel/feeds`, () =>
    HttpResponse.json([{ indicatorId: "IOC-001", threatActor: "APT-41", status: "ACTIVE_BLOCKED" }])
  ),
  http.post(`${BASE}/api/auth/threat-intel/feeds`, () =>
    HttpResponse.json({ indicatorId: "IOC-NEW", status: "ACTIVE_BLOCKED" })
  ),
  http.post(`${BASE}/api/auth/threat-intel/taxii-sync`, () =>
    HttpResponse.json({ syncStatus: "SYNCHRONIZED_SUCCESSFULLY", newIndicatorsIngested: 12 })
  ),
);

beforeEach(() => sessionStorage.clear());
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import {
  getThreatFeeds,
  ingestThreatIndicator,
  syncTaxiiFeed,
  getTaxiiCollections,
} from "../../services/ThreatIntelService";

describe("ThreatIntelService", () => {
  it("getThreatFeeds returns indicator list", async () => {
    const data = await getThreatFeeds();
    expect(data).toHaveLength(1);
    expect(data[0].threatActor).toBe("APT-41");
  });

  it("ingestThreatIndicator adds a new indicator", async () => {
    const result = await ingestThreatIndicator({ threatActor: "New APT", iocValue: "1.2.3.4" });
    expect(result.indicatorId).toBe("IOC-NEW");
  });

  it("syncTaxiiFeed syncs threat data", async () => {
    const result = await syncTaxiiFeed();
    expect(result.syncStatus).toBe("SYNCHRONIZED_SUCCESSFULLY");
    expect(result.newIndicatorsIngested).toBe(12);
  });

  it("getTaxiiCollections returns collection list", async () => {
    const data = await getTaxiiCollections();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].collectionId).toBe("H-ISAC-MED-FEEDS");
  });

  it("getThreatFeeds falls back on error", async () => {
    server.use(http.get(`${BASE}/api/auth/threat-intel/feeds`, () => HttpResponse.error("fail")));
    const data = await getThreatFeeds();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].indicatorId).toBe("IOC-STIX-9012");
  });

  it("ingestThreatIndicator falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/threat-intel/feeds`, () => HttpResponse.error("fail")));
    const result = await ingestThreatIndicator({});
    expect(result.indicatorId).toContain("IOC-STIX-");
    expect(result.stixVersion).toBe("STIX 2.1");
  });

  it("syncTaxiiFeed falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/threat-intel/taxii-sync`, () => HttpResponse.error("fail")));
    const result = await syncTaxiiFeed();
    expect(result.syncStatus).toBe("SYNCHRONIZED_SUCCESSFULLY");
    expect(result.taxiiServer).toContain("h-isac.org");
  });
});
