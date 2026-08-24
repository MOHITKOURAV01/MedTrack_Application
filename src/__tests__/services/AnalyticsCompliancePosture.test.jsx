import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE = "http://localhost:8081";
const server = setupServer(
  http.get(`${BASE}/api/analytics/hospital`, () => HttpResponse.json({ totalEquipment: 50, utilizationRate: 87 })),
  http.get(`${BASE}/api/auth/reporting/config`, () => HttpResponse.json({ autoReport: true, frequency: "WEEKLY" })),
  http.put(`${BASE}/api/auth/reporting/config`, () => HttpResponse.json({ success: true })),
  http.post(`${BASE}/api/auth/reporting/generate`, () => HttpResponse.json({ reportId: "RPT-001", status: "GENERATED" })),
  http.get(`${BASE}/api/auth/reporting/exports`, () => HttpResponse.json([{ reportId: "RPT-001", format: "PDF" }])),
  http.get(`${BASE}/api/auth/posture/policy`, () => HttpResponse.json({ enforceStrict: true })),
  http.put(`${BASE}/api/auth/posture/policy`, () => HttpResponse.json({ success: true })),
  http.post(`${BASE}/api/auth/posture/evaluation/run`, () => HttpResponse.json({ evalId: "EVAL-001", score: 92 })),
  http.post(`${BASE}/api/auth/posture/controls/check`, () => HttpResponse.json({ controlId: "CTL-001", passed: true })),
  http.get(`${BASE}/api/auth/posture/evaluations`, () => HttpResponse.json([{ evalId: "EVAL-001", score: 92 }])),
  http.get(`${BASE}/api/auth/posture/controls`, () => HttpResponse.json([{ controlId: "CTL-001", name: "Encryption at Rest" }])),
);
beforeEach(() => sessionStorage.clear());
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import { getHospitalAnalytics } from "../../services/AnalyticsService";
import { getActiveConfig, updateConfig, generateComplianceReport, getAllReportLogs } from "../../services/ComplianceReportingService";
import { getActivePolicy, updatePolicy, runPostureEvaluation, recordPostureCheck, getAllEvaluations, getAllControlAssessments } from "../../services/SecurityPostureService";

describe("AnalyticsService", () => {
  it("getHospitalAnalytics returns analytics data", async () => {
    const data = await getHospitalAnalytics();
    expect(data.totalEquipment).toBe(50);
    expect(data.utilizationRate).toBe(87);
  });
});

describe("ComplianceReportingService", () => {
  it("getActiveConfig returns config", async () => {
    const data = await getActiveConfig();
    expect(data.autoReport).toBe(true);
  });
  it("updateConfig updates configuration", async () => {
    const result = await updateConfig({ autoReport: false });
    expect(result.success).toBe(true);
  });
  it("generateComplianceReport generates a report", async () => {
    const result = await generateComplianceReport({ format: "PDF" });
    expect(result.reportId).toBe("RPT-001");
  });
  it("getAllReportLogs returns report list", async () => {
    const data = await getAllReportLogs();
    expect(data).toHaveLength(1);
  });
});

describe("SecurityPostureService", () => {
  it("getActivePolicy returns policy", async () => {
    const data = await getActivePolicy();
    expect(data.enforceStrict).toBe(true);
  });
  it("updatePolicy updates policy", async () => {
    const result = await updatePolicy({ enforceStrict: false });
    expect(result.success).toBe(true);
  });
  it("runPostureEvaluation runs evaluation", async () => {
    const result = await runPostureEvaluation({ scope: "ALL" });
    expect(result.score).toBe(92);
  });
  it("recordPostureCheck records a check", async () => {
    const result = await recordPostureCheck({ controlId: "CTL-001" });
    expect(result.passed).toBe(true);
  });
  it("getAllEvaluations returns evaluation list", async () => {
    const data = await getAllEvaluations();
    expect(data).toHaveLength(1);
  });
  it("getAllControlAssessments returns controls", async () => {
    const data = await getAllControlAssessments();
    expect(data).toHaveLength(1);
    expect(data[0].controlId).toBe("CTL-001");
  });
});
