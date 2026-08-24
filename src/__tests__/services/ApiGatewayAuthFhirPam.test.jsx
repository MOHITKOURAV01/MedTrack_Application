import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE = "http://localhost:8081";
const server = setupServer(
  http.get(`${BASE}/api/auth/api-gateway/routes`, () => HttpResponse.json([{ routeId: "RG-001", path: "/api/patients", method: "GET" }])),
  http.post(`${BASE}/api/auth/api-gateway/routes`, () => HttpResponse.json({ routeId: "RG-NEW" })),
  http.post(`${BASE}/api/auth/api-gateway/routes/RG-001/owasp-audit`, () => HttpResponse.json({ score: 95, passed: true })),
  http.post(`${BASE}/api/auth/register`, () => HttpResponse.json({ userId: "U-NEW", registered: true })),
  http.post(`${BASE}/api/auth/login`, () => HttpResponse.json({ token: "tok123", user: { id: "u1", role: "hospital" } })),
  http.post(`${BASE}/api/auth/forgot-password`, () => HttpResponse.json({ sent: true })),
  http.post(`${BASE}/api/auth/verify-otp`, () => HttpResponse.json({ verified: true })),
  http.post(`${BASE}/api/auth/reset-password`, () => HttpResponse.json({ reset: true })),
  http.get(`${BASE}/api/auth/authority/version/u1`, () => HttpResponse.json({ version: 3 })),
  http.post(`${BASE}/api/auth/authority/version/increment`, () => HttpResponse.json({ version: 4 })),
  http.post(`${BASE}/api/auth/authority/version/bump-global`, () => HttpResponse.json({ bumped: true })),
  http.get(`${BASE}/api/auth/authority/audit-logs/u1`, () => HttpResponse.json([{ action: "LOGIN", ts: "2026-08-01" }])),
  http.get(`${BASE}/api/auth/fhir/resources`, () => HttpResponse.json([{ resourceId: "FH-001", type: "Patient" }])),
  http.post(`${BASE}/api/auth/fhir/resources`, () => HttpResponse.json({ resourceId: "FH-NEW" })),
  http.post(`${BASE}/api/auth/fhir/resources/FH-001/audit-scopes`, () => HttpResponse.json({ score: 92 })),
  http.get(`${BASE}/api/auth/pam/policy`, () => HttpResponse.json({ requireApproval: true })),
  http.put(`${BASE}/api/auth/pam/policy`, () => HttpResponse.json({ success: true })),
  http.post(`${BASE}/api/auth/pam/request`, () => HttpResponse.json({ requestId: "PAM-REQ-NEW" })),
  http.put(`${BASE}/api/auth/pam/request/PR-001/approve`, () => HttpResponse.json({ approved: true })),
  http.post(`${BASE}/api/auth/pam/session/log`, () => HttpResponse.json({ logId: "LOG-NEW" })),
  http.get(`${BASE}/api/auth/pam/requests`, () => HttpResponse.json([{ requestId: "PR-001", status: "PENDING" }])),
  http.get(`${BASE}/api/auth/pam/session/logs`, () => HttpResponse.json([{ logId: "LOG-001", action: "SESSION_START" }])),
);
beforeEach(() => sessionStorage.clear());
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import { getApiRoutes, onboardApiRoute, auditApiRouteOwasp } from "../../services/ApiGatewaySecurityService";
import { registerUser, loginUser, forgotPassword, verifyOtp, resetPassword, getAuthorityVersion, incrementAuthorityVersion, bumpGlobalAuthorityVersion, getAuthorityAuditLogs } from "../../services/AuthService";
import { getFhirResources, registerFhirResource, auditSmartScopes } from "../../services/FhirEhrSecurityService";
import { getActivePolicy, updatePolicy, createAccessRequest, approveRequest, recordSessionLog, getAllRequests, getAllSessionLogs } from "../../services/PamService";

describe("ApiGatewaySecurityService", () => {
  it("getApiRoutes returns routes", async () => { const d = await getApiRoutes(); expect(d).toHaveLength(1); expect(d[0].path).toBe("/api/patients"); });
  it("onboardApiRoute onboardes route", async () => { const r = await onboardApiRoute({ path: "/api/new" }); expect(r.routeId).toBe("RG-NEW"); });
  it("auditApiRouteOwasp audits route", async () => { const r = await auditApiRouteOwasp("RG-001"); expect(r.score).toBe(95); expect(r.passed).toBe(true); });
});

describe("AuthService", () => {
  it("registerUser registers user", async () => { const r = await registerUser({ email: "test@test.com" }); expect(r.userId).toBe("U-NEW"); });
  it("loginUser logs in", async () => { const r = await loginUser({ email: "test@test.com", password: "pass" }); expect(r.token).toBe("tok123"); });
  it("forgotPassword sends reset email", async () => { const r = await forgotPassword({ email: "test@test.com" }); expect(r.sent).toBe(true); });
  it("verifyOtp verifies code", async () => { const r = await verifyOtp({ code: "123456" }); expect(r.verified).toBe(true); });
  it("resetPassword resets password", async () => { const r = await resetPassword({ token: "abc", password: "new" }); expect(r.reset).toBe(true); });
  it("getAuthorityVersion returns version", async () => { const v = await getAuthorityVersion("u1"); expect(v.version).toBe(3); });
  it("incrementAuthorityVersion increments", async () => { const r = await incrementAuthorityVersion({ userId: "u1" }); expect(r.version).toBe(4); });
  it("bumpGlobalAuthorityVersion bumps", async () => { const r = await bumpGlobalAuthorityVersion({}); expect(r.bumped).toBe(true); });
  it("getAuthorityAuditLogs returns logs", async () => { const d = await getAuthorityAuditLogs("u1"); expect(d).toHaveLength(1); expect(d[0].action).toBe("LOGIN"); });
});

describe("FhirEhrSecurityService", () => {
  it("getFhirResources returns resources", async () => { const d = await getFhirResources(); expect(d).toHaveLength(1); expect(d[0].type).toBe("Patient"); });
  it("registerFhirResource registers", async () => { const r = await registerFhirResource({ type: "Observation" }); expect(r.resourceId).toBe("FH-NEW"); });
  it("auditSmartScopes audits", async () => { const r = await auditSmartScopes("FH-001"); expect(r.score).toBe(92); });
});

describe("PamService", () => {
  it("getActivePolicy returns policy", async () => { const d = await getActivePolicy(); expect(d.requireApproval).toBe(true); });
  it("updatePolicy updates", async () => { const r = await updatePolicy({ requireApproval: false }); expect(r.success).toBe(true); });
  it("createAccessRequest creates request", async () => { const r = await createAccessRequest({ target: "prod-db" }); expect(r.requestId).toBe("PAM-REQ-NEW"); });
  it("approveRequest approves", async () => { const r = await approveRequest("PR-001"); expect(r.approved).toBe(true); });
  it("recordSessionLog records log", async () => { const r = await recordSessionLog({ action: "START" }); expect(r.logId).toBe("LOG-NEW"); });
  it("getAllRequests returns requests", async () => { const d = await getAllRequests(); expect(d).toHaveLength(1); expect(d[0].status).toBe("PENDING"); });
  it("getAllSessionLogs returns logs", async () => { const d = await getAllSessionLogs(); expect(d).toHaveLength(1); expect(d[0].action).toBe("SESSION_START"); });
});
