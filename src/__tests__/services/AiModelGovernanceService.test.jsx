import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE = "http://localhost:8081";

const server = setupServer(
  http.get(`${BASE}/api/auth/ai/models`, () =>
    HttpResponse.json([{ modelId: "AI-001", modelName: "Sepsis Predictor", status: "APPROVED" }])
  ),
  http.post(`${BASE}/api/auth/ai/models`, () =>
    HttpResponse.json({ modelId: "AI-NEW", status: "PENDING_AUDIT" })
  ),
  http.post(`${BASE}/api/auth/ai/models/:id/fairness-audit`, () =>
    HttpResponse.json({ disparateImpactRatio: 0.92, fourFifthsRuleStatus: "PASSED" })
  ),
);

beforeEach(() => sessionStorage.clear());
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import {
  getAiModels,
  registerAiModel,
  runFairnessAudit,
  getEuAiActCategories,
} from "../../services/AiModelGovernanceService";

describe("AiModelGovernanceService", () => {
  it("getAiModels returns model list", async () => {
    const data = await getAiModels();
    expect(data).toHaveLength(1);
    expect(data[0].modelName).toBe("Sepsis Predictor");
  });

  it("registerAiModel registers a new model", async () => {
    const result = await registerAiModel({ modelName: "New Model", framework: "PyTorch" });
    expect(result.modelId).toBe("AI-NEW");
  });

  it("runFairnessAudit returns audit results", async () => {
    const result = await runFairnessAudit("AI-001", "GENDER");
    expect(result.disparateImpactRatio).toBe(0.92);
    expect(result.fourFifthsRuleStatus).toBe("PASSED");
  });

  it("getEuAiActCategories returns risk tiers", async () => {
    const data = await getEuAiActCategories();
    expect(data).toHaveLength(4);
    expect(data[0].tier).toBe("UNACCEPTABLE_RISK");
    expect(data[1].tier).toBe("HIGH_RISK");
  });

  it("getAiModels falls back on error", async () => {
    server.use(http.get(`${BASE}/api/auth/ai/models`, () => HttpResponse.error("fail")));
    const data = await getAiModels();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].modelId).toBe("AI-MDL-701");
  });

  it("registerAiModel falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/ai/models`, () => HttpResponse.error("fail")));
    const result = await registerAiModel({ modelName: "Fallback Model" });
    expect(result.modelId).toContain("AI-MDL-");
    expect(result.status).toBe("PENDING_AUDIT");
  });

  it("runFairnessAudit falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/ai/models/:id/fairness-audit`, () => HttpResponse.error("fail")));
    const result = await runFairnessAudit("AI-999");
    expect(result.disparateImpactRatio).toBeDefined();
    expect(result.fourFifthsRuleStatus).toBe("PASSED_FAIRNESS_STANDARD");
  });
});
