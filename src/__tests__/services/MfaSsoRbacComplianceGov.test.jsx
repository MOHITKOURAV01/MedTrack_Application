import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE = "http://localhost:8081";
const server = setupServer(
  http.post(`${BASE}/api/auth/mfa/setup/u1`, () => HttpResponse.json({ qrCode: "otpauth://..." })),
  http.post(`${BASE}/api/auth/mfa/verify`, () => HttpResponse.json({ verified: true })),
  http.get(`${BASE}/api/auth/mfa/status/u1`, () => HttpResponse.json({ enabled: true, methods: ["TOTP"] })),
  http.post(`${BASE}/api/auth/mfa/disable/u1`, () => HttpResponse.json({ disabled: true })),
  http.get(`${BASE}/api/auth/devices/active/u1`, () => HttpResponse.json([{ deviceId: "DEV-001", type: "Mobile" }])),
  http.post(`${BASE}/api/auth/devices/register/u1`, () => HttpResponse.json({ deviceId: "DEV-NEW" })),
  http.post(`${BASE}/api/auth/devices/revoke`, () => HttpResponse.json({ revoked: true })),
  http.post(`${BASE}/api/auth/devices/revoke-others/u1`, () => HttpResponse.json({ revoked: 2 })),
  http.post(`${BASE}/api/auth/sso/configure`, () => HttpResponse.json({ providerId: "SSO-NEW", configured: true })),
  http.post(`${BASE}/api/auth/sso/initiate`, () => HttpResponse.json({ redirectUrl: "https://idp.example.com/sso" })),
  http.get(`${BASE}/api/auth/sso/providers`, () => HttpResponse.json([{ providerId: "SSO-001", name: "Azure AD" }])),
  http.post(`${BASE}/api/auth/sso/toggle/SSO-001`, () => HttpResponse.json({ toggled: true })),
  http.get(`${BASE}/api/auth/audit/risk/u1`, () => HttpResponse.json({ riskScore: 15, level: "LOW" })),
  http.get(`${BASE}/api/auth/audit/user/u1`, () => HttpResponse.json([{ action: "LOGIN", timestamp: "2026-08-01" }])),
  http.get(`${BASE}/api/auth/rbac/roles`, () => HttpResponse.json([{ roleId: "ROLE-001", name: "ADMIN" }])),
  http.get(`${BASE}/api/auth/rbac/permissions`, () => HttpResponse.json([{ code: "EQUIPMENT_READ", desc: "Read equipment" }])),
  http.post(`${BASE}/api/auth/rbac/roles`, () => HttpResponse.json({ roleId: "ROLE-NEW" })),
  http.put(`${BASE}/api/auth/rbac/matrix`, () => HttpResponse.json({ updated: true })),
  http.get(`${BASE}/api/auth/rbac/check/u1`, () => HttpResponse.json({ granted: true })),
  http.get(`${BASE}/api/auth/compliance/policy`, () => HttpResponse.json({ enforceHIPAA: true })),
  http.put(`${BASE}/api/auth/compliance/policy`, () => HttpResponse.json({ success: true })),
  http.post(`${BASE}/api/auth/compliance/audit/run`, () => HttpResponse.json({ auditId: "AUD-001", score: 96 })),
  http.post(`${BASE}/api/auth/compliance/controls/evidence`, () => HttpResponse.json({ evidenceId: "EV-NEW" })),
  http.get(`${BASE}/api/auth/compliance/reports`, () => HttpResponse.json([{ reportId: "CRPT-001", type: "HIPAA" }])),
  http.get(`${BASE}/api/auth/compliance/controls`, () => HttpResponse.json([{ controlId: "CC-001", name: "Encryption" }])),
  http.get(`${BASE}/api/auth/governance/policy`, () => HttpResponse.json({ enforceZeroTrust: true })),
  http.put(`${BASE}/api/auth/governance/policy`, () => HttpResponse.json({ success: true })),
  http.post(`${BASE}/api/auth/governance/scan`, () => HttpResponse.json({ scanId: "SCAN-001", issues: 2 })),
  http.get(`${BASE}/api/auth/governance/controls`, () => HttpResponse.json([{ controlId: "GC-001", status: "COMPLIANT" }])),
  http.get(`${BASE}/api/auth/governance/reports`, () => HttpResponse.json([{ reportId: "GR-001", type: "Quarterly" }])),
);
beforeEach(() => sessionStorage.clear());
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import { setupMfa, verifyMfa, getMfaStatus, disableMfa, getActiveDevices, registerDeviceSession, revokeDeviceSession, revokeAllOtherDevices } from "../../services/MfaService";
import { configureSsoProvider, initiateSsoLogin, getAllSsoProviders, toggleSsoProvider, evaluateUserSecurityRisk, getUserAuditLogs } from "../../services/SsoSecurityService";
import { getAllRoles, getAllPermissions, createRole, updateRolePermissions, checkUserPermission } from "../../services/RbacSecurityService";
import { getActivePolicy, updatePolicy, runComplianceAudit, recordControlEvidence, getAllAuditReports, getAllControlItems } from "../../services/ComplianceSecurityService";
import { getActivePolicy as getGovernancePolicy, updatePolicy as updateGovernancePolicy, runComplianceScan, getAllControls, getAllAuditReports as getGovernanceReports } from "../../services/SecurityGovernanceService";

describe("MfaService", () => {
  it("setupMfa returns QR code", async () => {
    const data = await setupMfa("u1");
    expect(data.qrCode).toBeDefined();
  });
  it("verifyMfa verifies code", async () => {
    const result = await verifyMfa({ userId: "u1", code: "123456" });
    expect(result.verified).toBe(true);
  });
  it("getMfaStatus returns status", async () => {
    const data = await getMfaStatus("u1");
    expect(data.enabled).toBe(true);
  });
  it("disableMfa disables MFA", async () => {
    const result = await disableMfa("u1");
    expect(result.disabled).toBe(true);
  });
  it("getActiveDevices returns devices", async () => {
    const data = await getActiveDevices("u1");
    expect(data).toHaveLength(1);
    expect(data[0].type).toBe("Mobile");
  });
  it("registerDeviceSession registers device", async () => {
    const result = await registerDeviceSession("u1");
    expect(result.deviceId).toBe("DEV-NEW");
  });
  it("revokeDeviceSession revokes device", async () => {
    const result = await revokeDeviceSession({ deviceId: "DEV-001" });
    expect(result.revoked).toBe(true);
  });
  it("revokeAllOtherDevices revokes others", async () => {
    const result = await revokeAllOtherDevices("u1", "DEV-CURRENT");
    expect(result.revoked).toBe(2);
  });
});

describe("SsoSecurityService", () => {
  it("configureSsoProvider configures provider", async () => {
    const result = await configureSsoProvider({ name: "Azure AD" });
    expect(result.configured).toBe(true);
  });
  it("initiateSsoLogin initiates SSO", async () => {
    const result = await initiateSsoLogin("user@example.com");
    expect(result.redirectUrl).toContain("idp.example.com");
  });
  it("getAllSsoProviders returns providers", async () => {
    const data = await getAllSsoProviders();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Azure AD");
  });
  it("toggleSsoProvider toggles provider", async () => {
    const result = await toggleSsoProvider("SSO-001", true);
    expect(result.toggled).toBe(true);
  });
  it("evaluateUserSecurityRisk returns risk", async () => {
    const data = await evaluateUserSecurityRisk("u1");
    expect(data.riskScore).toBe(15);
    expect(data.level).toBe("LOW");
  });
  it("getUserAuditLogs returns logs", async () => {
    const data = await getUserAuditLogs("u1");
    expect(data).toHaveLength(1);
    expect(data[0].action).toBe("LOGIN");
  });
});

describe("RbacSecurityService", () => {
  it("getAllRoles returns roles", async () => {
    const data = await getAllRoles();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("ADMIN");
  });
  it("getAllPermissions returns permissions", async () => {
    const data = await getAllPermissions();
    expect(data).toHaveLength(1);
    expect(data[0].code).toBe("EQUIPMENT_READ");
  });
  it("createRole creates role", async () => {
    const result = await createRole({ name: "VIEWER" });
    expect(result.roleId).toBe("ROLE-NEW");
  });
  it("updateRolePermissions updates permissions", async () => {
    const result = await updateRolePermissions("ROLE-001", ["EQUIPMENT_READ"]);
    expect(result.updated).toBe(true);
  });
  it("checkUserPermission checks permission", async () => {
    const result = await checkUserPermission("u1", "EQUIPMENT_READ");
    expect(result.granted).toBe(true);
  });
});

describe("ComplianceSecurityService", () => {
  it("getActivePolicy returns policy", async () => {
    const data = await getActivePolicy();
    expect(data.enforceHIPAA).toBe(true);
  });
  it("updatePolicy updates policy", async () => {
    const result = await updatePolicy({ enforceHIPAA: false });
    expect(result.success).toBe(true);
  });
  it("runComplianceAudit runs an audit", async () => {
    const result = await runComplianceAudit();
    expect(result.auditId).toBe("AUD-001");
    expect(result.score).toBe(96);
  });
  it("recordControlEvidence records evidence", async () => {
    const result = await recordControlEvidence({ controlId: "CC-001", note: "Reviewed" });
    expect(result.evidenceId).toBe("EV-NEW");
  });
  it("getAllAuditReports returns reports", async () => {
    const data = await getAllAuditReports();
    expect(data).toHaveLength(1);
    expect(data[0].type).toBe("HIPAA");
  });
  it("getAllControlItems returns controls", async () => {
    const data = await getAllControlItems();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Encryption");
  });
});

describe("SecurityGovernanceService", () => {
  it("getActivePolicy returns the governance policy", async () => {
    const data = await getGovernancePolicy();
    expect(data.enforceZeroTrust).toBe(true);
  });
  it("updatePolicy updates the governance policy", async () => {
    const result = await updateGovernancePolicy({ enforceZeroTrust: false });
    expect(result.success).toBe(true);
  });
  it("runComplianceScan runs a scan", async () => {
    const result = await runComplianceScan();
    expect(result.scanId).toBe("SCAN-001");
    expect(result.issues).toBe(2);
  });
  it("getAllControls returns governance controls", async () => {
    const data = await getAllControls();
    expect(data).toHaveLength(1);
    expect(data[0].status).toBe("COMPLIANT");
  });
  it("getAllAuditReports returns governance reports", async () => {
    const data = await getGovernanceReports();
    expect(data).toHaveLength(1);
    expect(data[0].type).toBe("Quarterly");
  });
});
