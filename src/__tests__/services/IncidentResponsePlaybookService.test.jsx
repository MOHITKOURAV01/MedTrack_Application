import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE = "http://localhost:8081";

const mockData = {
  playbooks: [
    { id: "pb_001", name: "Ransomware Containment", category: "ENDPOINT_DEFENSE", totalSteps: 5, status: "READY" },
    { id: "pb_002", name: "PHI Exfiltration Freeze", category: "PRIVACY_GUARD", totalSteps: 6, status: "READY" },
  ],
  incidents: [
    { id: "inc_001", playbookId: "pb_001", severity: "CRITICAL", status: "EXECUTING" },
    { id: "inc_002", playbookId: "pb_002", severity: "HIGH", status: "CONTAINED" },
  ],
};

const server = setupServer(
  http.get(`${BASE}/api/auth/ir/playbooks`, () => HttpResponse.json(mockData.playbooks)),
  http.get(`${BASE}/api/auth/ir/incidents`, () => HttpResponse.json(mockData.incidents)),
  http.post(`${BASE}/api/auth/ir/playbooks/:id/execute`, () =>
    HttpResponse.json({ success: true, incidentId: "inc_new_001" })
  ),
  http.get(`${BASE}/api/auth/ir/incidents/:id/export`, () =>
    HttpResponse.json({ success: true, downloadUrl: "/api/auth/ir/incidents/inc_001/forensics.zip" })
  ),
);

beforeEach(() => { sessionStorage.clear(); });
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import {
  getIncidentPlaybooks,
  getActiveIrIncidents,
  executePlaybook,
  exportForensicPackage,
} from "../../services/IncidentResponsePlaybookService";

describe("IncidentResponsePlaybookService", () => {
  it("getIncidentPlaybooks returns playbook list", async () => {
    const data = await getIncidentPlaybooks();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe("Ransomware Containment");
  });

  it("getActiveIrIncidents returns active incidents", async () => {
    const data = await getActiveIrIncidents();
    expect(data).toHaveLength(2);
    expect(data[0].status).toBe("EXECUTING");
  });

  it("executePlaybook returns success for a valid playbook", async () => {
    const result = await executePlaybook("pb_001", "SERVER-01");
    expect(result.success).toBe(true);
    expect(result.incidentId).toBeDefined();
  });

  it("exportForensicPackage returns download URL", async () => {
    const result = await exportForensicPackage("inc_001");
    expect(result.success).toBe(true);
    expect(result.downloadUrl).toContain("forensics.zip");
  });

  it("getIncidentPlaybooks falls back to mock data on error", async () => {
    server.use(
      http.get(`${BASE}/api/auth/ir/playbooks`, () => HttpResponse.error("Network error"))
    );
    const data = await getIncidentPlaybooks();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].id).toBe("pb_ir_101");
  });

  it("getActiveIrIncidents falls back on error", async () => {
    server.use(
      http.get(`${BASE}/api/auth/ir/incidents`, () => HttpResponse.error("fail"))
    );
    const data = await getActiveIrIncidents();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("executePlaybook returns fallback result on error", async () => {
    server.use(
      http.post(`${BASE}/api/auth/ir/playbooks/:id/execute`, () => HttpResponse.error("fail"))
    );
    const result = await executePlaybook("pb_999", "HOST-01");
    expect(result.success).toBe(true);
    expect(result.incidentId).toBeDefined();
    expect(result.executionSteps).toBeDefined();
  });

  it("exportForensicPackage returns fallback result on error", async () => {
    server.use(
      http.get(`${BASE}/api/auth/ir/incidents/:id/export`, () => HttpResponse.error("fail"))
    );
    const result = await exportForensicPackage("inc_999");
    expect(result.success).toBe(true);
    expect(result.sha256).toBeDefined();
  });
});
