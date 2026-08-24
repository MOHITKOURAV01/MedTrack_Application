import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE = "http://localhost:8081";

const jobs = [
  { jobId: "JOB-PHI-9021", datasetName: "EHR_Records.csv", recordCount: 45200, status: "COMPLETED" },
  { jobId: "JOB-PHI-9022", datasetName: "Oncology_Trials.json", recordCount: 12800, status: "COMPLETED" },
];

const server = setupServer(
  http.get(`${BASE}/api/auth/deidentification/jobs`, () => HttpResponse.json(jobs)),
  http.post(`${BASE}/api/auth/deidentification/jobs`, () => HttpResponse.json({ jobId: "JOB-PHI-NEW", status: "COMPLETED" })),
  http.post(`${BASE}/api/auth/deidentification/redact`, () =>
    HttpResponse.json({ originalText: "test", redactedText: "test", method: "SAFE_HARBOR_18", phiIdentifiersDetected: 0 })
  ),
);

beforeEach(() => sessionStorage.clear());
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import {
  getDeidentificationJobs,
  createDeidentificationJob,
  redactSampleText,
  getSafeHarborChecklist,
} from "../../services/HipaaDeidentificationService";

describe("HipaaDeidentificationService", () => {
  it("getDeidentificationJobs returns job list", async () => {
    const data = await getDeidentificationJobs();
    expect(data).toHaveLength(2);
    expect(data[0].jobId).toBe("JOB-PHI-9021");
  });

  it("createDeidentificationJob creates a new job", async () => {
    const result = await createDeidentificationJob({ datasetName: "Test.csv", recordCount: 1000 });
    expect(result.jobId).toBe("JOB-PHI-NEW");
    expect(result.status).toBe("COMPLETED");
  });

  it("redactSampleText redacts PHI identifiers", async () => {
    const result = await redactSampleText("Patient John Doe SSN 123-45-6789");
    expect(result.originalText).toBeDefined();
    expect(result.redactedText).toBeDefined();
    expect(result.method).toBe("SAFE_HARBOR_18");
  });

  it("getSafeHarborChecklist returns 18 PHI identifiers", async () => {
    const list = await getSafeHarborChecklist();
    expect(list).toHaveLength(18);
    expect(list[0].name).toContain("Names");
    expect(list[5].name).toContain("Social Security");
  });

  it("getDeidentificationJobs falls back on error", async () => {
    server.use(http.get(`${BASE}/api/auth/deidentification/jobs`, () => HttpResponse.error("fail")));
    const data = await getDeidentificationJobs();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("createDeidentificationJob falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/deidentification/jobs`, () => HttpResponse.error("fail")));
    const result = await createDeidentificationJob({ datasetName: "Fallback.csv" });
    expect(result.jobId).toContain("JOB-PHI-");
    expect(result.status).toBe("COMPLETED");
  });

  it("redactSampleText falls back to client-side regex on error", async () => {
    server.use(http.post(`${BASE}/api/auth/deidentification/redact`, () => HttpResponse.error("fail")));
    const result = await redactSampleText("Call 555-123-4567 or email test@example.com");
    expect(result.redactedText).toContain("[REDACTED-");
    expect(result.method).toBe("SAFE_HARBOR_18");
  });
});
