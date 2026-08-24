import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE = "http://localhost:8081";

const server = setupServer(
  http.get(`${BASE}/api/auth/rpm/streams`, () =>
    HttpResponse.json([{ streamId: "RPM-001", deviceType: "ECG", signalStatus: "STABLE" }])
  ),
  http.post(`${BASE}/api/auth/rpm/streams`, () =>
    HttpResponse.json({ streamId: "RPM-NEW", signalStatus: "STABLE_STREAMING" })
  ),
  http.post(`${BASE}/api/auth/rpm/streams/:id/scan`, () =>
    HttpResponse.json({ scanResult: "NO_TAMPERING", encryptionIntegrityScore: "99.9%" })
  ),
  http.get(`${BASE}/api/auth/pam/sessions`, () =>
    HttpResponse.json([{ sessionId: "PAM-001", operator: "admin@medtrack.org", approvalStatus: "JIT_APPROVED" }])
  ),
  http.post(`${BASE}/api/auth/pam/request-jit`, () =>
    HttpResponse.json({ sessionId: "PAM-NEW", approvalStatus: "JIT_APPROVED" })
  ),
  http.post(`${BASE}/api/auth/pam/sessions/:id/terminate`, () =>
    HttpResponse.json({ sessionId: "PAM-001", sessionRecordingState: "TERMINATED_MANUALLY" })
  ),
  http.get(`${BASE}/api/auth/fido2/credentials`, () =>
    HttpResponse.json([{ credentialId: "FIDO-001", keyName: "YubiKey", status: "ACTIVE" }])
  ),
  http.post(`${BASE}/api/auth/fido2/credentials`, () =>
    HttpResponse.json({ credentialId: "FIDO-NEW", status: "ACTIVE_ENFORCED" })
  ),
  http.post(`${BASE}/api/auth/fido2/simulate-attestation`, () =>
    HttpResponse.json({ authenticatorVerdict: "ATTESTATION_VERIFIED", counter: 1 })
  ),
);

beforeEach(() => sessionStorage.clear());
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import { getRpmStreams, pairRpmDevice, scanBiometricAnomalies, getRpmSecurityStandards } from "../../services/RpmTelemetryService";
import { getPamSessions, requestJitElevation, terminatePamSession, getPamVaultPolicy } from "../../services/PamSessionService";
import { getFido2Credentials, registerFido2Credential, runWebAuthnSimulation, getFidoStandards } from "../../services/Fido2WebAuthnService";

describe("RpmTelemetryService", () => {
  it("getRpmStreams returns stream list", async () => {
    const data = await getRpmStreams();
    expect(data).toHaveLength(1);
    expect(data[0].streamId).toBe("RPM-001");
  });

  it("pairRpmDevice pairs a new device", async () => {
    const result = await pairRpmDevice({ deviceType: "CGM" });
    expect(result.streamId).toBe("RPM-NEW");
  });

  it("scanBiometricAnomalies runs a scan", async () => {
    const result = await scanBiometricAnomalies("RPM-001");
    expect(result.scanResult).toBe("NO_TAMPERING");
  });

  it("getRpmSecurityStandards returns standards", async () => {
    const data = await getRpmSecurityStandards();
    expect(data).toHaveLength(3);
    expect(data[0].standard).toContain("FDA");
  });

  it("getRpmStreams falls back on error", async () => {
    server.use(http.get(`${BASE}/api/auth/rpm/streams`, () => HttpResponse.error("fail")));
    const data = await getRpmStreams();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("pairRpmDevice falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/rpm/streams`, () => HttpResponse.error("fail")));
    const result = await pairRpmDevice({});
    expect(result.streamId).toContain("RPM-STREAM-");
  });

  it("scanBiometricAnomalies falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/rpm/streams/:id/scan`, () => HttpResponse.error("fail")));
    const result = await scanBiometricAnomalies("RPM-999");
    expect(result.scanResult).toBe("NO_MALICIOUS_TAMPERING_DETECTED");
  });
});

describe("PamSessionService", () => {
  it("getPamSessions returns session list", async () => {
    const data = await getPamSessions();
    expect(data).toHaveLength(1);
    expect(data[0].sessionId).toBe("PAM-001");
  });

  it("requestJitElevation requests elevation", async () => {
    const result = await requestJitElevation({ operator: "admin@medtrack.org", targetHost: "prod-db" });
    expect(result.sessionId).toBe("PAM-NEW");
    expect(result.approvalStatus).toBe("JIT_APPROVED");
  });

  it("terminatePamSession terminates a session", async () => {
    const result = await terminatePamSession("PAM-001");
    expect(result.sessionRecordingState).toBe("TERMINATED_MANUALLY");
  });

  it("getPamVaultPolicy returns policies", async () => {
    const data = await getPamVaultPolicy();
    expect(data).toHaveLength(3);
    expect(data[0].policy).toContain("Break-Glass");
  });

  it("getPamSessions falls back on error", async () => {
    server.use(http.get(`${BASE}/api/auth/pam/sessions`, () => HttpResponse.error("fail")));
    const data = await getPamSessions();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("requestJitElevation falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/pam/request-jit`, () => HttpResponse.error("fail")));
    const result = await requestJitElevation({});
    expect(result.sessionId).toContain("PAM-SESS-");
    expect(result.approvalStatus).toBe("JIT_APPROVED");
  });

  it("terminatePamSession falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/pam/sessions/:id/terminate`, () => HttpResponse.error("fail")));
    const result = await terminatePamSession("PAM-999");
    expect(result.sessionId).toBe("PAM-999");
    expect(result.approvalStatus).toBe("REVOKED_IMMEDIATE");
  });
});

describe("Fido2WebAuthnService", () => {
  it("getFido2Credentials returns credential list", async () => {
    const data = await getFido2Credentials();
    expect(data).toHaveLength(1);
    expect(data[0].keyName).toBe("YubiKey");
  });

  it("registerFido2Credential registers a key", async () => {
    const result = await registerFido2Credential({ keyName: "New Key" });
    expect(result.credentialId).toBe("FIDO-NEW");
  });

  it("runWebAuthnSimulation runs attestation", async () => {
    const result = await runWebAuthnSimulation("HARDWARE_SECURITY_KEY");
    expect(result.authenticatorVerdict).toBe("ATTESTATION_VERIFIED");
  });

  it("getFidoStandards returns standards", async () => {
    const data = await getFidoStandards();
    expect(data).toHaveLength(3);
    expect(data[0].standard).toContain("WebAuthn");
  });

  it("getFido2Credentials falls back on error", async () => {
    server.use(http.get(`${BASE}/api/auth/fido2/credentials`, () => HttpResponse.error("fail")));
    const data = await getFido2Credentials();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("registerFido2Credential falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/fido2/credentials`, () => HttpResponse.error("fail")));
    const result = await registerFido2Credential({ keyName: "Fallback Key" });
    expect(result.credentialId).toContain("FIDO2-CRED-");
  });

  it("runWebAuthnSimulation falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/fido2/simulate-attestation`, () => HttpResponse.error("fail")));
    const result = await runWebAuthnSimulation("PLATFORM");
    expect(result.authenticatorVerdict).toContain("FIDO2_ATTESTATION");
  });
});
