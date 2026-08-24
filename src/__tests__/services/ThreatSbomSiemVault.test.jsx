import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE = "http://localhost:8081";
const server = setupServer(
  http.get(`${BASE}/api/auth/threats/events`, () => HttpResponse.json([{ eventId: "TE-001", threatType: "RANSOMWARE", status: "DETECTED" }])),
  http.get(`${BASE}/api/auth/threats/playbooks`, () => HttpResponse.json([{ playbookId: "PB-001", name: "Ransomware Contain" }])),
  http.post(`${BASE}/api/auth/threats/playbooks/PB-001/execute`, () => HttpResponse.json({ executed: true })),
  http.patch(`${BASE}/api/auth/threats/playbooks/PB-001`, () => HttpResponse.json({ toggled: true })),
  http.post(`${BASE}/api/auth/threats/simulate`, () => HttpResponse.json({ simulated: true, threatType: "APT" })),
  http.patch(`${BASE}/api/auth/threats/events/TE-001`, () => HttpResponse.json({ updated: true })),
  http.get(`${BASE}/api/auth/sbom/artifacts`, () => HttpResponse.json([{ artifactId: "SB-001", name: "medtrack-core" }])),
  http.post(`${BASE}/api/auth/sbom/artifacts`, () => HttpResponse.json({ artifactId: "SB-NEW" })),
  http.get(`${BASE}/api/auth/sbom/components`, () => HttpResponse.json([{ componentId: "CMP-001", name: "react" }])),
  http.post(`${BASE}/api/auth/sbom/components`, () => HttpResponse.json({ componentId: "CMP-NEW" })),
  http.get(`${BASE}/api/auth/sbom/artifacts/SB-001/attestation`, () => HttpResponse.json({ signed: true, sig: "abc123" })),
  http.get(`${BASE}/api/auth/sbom/manifests/cyclonedx/SB-001`, () => HttpResponse.json({ format: "CycloneDX", bomRef: "bom-001" })),
  http.get(`${BASE}/api/auth/siem/events`, () => HttpResponse.json([{ eventId: "SE-001", event: "Login Failure" }])),
  http.get(`${BASE}/api/auth/siem/metrics`, () => HttpResponse.json({ eventsLast24h: 142 })),
  http.get(`${BASE}/api/auth/siem/rules`, () => HttpResponse.json([{ ruleId: "SR-001", name: "Brute Force" }])),
  http.put(`${BASE}/api/auth/siem/rules/SR-001`, () => HttpResponse.json({ toggled: true })),
  http.get(`${BASE}/api/auth/siem/export`, () => HttpResponse.json({ exportUrl: "/exports/siem.json" })),
  http.get(`${BASE}/api/auth/keyvault/secrets`, () => HttpResponse.json([{ secretId: "KV-001", name: "DB_PASSWORD" }])),
  http.get(`${BASE}/api/auth/keyvault/hsm-status`, () => HttpResponse.json({ hsmHealth: "OPERATIONAL", fipsLevel: 3 })),
  http.post(`${BASE}/api/auth/keyvault/secrets/KV-001/rotate`, () => HttpResponse.json({ rotated: true })),
  http.post(`${BASE}/api/auth/keyvault/secrets`, () => HttpResponse.json({ secretId: "KV-NEW" })),
  http.delete(`${BASE}/api/auth/keyvault/secrets/KV-001`, () => HttpResponse.json({ revoked: true })),
);
beforeEach(() => sessionStorage.clear());
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import { getActiveThreatEvents, getSoarPlaybooks, triggerPlaybookExecution, togglePlaybookStatus, simulateThreatIncident, updateThreatStatus } from "../../services/ThreatDetectionService";
import { getAllArtifacts, registerArtifact, getAllComponents, ingestComponent, generateAttestation, getCycloneDxManifest } from "../../services/SbomService";
import { getSiemEventLogs, getSiemMetrics, getSiemCorrelationRules, toggleCorrelationRule, exportSiemLogs } from "../../services/SiemSecurityAnalyticsService";
import { getKeyVaultSecrets, getHsmHealthTelemetry, rotateSecret, createSecret, revokeSecret } from "../../services/KeyVaultSecurityService";

describe("ThreatDetectionService", () => {
  it("getActiveThreatEvents returns events", async () => {
    const data = await getActiveThreatEvents();
    expect(data).toHaveLength(1);
    expect(data[0].threatType).toBe("RANSOMWARE");
  });
  it("getSoarPlaybooks returns playbooks", async () => {
    const data = await getSoarPlaybooks();
    expect(data).toHaveLength(1);
    expect(data[0].name).toContain("Ransomware");
  });
  it("triggerPlaybookExecution executes playbook", async () => {
    const result = await triggerPlaybookExecution("PB-001", "TE-001");
    expect(result.executed).toBe(true);
  });
  it("togglePlaybookStatus toggles playbook", async () => {
    const result = await togglePlaybookStatus("PB-001", true);
    expect(result.toggled).toBe(true);
  });
  it("simulateThreatIncident simulates threat", async () => {
    const result = await simulateThreatIncident("APT", "192.168.1.1", "SERVER-01");
    expect(result.simulated).toBe(true);
  });
  it("updateThreatStatus updates event status", async () => {
    const result = await updateThreatStatus("TE-001", "MITIGATED");
    expect(result.updated).toBe(true);
  });
});

describe("SbomService", () => {
  it("getAllArtifacts returns artifacts", async () => {
    const data = await getAllArtifacts();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("medtrack-core");
  });
  it("registerArtifact registers artifact", async () => {
    const result = await registerArtifact({ name: "New Component" });
    expect(result.artifactId).toBe("SB-NEW");
  });
  it("getAllComponents returns components", async () => {
    const data = await getAllComponents();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("react");
  });
  it("ingestComponent ingests component", async () => {
    const result = await ingestComponent({ name: "new-lib" });
    expect(result.componentId).toBe("CMP-NEW");
  });
  it("generateAttestation generates attestation", async () => {
    const data = await generateAttestation("SB-001");
    expect(data.signed).toBe(true);
  });
  it("getCycloneDxManifest returns manifest", async () => {
    const data = await getCycloneDxManifest("SB-001");
    expect(data.format).toBe("CycloneDX");
  });
});

describe("SiemSecurityAnalyticsService", () => {
  it("getSiemEventLogs returns events", async () => {
    const data = await getSiemEventLogs();
    expect(data).toHaveLength(1);
    expect(data[0].event).toBe("Login Failure");
  });
  it("getSiemMetrics returns metrics", async () => {
    const data = await getSiemMetrics();
    expect(data.eventsLast24h).toBe(142);
  });
  it("getSiemCorrelationRules returns rules", async () => {
    const data = await getSiemCorrelationRules();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Brute Force");
  });
  it("toggleCorrelationRule toggles rule", async () => {
    const result = await toggleCorrelationRule("SR-001", true);
    expect(result.toggled).toBe(true);
  });
  it("exportSiemLogs exports logs", async () => {
    const data = await exportSiemLogs("json");
    expect(data.exportUrl).toBeDefined();
  });
});

describe("KeyVaultSecurityService", () => {
  it("getKeyVaultSecrets returns secrets", async () => {
    const data = await getKeyVaultSecrets();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("DB_PASSWORD");
  });
  it("getHsmHealthTelemetry returns HSM status", async () => {
    const data = await getHsmHealthTelemetry();
    expect(data.hsmHealth).toBe("OPERATIONAL");
    expect(data.fipsLevel).toBe(3);
  });
  it("rotateSecret rotates a secret", async () => {
    const result = await rotateSecret("KV-001");
    expect(result.rotated).toBe(true);
  });
  it("createSecret creates a secret", async () => {
    const result = await createSecret({ name: "NEW_SECRET", value: "abc" });
    expect(result.secretId).toBe("KV-NEW");
  });
  it("revokeSecret revokes a secret", async () => {
    const result = await revokeSecret("KV-001");
    expect(result.revoked).toBe(true);
  });
});
