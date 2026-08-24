import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE = "http://localhost:8081";
const server = setupServer(
  http.get(`${BASE}/api/auth/ztna/tunnels`, () => HttpResponse.json([{ tunnelId: "TN-001", status: "ACTIVE" }])),
  http.get(`${BASE}/api/auth/ztna/policies`, () => HttpResponse.json([{ policyId: "ZP-001", name: "Microseg" }])),
  http.post(`${BASE}/api/auth/ztna/evaluate-posture`, () => HttpResponse.json({ postureScore: 95, compliant: true })),
  http.post(`${BASE}/api/auth/ztna/tunnels/TN-001/terminate`, () => HttpResponse.json({ terminated: true })),
  http.get(`${BASE}/api/auth/ztna/governance/policies`, () => HttpResponse.json([{ policyId: "GP-001" }])),
  http.post(`${BASE}/api/auth/ztna/governance/policies`, () => HttpResponse.json({ policyId: "GP-NEW" })),
  http.get(`${BASE}/api/auth/ztna/governance/evaluations`, () => HttpResponse.json([{ evalId: "GE-001", score: 88 }])),
  http.post(`${BASE}/api/auth/ztna/governance/simulate`, () => HttpResponse.json({ trustScore: 92 })),
  http.get(`${BASE}/api/auth/dlp/rules`, () => HttpResponse.json([{ ruleId: "DR-001", name: "PHI Block" }])),
  http.get(`${BASE}/api/auth/dlp/incidents`, () => HttpResponse.json([{ incidentId: "DI-001", severity: "HIGH" }])),
  http.put(`${BASE}/api/auth/dlp/rules/DR-001`, () => HttpResponse.json({ toggled: true })),
  http.post(`${BASE}/api/auth/dlp/simulate-masking`, () => HttpResponse.json({ maskedText: "Patient [REDACTED]", piiDetected: 3 })),
  http.get(`${BASE}/api/auth/grc/frameworks`, () => HttpResponse.json([{ frameworkId: "FW-001", name: "HIPAA", score: 94 }])),
  http.get(`${BASE}/api/auth/grc/evidence`, () => HttpResponse.json([{ evidenceId: "EV-001", control: "Access Control" }])),
  http.post(`${BASE}/api/auth/grc/evaluate/CTL-001`, () => HttpResponse.json({ compliant: true })),
  http.post(`${BASE}/api/auth/grc/reports/generate`, () => HttpResponse.json({ reportUrl: "/reports/grc.pdf" })),
);
beforeEach(() => sessionStorage.clear());
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import { getActiveSdpTunnels, getMicrosegmentPolicies, evaluateDevicePosture, terminateSdpTunnel } from "../../services/ZeroTrustNetworkService";
import { getGovernancePolicies, createGovernancePolicy, getActiveTrustEvaluations, evaluateTrustSimulation } from "../../services/ZeroTrustGovernanceService";
import { getDlpRules, getDlpIncidents, toggleDlpRule, simulateTextMasking } from "../../services/DlpPrivacyGuardService";
import { getGrcFrameworkScores, getAuditEvidenceLedger, evaluateControlEvidence, generateComplianceReport } from "../../services/GrcAuditComplianceService";

describe("ZeroTrustNetworkService", () => {
  it("getActiveSdpTunnels returns tunnels", async () => {
    const data = await getActiveSdpTunnels();
    expect(data).toHaveLength(1);
    expect(data[0].status).toBe("ACTIVE");
  });
  it("getMicrosegmentPolicies returns policies", async () => {
    const data = await getMicrosegmentPolicies();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Microseg");
  });
  it("evaluateDevicePosture evaluates posture", async () => {
    const result = await evaluateDevicePosture({ osVersion: "14.0" });
    expect(result.postureScore).toBe(95);
    expect(result.compliant).toBe(true);
  });
  it("terminateSdpTunnel terminates tunnel", async () => {
    const result = await terminateSdpTunnel("TN-001");
    expect(result.terminated).toBe(true);
  });
});

describe("ZeroTrustGovernanceService", () => {
  it("getGovernancePolicies returns policies", async () => {
    const data = await getGovernancePolicies();
    expect(data).toHaveLength(1);
  });
  it("createGovernancePolicy creates policy", async () => {
    const result = await createGovernancePolicy({ name: "New Policy" });
    expect(result.policyId).toBe("GP-NEW");
  });
  it("getActiveTrustEvaluations returns evaluations", async () => {
    const data = await getActiveTrustEvaluations();
    expect(data).toHaveLength(1);
    expect(data[0].score).toBe(88);
  });
  it("evaluateTrustSimulation simulates trust", async () => {
    const result = await evaluateTrustSimulation({ deviceScore: 90 });
    expect(result.trustScore).toBe(92);
  });
});

describe("DlpPrivacyGuardService", () => {
  it("getDlpRules returns rules", async () => {
    const data = await getDlpRules();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("PHI Block");
  });
  it("getDlpIncidents returns incidents", async () => {
    const data = await getDlpIncidents();
    expect(data).toHaveLength(1);
    expect(data[0].severity).toBe("HIGH");
  });
  it("toggleDlpRule toggles rule", async () => {
    const result = await toggleDlpRule("DR-001", "ACTIVE");
    expect(result.toggled).toBe(true);
  });
  it("simulateTextMasking simulates masking", async () => {
    const result = await simulateTextMasking("Patient John SSN 123-45-6789");
    expect(result.maskedText).toContain("[REDACTED]");
    expect(result.piiDetected).toBe(3);
  });
});

describe("GrcAuditComplianceService", () => {
  it("getGrcFrameworkScores returns frameworks", async () => {
    const data = await getGrcFrameworkScores();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("HIPAA");
    expect(data[0].score).toBe(94);
  });
  it("getAuditEvidenceLedger returns evidence", async () => {
    const data = await getAuditEvidenceLedger();
    expect(data).toHaveLength(1);
    expect(data[0].control).toBe("Access Control");
  });
  it("evaluateControlEvidence evaluates control", async () => {
    const result = await evaluateControlEvidence("CTL-001");
    expect(result.compliant).toBe(true);
  });
  it("generateComplianceReport generates report", async () => {
    const result = await generateComplianceReport("FW-001");
    expect(result.reportUrl).toBeDefined();
  });
});
