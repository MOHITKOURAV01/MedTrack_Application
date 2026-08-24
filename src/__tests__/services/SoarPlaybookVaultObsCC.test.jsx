import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE = "http://localhost:8081";
const server = setupServer(
  http.get(`${BASE}/api/auth/soar/playbooks`, () => HttpResponse.json([{ playbookId: "SP-001", name: "Auto Contain" }])),
  http.post(`${BASE}/api/auth/soar/playbooks`, () => HttpResponse.json({ playbookId: "SP-NEW" })),
  http.put(`${BASE}/api/auth/soar/playbooks/SP-001/toggle`, () => HttpResponse.json({ toggled: true })),
  http.post(`${BASE}/api/auth/soar/execute`, () => HttpResponse.json({ executionId: "EX-001", status: "RUNNING" })),
  http.get(`${BASE}/api/auth/soar/executions`, () => HttpResponse.json([{ executionId: "EX-001", status: "COMPLETED" }])),
  http.get(`${BASE}/api/auth/playbook/policy`, () => HttpResponse.json({ autoExecute: true })),
  http.put(`${BASE}/api/auth/playbook/policy`, () => HttpResponse.json({ success: true })),
  http.post(`${BASE}/api/auth/playbook/trigger`, () => HttpResponse.json({ triggered: true })),
  http.post(`${BASE}/api/auth/playbook/steps/record`, () => HttpResponse.json({ stepId: "STEP-001" })),
  http.get(`${BASE}/api/auth/playbook/executions`, () => HttpResponse.json([{ executionId: "PE-001" }])),
  http.get(`${BASE}/api/auth/playbook/steps/PE-001`, () => HttpResponse.json([{ step: 1, status: "DONE" }])),
  http.get(`${BASE}/api/auth/keyvault/policy`, () => HttpResponse.json({ rotationDays: 90 })),
  http.put(`${BASE}/api/auth/keyvault/policy`, () => HttpResponse.json({ success: true })),
  http.post(`${BASE}/api/auth/keyvault/keys`, () => HttpResponse.json({ keyId: "KEY-NEW", algorithm: "AES-256" })),
  http.post(`${BASE}/api/auth/keyvault/keys/KEY-001/rotate`, () => HttpResponse.json({ rotated: true })),
  http.post(`${BASE}/api/auth/keyvault/keys/KEY-001/revoke`, () => HttpResponse.json({ revoked: true })),
  http.get(`${BASE}/api/auth/keyvault/keys`, () => HttpResponse.json([{ keyId: "KEY-001", algorithm: "RSA-4096" }])),
  http.get(`${BASE}/api/auth/keyvault/audit-logs`, () => HttpResponse.json([{ action: "KEY_ROTATED", timestamp: "2026-08-01" }])),
  http.get(`${BASE}/api/auth/observability/policy`, () => HttpResponse.json({ alertThreshold: 80 })),
  http.put(`${BASE}/api/auth/observability/policy`, () => HttpResponse.json({ success: true })),
  http.post(`${BASE}/api/auth/observability/streams/ingest`, () => HttpResponse.json({ streamId: "STR-NEW" })),
  http.post(`${BASE}/api/auth/observability/metrics/record`, () => HttpResponse.json({ metricId: "MET-NEW" })),
  http.get(`${BASE}/api/auth/observability/streams`, () => HttpResponse.json([{ streamId: "STR-001", type: "SYSLOG" }])),
  http.get(`${BASE}/api/auth/observability/metrics`, () => HttpResponse.json([{ metricId: "MET-001", name: "CPU" }])),
  http.get(`${BASE}/api/auth/commandcenter/summary`, () => HttpResponse.json({ totalAlerts: 12, criticalAlerts: 2 })),
  http.get(`${BASE}/api/auth/commandcenter/config`, () => HttpResponse.json({ dashboardRefresh: 30 })),
  http.put(`${BASE}/api/auth/commandcenter/config`, () => HttpResponse.json({ success: true })),
  http.post(`${BASE}/api/auth/commandcenter/alerts/acknowledge`, () => HttpResponse.json({ acknowledged: true })),
  http.get(`${BASE}/api/auth/commandcenter/alerts`, () => HttpResponse.json([{ alertId: "AL-001", severity: "CRITICAL" }])),
);
beforeEach(() => sessionStorage.clear());
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import { getAllPlaybooks, createPlaybook, togglePlaybookStatus, triggerPlaybook, getAllExecutionLogs } from "../../services/SoarService";
import { getActivePolicy, updatePolicy, triggerPlaybookExecution, recordPlaybookStep, getAllExecutions, getStepsByExecutionId } from "../../services/SecurityPlaybookService";
import { getActivePolicy as getKVPolicy, updatePolicy as updateKVPolicy, generateCryptoKey, rotateKey, revokeKey, getAllKeys, getAllAuditLogs } from "../../services/SecurityKeyVaultService";
import { getActivePolicy as getObsPolicy, updatePolicy as updateObsPolicy, ingestTelemetryStream, recordSecurityMetric, getAllStreams, getAllMetrics } from "../../services/SecurityObservabilityService";
import { getUnifiedSummary, getActiveConfig, updateConfig, acknowledgeAlert, getAllAlerts } from "../../services/SecurityCommandCenterService";

describe("SoarService", () => {
  it("getAllPlaybooks returns playbooks", async () => { const data = await getAllPlaybooks(); expect(data).toHaveLength(1); expect(data[0].name).toBe("Auto Contain"); });
  it("createPlaybook creates playbook", async () => { const result = await createPlaybook({ name: "New" }); expect(result.playbookId).toBe("SP-NEW"); });
  it("togglePlaybookStatus toggles", async () => { const result = await togglePlaybookStatus("SP-001", true); expect(result.toggled).toBe(true); });
  it("triggerPlaybook triggers execution", async () => { const result = await triggerPlaybook({ playbookId: "SP-001" }); expect(result.executionId).toBe("EX-001"); });
  it("getAllExecutionLogs returns logs", async () => { const data = await getAllExecutionLogs(); expect(data).toHaveLength(1); expect(data[0].status).toBe("COMPLETED"); });
});

describe("SecurityPlaybookService", () => {
  it("getActivePolicy returns policy", async () => { const data = await getActivePolicy(); expect(data.autoExecute).toBe(true); });
  it("updatePolicy updates policy", async () => { const result = await updatePolicy({ autoExecute: false }); expect(result.success).toBe(true); });
  it("triggerPlaybookExecution triggers", async () => { const result = await triggerPlaybookExecution({ playbookId: "SP-001" }); expect(result.triggered).toBe(true); });
  it("recordPlaybookStep records step", async () => { const result = await recordPlaybookStep({ executionId: "PE-001", step: 1 }); expect(result.stepId).toBe("STEP-001"); });
  it("getAllExecutions returns executions", async () => { const data = await getAllExecutions(); expect(data).toHaveLength(1); });
  it("getStepsByExecutionId returns steps", async () => { const data = await getStepsByExecutionId("PE-001"); expect(data).toHaveLength(1); expect(data[0].status).toBe("DONE"); });
});

describe("SecurityKeyVaultService", () => {
  it("getKVPolicy returns policy", async () => { const data = await getKVPolicy(); expect(data.rotationDays).toBe(90); });
  it("updateKVPolicy updates policy", async () => { const result = await updateKVPolicy({ rotationDays: 60 }); expect(result.success).toBe(true); });
  it("generateCryptoKey generates key", async () => { const result = await generateCryptoKey({ algorithm: "AES-256" }); expect(result.keyId).toBe("KEY-NEW"); });
  it("rotateKey rotates key", async () => { const result = await rotateKey("KEY-001"); expect(result.rotated).toBe(true); });
  it("revokeKey revokes key", async () => { const result = await revokeKey("KEY-001"); expect(result.revoked).toBe(true); });
  it("getAllKeys returns keys", async () => { const data = await getAllKeys(); expect(data).toHaveLength(1); expect(data[0].algorithm).toBe("RSA-4096"); });
  it("getAllAuditLogs returns logs", async () => { const data = await getAllAuditLogs(); expect(data).toHaveLength(1); expect(data[0].action).toBe("KEY_ROTATED"); });
});

describe("SecurityObservabilityService", () => {
  it("getObsPolicy returns policy", async () => { const data = await getObsPolicy(); expect(data.alertThreshold).toBe(80); });
  it("updateObsPolicy updates policy", async () => { const result = await updateObsPolicy({ alertThreshold: 90 }); expect(result.success).toBe(true); });
  it("ingestTelemetryStream ingests stream", async () => { const result = await ingestTelemetryStream({ data: "log" }); expect(result.streamId).toBe("STR-NEW"); });
  it("recordSecurityMetric records metric", async () => { const result = await recordSecurityMetric({ name: "disk", value: 75 }); expect(result.metricId).toBe("MET-NEW"); });
  it("getAllStreams returns streams", async () => { const data = await getAllStreams(); expect(data).toHaveLength(1); expect(data[0].type).toBe("SYSLOG"); });
  it("getAllMetrics returns metrics", async () => { const data = await getAllMetrics(); expect(data).toHaveLength(1); expect(data[0].name).toBe("CPU"); });
});

describe("SecurityCommandCenterService", () => {
  it("getUnifiedSummary returns the unified summary", async () => { const data = await getUnifiedSummary(); expect(data.totalAlerts).toBe(12); expect(data.criticalAlerts).toBe(2); });
  it("getActiveConfig returns the dashboard config", async () => { const data = await getActiveConfig(); expect(data.dashboardRefresh).toBe(30); });
  it("updateConfig updates the dashboard config", async () => { const result = await updateConfig({ dashboardRefresh: 60 }); expect(result.success).toBe(true); });
  it("acknowledgeAlert acknowledges an alert", async () => { const result = await acknowledgeAlert("AL-001"); expect(result.acknowledged).toBe(true); });
  it("getAllAlerts returns alerts", async () => { const data = await getAllAlerts(); expect(data).toHaveLength(1); expect(data[0].severity).toBe("CRITICAL"); });
});
