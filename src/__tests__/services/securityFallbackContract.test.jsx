/**
 * Contract guard for the offline fallbacks of the security services.
 *
 * Each of these services is written as `try { return response.data } catch { return <literal> }`,
 * and the literal is what a console renders whenever the backend is unavailable. Two things had
 * gone wrong with that arrangement and neither was visible from the console:
 *
 *   1. The literal was written against the domain vocabulary rather than the API's, so the keys
 *      the console reads (`enabled`, `newStatus`, `eventsPerMinute`, `masked`, ...) were simply
 *      absent from it - every one of them rendered `undefined`.
 *
 *   2. A fallback for a *mutating* call reported `success: true`. Nothing was mutated. A revoked
 *      key was still live, a disabled SOAR playbook was still armed, and the operator had no way
 *      to tell.
 *
 * The per-service suites cover each method's own behaviour. This file covers the property that
 * has to hold across all of them, because it is the property that kept being lost one method at
 * a time.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import * as sbom from "../../services/SbomService";
import * as threat from "../../services/ThreatDetectionService";
import * as siem from "../../services/SiemSecurityAnalyticsService";
import * as vault from "../../services/KeyVaultSecurityService";
import * as dlp from "../../services/DlpPrivacyGuardService";
import * as grc from "../../services/GrcAuditComplianceService";

const BASE = "http://localhost:8081";

// Every request 503s. That is the whole point: this file only ever exercises the catch branch.
const server = setupServer(
  http.all(`${BASE}/*`, () => HttpResponse.json(null, { status: 503 })),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * `[label, () => promise, requiredKeys]`. `requiredKeys` is what the API contract - as encoded by
 * the MSW handlers in the dedicated per-service suites - guarantees the console can read.
 */
const READ_FALLBACKS = [
  ["SbomService.getCycloneDxManifest", () => sbom.getCycloneDxManifest("art_001"), ["format", "version", "components"]],
  ["SbomService.generateAttestation", () => sbom.generateAttestation("art_001"), ["attestationId", "slsaLevel", "artifactId"]],
  ["SiemSecurityAnalyticsService.getSiemMetrics", () => siem.getSiemMetrics(), ["eventsPerMinute", "alertsOpen", "meanTimeToDetectMinutes"]],
  ["SiemSecurityAnalyticsService.exportSiemLogs", () => siem.exportSiemLogs("csv"), ["downloadUrl", "format"]],
  ["KeyVaultSecurityService.getHsmHealthTelemetry", () => vault.getHsmHealthTelemetry(), ["hsmHealth", "keyCount", "fipsLevel"]],
  ["KeyVaultSecurityService.rotateSecret", () => vault.rotateSecret("sec_001"), ["newKeyVersion", "rotatedAt"]],
  ["KeyVaultSecurityService.revokeSecret", () => vault.revokeSecret("sec_001"), ["revokedAt"]],
  ["ThreatDetectionService.togglePlaybookStatus", () => threat.togglePlaybookStatus("pb_01", false), ["enabled"]],
  ["ThreatDetectionService.updateThreatStatus", () => threat.updateThreatStatus("evt_101", "RESOLVED"), ["newStatus"]],
  ["ThreatDetectionService.simulateThreatIncident", () => threat.simulateThreatIncident("DDOS", "1.2.3.4", "/api"), ["incidentId", "severity"]],
  ["DlpPrivacyGuardService.simulateTextMasking", () => dlp.simulateTextMasking("SSN 123-45-6789"), ["masked", "algorithm"]],
  ["GrcAuditComplianceService.evaluateControlEvidence", () => grc.evaluateControlEvidence("ctrl_01"), ["evaluationResult", "score"]],
];

describe("security service fallbacks carry the keys the API contract promises", () => {
  it.each(READ_FALLBACKS)("%s", async (_label, call, requiredKeys) => {
    const result = await call();
    for (const key of requiredKeys) {
      // `toHaveProperty` and not a truthiness check: `score: null` and `downloadUrl: null` are
      // the correct offline values. What must not happen is the key being missing entirely,
      // because that is indistinguishable at the call site from a backend that omitted it.
      expect(result).toHaveProperty(key);
    }
  });
});

describe("list fallbacks carry the contract keys on every element", () => {
  it("SbomService.getAllComponents", async () => {
    const components = await sbom.getAllComponents();
    expect(components.length).toBeGreaterThan(0);
    for (const c of components) {
      expect(c).toHaveProperty("componentId");
      expect(c).toHaveProperty("name");
    }
  });

  it("ThreatDetectionService.getSoarPlaybooks", async () => {
    const playbooks = await threat.getSoarPlaybooks();
    expect(playbooks.length).toBeGreaterThan(0);
    for (const p of playbooks) {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("name");
      // A boolean, not the "ENABLED"/"DISABLED" string the panel happens to display. The
      // string is still there for the panel; the boolean is what the contract states.
      expect(typeof p.enabled).toBe("boolean");
    }
  });
});

describe("a fallback for a mutating call never claims the mutation happened", () => {
  // These four change server-side state. If the request did not arrive, it did not change.
  const MUTATIONS = [
    ["KeyVaultSecurityService.rotateSecret", () => vault.rotateSecret("sec_001")],
    ["KeyVaultSecurityService.revokeSecret", () => vault.revokeSecret("sec_001")],
    ["SiemSecurityAnalyticsService.exportSiemLogs", () => siem.exportSiemLogs("csv")],
    ["GrcAuditComplianceService.evaluateControlEvidence", () => grc.evaluateControlEvidence("ctrl_01")],
  ];

  it.each(MUTATIONS)("%s reports success: false", async (_label, call) => {
    const result = await call();
    expect(result.success).toBe(false);
    expect(result.offline).toBe(true);
  });

  it("SbomService.generateAttestation does not mint an attestation id or a verdict", async () => {
    const att = await sbom.generateAttestation("art_001");
    expect(att.attestationId).toBeNull();
    expect(att.attestationSha256Checksum).toBeNull();
    expect(att.complianceVerdict).toBe("NOT_ATTESTED");
    expect(att.slsaLevel).toBe("UNVERIFIED");
  });

  it("KeyVaultSecurityService.revokeSecret says the secret is still active", async () => {
    const result = await vault.revokeSecret("sec_001");
    expect(result.revokedAt).toBeNull();
    expect(result.message).toMatch(/NOT revoked/);
  });

  // The two ThreatDetectionService toggles are the exception, and deliberately so: the panel
  // applies them optimistically to keep the SOC console responsive. They must still be flagged.
  it.each([
    ["togglePlaybookStatus", () => threat.togglePlaybookStatus("pb_01", false)],
    ["updateThreatStatus", () => threat.updateThreatStatus("evt_101", "RESOLVED")],
  ])("ThreatDetectionService.%s marks its optimistic result offline", async (_label, call) => {
    const result = await call();
    expect(result.offline).toBe(true);
    expect(result.message).toMatch(/unreachable/);
  });
});
