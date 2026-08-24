import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE_URL = "http://localhost:8081";

const server = setupServer(
  // ZeroTrustNetworkService handlers
  http.get(`${BASE_URL}/api/auth/ztna/tunnels`, () =>
    HttpResponse.json([
      { id: "sdp_tun_9901", peerIp: "192.168.10.45", status: "ESTABLISHED", postureScore: 98 },
    ])
  ),
  http.get(`${BASE_URL}/api/auth/ztna/policies`, () =>
    HttpResponse.json([
      { id: "zt_pol_101", name: "ICU Subnet Isolation", action: "ALLOW_ENCRYPTED_MTLS", status: "ACTIVE" },
    ])
  ),
  http.post(`${BASE_URL}/api/auth/ztna/evaluate-posture`, () =>
    HttpResponse.json({ postureScore: 85, verdict: "PASSED_COMPLIANT" })
  ),
  http.post(`${BASE_URL}/api/auth/ztna/tunnels/:id/terminate`, () =>
    HttpResponse.json({ success: true, message: "Tunnel terminated" })
  ),
  // ZeroTrustGovernanceService handlers
  http.get(`${BASE_URL}/api/auth/ztna/governance/policies`, () =>
    HttpResponse.json([
      { id: "gov_001", name: "Data Access Policy", enforcementLevel: "STRICT", enabled: true },
    ])
  ),
  http.post(`${BASE_URL}/api/auth/ztna/governance/policies`, () =>
    HttpResponse.json({ id: "gov_new", name: "New Policy", status: "ACTIVE" })
  ),
  http.get(`${BASE_URL}/api/auth/ztna/governance/evaluations`, () =>
    HttpResponse.json([
      { id: "eval_001", score: 92, verdict: "COMPLIANT", evaluatedAt: "2026-07-28T10:00:00Z" },
    ])
  ),
  http.post(`${BASE_URL}/api/auth/ztna/governance/simulate`, () =>
    HttpResponse.json({ score: 78, verdict: "NEEDS_IMPROVEMENT", recommendations: ["Enable MFA"] })
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let networkSvc, governanceSvc;
beforeEach(async () => {
  vi.resetModules();
  networkSvc = await import("../../services/ZeroTrustNetworkService");
  governanceSvc = await import("../../services/ZeroTrustGovernanceService");
});

describe("ZeroTrustNetworkService", () => {
  describe("getActiveSdpTunnels", () => {
    it("fetches active SDP tunnels", async () => {
      const tunnels = await networkSvc.getActiveSdpTunnels();
      expect(Array.isArray(tunnels)).toBe(true);
      expect(tunnels[0]).toHaveProperty("id", "sdp_tun_9901");
      expect(tunnels[0]).toHaveProperty("status", "ESTABLISHED");
    });

    it("returns fallback tunnels on API failure", async () => {
      server.use(
        http.get(`${BASE_URL}/api/auth/ztna/tunnels`, () => HttpResponse.json(null, { status: 500 }))
      );
      const tunnels = await networkSvc.getActiveSdpTunnels();
      expect(Array.isArray(tunnels)).toBe(true);
      expect(tunnels.length).toBeGreaterThan(0);
      expect(tunnels[0]).toHaveProperty("id");
      expect(tunnels[0]).toHaveProperty("postureScore");
    });
  });

  describe("getMicrosegmentPolicies", () => {
    it("fetches microsegmentation policies", async () => {
      const policies = await networkSvc.getMicrosegmentPolicies();
      expect(Array.isArray(policies)).toBe(true);
      expect(policies[0].name).toBe("ICU Subnet Isolation");
      expect(policies[0].action).toBe("ALLOW_ENCRYPTED_MTLS");
    });

    it("returns fallback policies on API failure", async () => {
      server.use(
        http.get(`${BASE_URL}/api/auth/ztna/policies`, () => HttpResponse.json(null, { status: 503 }))
      );
      const policies = await networkSvc.getMicrosegmentPolicies();
      expect(Array.isArray(policies)).toBe(true);
      expect(policies.length).toBeGreaterThan(0);
      expect(policies[0]).toHaveProperty("action");
    });
  });

  describe("evaluateDevicePosture", () => {
    it("evaluates device posture score via API", async () => {
      const result = await networkSvc.evaluateDevicePosture({
        edrRunning: true, diskEncrypted: true, osPatchOutdated: false, firewallEnabled: true
      });
      expect(result).toHaveProperty("postureScore", 85);
      expect(result).toHaveProperty("verdict", "PASSED_COMPLIANT");
    });

    it("returns local evaluation on API failure", async () => {
      server.use(
        http.post(`${BASE_URL}/api/auth/ztna/evaluate-posture`, () => HttpResponse.json(null, { status: 500 }))
      );
      const result = await networkSvc.evaluateDevicePosture({
        edrRunning: true, diskEncrypted: false, osPatchOutdated: true, firewallEnabled: true
      });
      expect(result).toHaveProperty("postureScore");
      expect(result).toHaveProperty("verdict");
      expect(result).toHaveProperty("checksPassed");
      expect(Array.isArray(result.checksPassed)).toBe(true);
      expect(result.checksPassed.length).toBe(3);
    });

    it("calculates correct fallback score for fully compliant device", async () => {
      server.use(
        http.post(`${BASE_URL}/api/auth/ztna/evaluate-posture`, () => HttpResponse.json(null, { status: 500 }))
      );
      const result = await networkSvc.evaluateDevicePosture({
        edrRunning: true, diskEncrypted: true, osPatchOutdated: false, firewallEnabled: true
      });
      expect(result.postureScore).toBe(100);
      expect(result.verdict).toBe("PASSED_COMPLIANT");
    });

    it("calculates correct fallback score for non-compliant device", async () => {
      server.use(
        http.post(`${BASE_URL}/api/auth/ztna/evaluate-posture`, () => HttpResponse.json(null, { status: 500 }))
      );
      const result = await networkSvc.evaluateDevicePosture({
        edrRunning: false, diskEncrypted: false, osPatchOutdated: true, firewallEnabled: false
      });
      expect(result.postureScore).toBe(10);
      expect(result.verdict).toBe("QUARANTINE_REQUIRED");
    });
  });

  describe("terminateSdpTunnel", () => {
    it("terminates an SDP tunnel", async () => {
      const result = await networkSvc.terminateSdpTunnel("sdp_tun_9901");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("message");
    });

    it("returns fallback on API failure", async () => {
      server.use(
        http.post(`${BASE_URL}/api/auth/ztna/tunnels/:id/terminate`, () => HttpResponse.json(null, { status: 500 }))
      );
      const result = await networkSvc.terminateSdpTunnel("sdp_tun_9901");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("tunnelId", "sdp_tun_9901");
      expect(result).toHaveProperty("message");
    });
  });
});

describe("ZeroTrustGovernanceService", () => {
  describe("getGovernancePolicies", () => {
    it("fetches governance policies", async () => {
      const policies = await governanceSvc.getGovernancePolicies();
      expect(Array.isArray(policies)).toBe(true);
      expect(policies[0].name).toBe("Data Access Policy");
      expect(policies[0].enforcementLevel).toBe("STRICT");
    });

    it("returns fallback on API failure", async () => {
      server.use(
        http.get(`${BASE_URL}/api/auth/ztna/governance/policies`, () => HttpResponse.json(null, { status: 500 }))
      );
      const policies = await governanceSvc.getGovernancePolicies();
      expect(Array.isArray(policies)).toBe(true);
      expect(policies.length).toBeGreaterThan(0);
      // The fallback is the service's own seeded registry, which keys on
      // policyId/policyName rather than the id/name the mocked API returns.
      expect(policies[0]).toHaveProperty("policyName");
      expect(policies[0].policyId).toContain("POL-ZT-");
    });
  });

  describe("createGovernancePolicy", () => {
    it("creates a new governance policy", async () => {
      const result = await governanceSvc.createGovernancePolicy({ name: "New Policy", enforcementLevel: "ADVISORY" });
      expect(result).toHaveProperty("id", "gov_new");
      expect(result).toHaveProperty("status", "ACTIVE");
    });

    it("returns fallback on API failure", async () => {
      server.use(
        http.post(`${BASE_URL}/api/auth/ztna/governance/policies`, () => HttpResponse.json(null, { status: 500 }))
      );
      const result = await governanceSvc.createGovernancePolicy({ policyName: "Fallback" });
      expect(result.policyId).toContain("POL-ZT-");
      expect(result).toHaveProperty("status", "ACTIVE");
      // The fallback echoes the caller's name rather than inventing one.
      expect(result.policyName).toBe("Fallback");
    });
  });

  describe("getActiveTrustEvaluations", () => {
    it("fetches active trust evaluations", async () => {
      const evaluations = await governanceSvc.getActiveTrustEvaluations();
      expect(Array.isArray(evaluations)).toBe(true);
      expect(evaluations[0].verdict).toBe("COMPLIANT");
      expect(evaluations[0].score).toBe(92);
    });

    it("returns fallback on API failure", async () => {
      server.use(
        http.get(`${BASE_URL}/api/auth/ztna/governance/evaluations`, () => HttpResponse.json(null, { status: 500 }))
      );
      const evaluations = await governanceSvc.getActiveTrustEvaluations();
      expect(Array.isArray(evaluations)).toBe(true);
      expect(evaluations.length).toBeGreaterThan(0);
      expect(evaluations[0]).toHaveProperty("verdict");
    });
  });

  describe("evaluateTrustSimulation", () => {
    it("runs a trust simulation", async () => {
      const result = await governanceSvc.evaluateTrustSimulation({ subject: "nurse@medtrack.org" });
      expect(result).toHaveProperty("score", 78);
      expect(result).toHaveProperty("verdict", "NEEDS_IMPROVEMENT");
      expect(result.recommendations).toContain("Enable MFA");
    });

    it("returns fallback on API failure", async () => {
      server.use(
        http.post(`${BASE_URL}/api/auth/ztna/governance/simulate`, () => HttpResponse.json(null, { status: 500 }))
      );
      const result = await governanceSvc.evaluateTrustSimulation({
        devicePosture: "COMPLIANT_MDM",
        networkTrust: "INTERNAL_VPC",
        behaviorScore: 90,
      });
      // 50 base + 25 compliant MDM + 15 internal VPC + 10 behaviour above 80.
      expect(result.simulatedTrustScore).toBe(100);
      expect(result.verdict).toBe("ACCESS_GRANTED");
      expect(result.evaluationFactors.devicePostureBonus).toBe("+25");
    });
  });
});
