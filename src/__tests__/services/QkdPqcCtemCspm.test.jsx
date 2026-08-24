import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE = "http://localhost:8081";

const server = setupServer(
  // QKD
  http.get(`${BASE}/api/auth/qkd/nodes`, () =>
    HttpResponse.json([{ nodeId: "QKD-001", nodeName: "Metro Fiber Link", nodeStatus: "QUANTUM_LINK_ESTABLISHED" }])
  ),
  http.post(`${BASE}/api/auth/qkd/nodes`, () =>
    HttpResponse.json({ nodeId: "QKD-NEW", nodeStatus: "QUANTUM_LINK_ESTABLISHED" })
  ),
  http.post(`${BASE}/api/auth/qkd/nodes/:id/exchange-sim`, () =>
    HttpResponse.json({ eavesdropperDetected: false, siftedKeyLengthBits: 4096 })
  ),
  // PQC
  http.get(`${BASE}/api/auth/pqc/keys`, () =>
    HttpResponse.json([{ keyId: "PQC-001", algorithm: "Kyber-1024", status: "ACTIVE_ENFORCED" }])
  ),
  http.post(`${BASE}/api/auth/pqc/keys`, () =>
    HttpResponse.json({ keyId: "PQC-NEW", status: "ACTIVE_ENFORCED" })
  ),
  http.post(`${BASE}/api/auth/pqc/simulate`, () =>
    HttpResponse.json({ operationType: "KEY_ENCAPSULATION_KEM", executionTimeMs: 1.5 })
  ),
  // CTEM
  http.get(`${BASE}/api/auth/ctem/assets`, () =>
    HttpResponse.json([{ assetId: "CTEM-001", assetName: "Telehealth Portal", cvssScore: 8.8 }])
  ),
  http.post(`${BASE}/api/auth/ctem/scan`, () =>
    HttpResponse.json({ assetId: "CTEM-NEW", exposureLevel: "LOW_EXPOSURE_MONITORED" })
  ),
  http.post(`${BASE}/api/auth/ctem/assets/:id/validate`, () =>
    HttpResponse.json({ assetId: "CTEM-001", exploitabilityVerified: true, remoteCodeExecutionPossible: false })
  ),
  // CSPM
  http.get(`${BASE}/api/auth/cspm/accounts`, () =>
    HttpResponse.json([{ accountId: "AWS-001", provider: "AWS", status: "CONNECTED" }])
  ),
  http.post(`${BASE}/api/auth/cspm/accounts`, () =>
    HttpResponse.json({ accountId: "AZ-NEW", status: "CONNECTED" })
  ),
  http.get(`${BASE}/api/auth/cspm/findings`, () =>
    HttpResponse.json([{ findingId: "FIND-001", severity: "HIGH", status: "OPEN" }])
  ),
  http.post(`${BASE}/api/auth/cspm/findings/ingest`, () =>
    HttpResponse.json({ findingId: "FIND-NEW", status: "INGESTED" })
  ),
  http.put(`${BASE}/api/auth/cspm/findings/:id/remediate`, () =>
    HttpResponse.json({ findingId: "FIND-001", status: "REMEDIATED" })
  ),
);

beforeEach(() => sessionStorage.clear());
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import { getQkdNodes, provisionQkdNode, runQkdExchangeSimulation, getQkdStandards } from "../../services/QkdKeyDistributionService";
import { getPqcKeyPairs, generatePqcKeyPair, runPqcSimulation, getNistPqcStandards } from "../../services/PostQuantumCryptoService";
import { getHealthcareCtemInventory, initiateCtemDiscoveryScan, validateCtemExposure, getHealthcareCtemStandards } from "../../services/HealthcareCtemService";
import { getAllAccounts, registerCloudAccount, getAllFindings, ingestFinding, remediateFinding } from "../../services/CspmService";

describe("QkdKeyDistributionService", () => {
  it("getQkdNodes returns node list", async () => {
    const data = await getQkdNodes();
    expect(data).toHaveLength(1);
    expect(data[0].nodeStatus).toBe("QUANTUM_LINK_ESTABLISHED");
  });

  it("provisionQkdNode provisions a node", async () => {
    const result = await provisionQkdNode({ nodeName: "New Node" });
    expect(result.nodeId).toBe("QKD-NEW");
  });

  it("runQkdExchangeSimulation runs key exchange", async () => {
    const result = await runQkdExchangeSimulation("QKD-001");
    expect(result.eavesdropperDetected).toBe(false);
    expect(result.siftedKeyLengthBits).toBe(4096);
  });

  it("getQkdStandards returns standards", async () => {
    const data = await getQkdStandards();
    expect(data).toHaveLength(3);
    expect(data[0].standard).toContain("CNSA");
  });

  it("getQkdNodes falls back on error", async () => {
    server.use(http.get(`${BASE}/api/auth/qkd/nodes`, () => HttpResponse.error("fail")));
    const data = await getQkdNodes();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("provisionQkdNode falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/qkd/nodes`, () => HttpResponse.error("fail")));
    const result = await provisionQkdNode({});
    expect(result.nodeId).toContain("QKD-NODE-");
  });

  it("runQkdExchangeSimulation falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/qkd/nodes/:id/exchange-sim`, () => HttpResponse.error("fail")));
    const result = await runQkdExchangeSimulation("QKD-999");
    expect(result.eavesdropperDetected).toBe(false);
    expect(result.siftedKeyLengthBits).toBe(4096);
  });
});

describe("PostQuantumCryptoService", () => {
  it("getPqcKeyPairs returns key list", async () => {
    const data = await getPqcKeyPairs();
    expect(data).toHaveLength(1);
    expect(data[0].algorithm).toBe("Kyber-1024");
  });

  it("generatePqcKeyPair generates a key", async () => {
    const result = await generatePqcKeyPair({ keyAlias: "New Key" });
    expect(result.keyId).toBe("PQC-NEW");
    expect(result.status).toBe("ACTIVE_ENFORCED");
  });

  it("runPqcSimulation runs a simulation", async () => {
    const result = await runPqcSimulation("CRYSTALS-Kyber-1024", "test payload");
    expect(result.operationType).toBeDefined();
    expect(result.executionTimeMs).toBeDefined();
  });

  it("getNistPqcStandards returns standards", async () => {
    const data = await getNistPqcStandards();
    expect(data).toHaveLength(4);
    expect(data[0].name).toContain("Kyber");
    expect(data[3].status).toBe("PENDING_FIPS_PUB");
  });

  it("getPqcKeyPairs falls back on error", async () => {
    server.use(http.get(`${BASE}/api/auth/pqc/keys`, () => HttpResponse.error("fail")));
    const data = await getPqcKeyPairs();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].keyId).toBe("PQC-KEY-901");
  });

  it("generatePqcKeyPair falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/pqc/keys`, () => HttpResponse.error("fail")));
    const result = await generatePqcKeyPair({});
    expect(result.keyId).toContain("PQC-KEY-");
  });

  it("runPqcSimulation falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/pqc/simulate`, () => HttpResponse.error("fail")));
    const result = await runPqcSimulation("CRYSTALS-Kyber-1024", "data");
    expect(result.operationType).toBe("KEY_ENCAPSULATION_KEM");
  });
});

describe("HealthcareCtemService", () => {
  it("getHealthcareCtemInventory returns the asset list", async () => {
    const data = await getHealthcareCtemInventory();
    expect(data).toHaveLength(1);
    expect(data[0].assetName).toBe("Telehealth Portal");
  });

  it("initiateCtemDiscoveryScan starts a scan", async () => {
    const result = await initiateCtemDiscoveryScan({ assetName: "New Asset" });
    expect(result.assetId).toBe("CTEM-NEW");
  });

  it("validateCtemExposure validates an asset", async () => {
    const result = await validateCtemExposure("CTEM-001");
    expect(result.exploitabilityVerified).toBe(true);
    expect(result.remoteCodeExecutionPossible).toBe(false);
  });

  it("getHealthcareCtemStandards returns the standards list", async () => {
    // Served from a local constant, not the API, so it holds with the server down.
    const data = await getHealthcareCtemStandards();
    expect(data).toHaveLength(4);
    expect(data[0].standard).toContain("Gartner");
  });

  it("getHealthcareCtemInventory falls back on error", async () => {
    server.use(http.get(`${BASE}/api/auth/ctem/assets`, () => HttpResponse.error("fail")));
    const data = await getHealthcareCtemInventory();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].assetId).toContain("CTEM-ASSET-");
  });

  it("initiateCtemDiscoveryScan falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/ctem/scan`, () => HttpResponse.error("fail")));
    const result = await initiateCtemDiscoveryScan({ assetName: "Bedside Monitor" });
    expect(result.assetId).toContain("CTEM-ASSET-");
    // The fallback echoes the caller's name rather than inventing one.
    expect(result.assetName).toBe("Bedside Monitor");
  });

  it("validateCtemExposure falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/ctem/assets/:id/validate`, () => HttpResponse.error("fail")));
    const result = await validateCtemExposure("CTEM-001");
    expect(result.assetId).toBe("CTEM-001");
    expect(result.microsegmentationActive).toBe(true);
  });
});

describe("CspmService", () => {
  it("getAllAccounts returns connected cloud accounts", async () => {
    const data = await getAllAccounts();
    expect(data).toHaveLength(1);
    expect(data[0].provider).toBe("AWS");
  });

  it("registerCloudAccount registers an account", async () => {
    const result = await registerCloudAccount({ provider: "Azure" });
    expect(result.accountId).toBe("AZ-NEW");
    expect(result.status).toBe("CONNECTED");
  });

  it("getAllFindings returns findings", async () => {
    const data = await getAllFindings();
    expect(data).toHaveLength(1);
    expect(data[0].severity).toBe("HIGH");
  });

  it("ingestFinding ingests a finding", async () => {
    const result = await ingestFinding({ severity: "MEDIUM" });
    expect(result.findingId).toBe("FIND-NEW");
    expect(result.status).toBe("INGESTED");
  });

  it("remediateFinding remediates a finding", async () => {
    const result = await remediateFinding("FIND-001");
    expect(result.status).toBe("REMEDIATED");
  });
});
