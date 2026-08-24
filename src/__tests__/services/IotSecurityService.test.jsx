import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE = "http://localhost:8081";

const server = setupServer(
  http.get(`${BASE}/api/auth/iot/devices`, () =>
    HttpResponse.json([{ deviceId: "IOMT-001", deviceName: "Infusion Pump", status: "ACTIVE_MONITORED" }])
  ),
  http.post(`${BASE}/api/auth/iot/devices`, () =>
    HttpResponse.json({ deviceId: "IOMT-NEW", status: "ACTIVE_MONITORED" })
  ),
  http.post(`${BASE}/api/auth/iot/devices/:id/quarantine`, () =>
    HttpResponse.json({ deviceId: "IOMT-001", status: "QUARANTINED" })
  ),
);

beforeEach(() => sessionStorage.clear());
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import {
  getIotDevices,
  onboardIotDevice,
  quarantineIotDevice,
  getFda524bRequirements,
} from "../../services/IotSecurityService";

describe("IotSecurityService", () => {
  it("getIotDevices returns device list", async () => {
    const data = await getIotDevices();
    expect(data).toHaveLength(1);
    expect(data[0].deviceName).toBe("Infusion Pump");
  });

  it("onboardIotDevice registers a new device", async () => {
    const result = await onboardIotDevice({ deviceName: "New Pump" });
    expect(result.deviceId).toBe("IOMT-NEW");
  });

  it("quarantineIotDevice isolates a device", async () => {
    const result = await quarantineIotDevice("IOMT-001");
    expect(result.status).toBe("QUARANTINED");
  });

  it("getFda524bRequirements returns FDA requirements", async () => {
    const data = await getFda524bRequirements();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].section).toBe("524B(b)(1)");
  });

  it("getIotDevices falls back on error", async () => {
    server.use(http.get(`${BASE}/api/auth/iot/devices`, () => HttpResponse.error("fail")));
    const data = await getIotDevices();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("onboardIotDevice falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/iot/devices`, () => HttpResponse.error("fail")));
    const result = await onboardIotDevice({ deviceName: "Fallback Device" });
    expect(result.deviceId).toContain("IOMT-DEV-");
    expect(result.status).toBe("ACTIVE_MONITORED");
  });

  it("quarantineIotDevice falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/iot/devices/:id/quarantine`, () => HttpResponse.error("fail")));
    const result = await quarantineIotDevice("IOMT-999");
    expect(result.status).toBe("QUARANTINED");
    expect(result.vlanSegment).toContain("ISOLATION");
  });
});
