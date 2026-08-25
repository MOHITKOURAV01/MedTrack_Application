/**
 * Timeout, retry, and the error shape a service's catch can branch on.
 *
 * The existing HttpService suite covers the auth interceptors and the 401/403 branches and
 * asserts nothing about time, which is part of why the instance shipped with axios's default
 * `timeout: 0` - no timeout at all - for as long as it did.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import API, {
  DEFAULT_TIMEOUT_MS,
  MAX_RETRIES,
  isTimeoutError,
  isNetworkError,
} from "../../services/HttpService";

const BASE_URL = "http://localhost:8081";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());

beforeEach(() => {
  sessionStorage.clear();
});

describe("the instance has a timeout at all", () => {
  it("carries a non-zero default", () => {
    // This is the whole bug in one assertion. `0` is axios's default and means "wait forever".
    expect(API.defaults.timeout).toBe(DEFAULT_TIMEOUT_MS);
    expect(API.defaults.timeout).toBeGreaterThan(0);
  });
});

describe("the timeout reaches the request", () => {
  // Note on what is and is not exercised end-to-end here. Under MSW's XHR interceptor in jsdom,
  // the `timeout` attribute is not implemented - a handler that delays 3s completes in 3s with
  // `timeout: 200` set and no error raised. That is a limitation of the test transport, not of
  // the change: axios applies `timeout` in the adapter, which MSW replaces. So the assertions
  // below are that the value is configured and that it reaches the per-request config, plus
  // direct coverage of the classification a real timeout produces.

  it("applies the default to a request that does not override it", async () => {
    let seen;
    const id = API.interceptors.request.use((config) => {
      seen = config.timeout;
      return config;
    });

    server.use(http.get(`${BASE_URL}/api/whatever`, () => HttpResponse.json({})));
    await API.get("/api/whatever");
    API.interceptors.request.eject(id);

    expect(seen).toBe(DEFAULT_TIMEOUT_MS);
  });

  it("lets a caller override it per request", async () => {
    // A bulk equipment import legitimately takes longer than a dashboard poll, so the default
    // has to be overridable rather than absolute.
    let seen;
    const id = API.interceptors.request.use((config) => {
      seen = config.timeout;
      return config;
    });

    server.use(http.post(`${BASE_URL}/api/auth/equipment/import`, () => HttpResponse.json({})));
    await API.post("/api/auth/equipment/import", {}, { timeout: 60000 });
    API.interceptors.request.eject(id);

    expect(seen).toBe(60000);
  });

  it("classifies the error axios raises on a timeout", () => {
    // The two shapes axios produces, across adapters.
    expect(isTimeoutError({ code: "ECONNABORTED", message: "timeout of 15000ms exceeded" })).toBe(true);
    expect(isTimeoutError({ code: "ETIMEDOUT", message: "" })).toBe(true);
    // A timeout never carries a response; a status does, so it is not one.
    expect(isTimeoutError({ code: "ECONNABORTED", response: { status: 504 } })).toBe(false);
  });
});

describe("retry, for idempotent methods only", () => {
  it("retries a GET through a transient 503 and returns the eventual success", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}/api/flaky`, () => {
        calls += 1;
        if (calls < 3) return HttpResponse.json(null, { status: 503 });
        return HttpResponse.json({ ok: true, calls });
      })
    );

    const response = await API.get("/api/flaky");

    expect(calls).toBe(3);
    expect(response.data.ok).toBe(true);
  }, 20000);

  it("gives up after MAX_RETRIES rather than retrying forever", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}/api/always-503`, () => {
        calls += 1;
        return HttpResponse.json(null, { status: 503 });
      })
    );

    await expect(API.get("/api/always-503")).rejects.toBeTruthy();

    // One initial attempt plus MAX_RETRIES.
    expect(calls).toBe(MAX_RETRIES + 1);
  }, 20000);

  it("retries a GET through a network error", async () => {
    // HttpResponse.error() is a genuine transport failure - ERR_NETWORK, no response - which is
    // the same branch a dropped socket or a DNS blip takes.
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}/api/dropped`, () => {
        calls += 1;
        if (calls < 2) return HttpResponse.error();
        return HttpResponse.json({ recovered: true });
      })
    );

    const response = await API.get("/api/dropped");

    expect(calls).toBe(2);
    expect(response.data.recovered).toBe(true);
  }, 20000);

  it("does NOT retry a POST", async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE_URL}/api/orders`, () => {
        calls += 1;
        return HttpResponse.json(null, { status: 503 });
      })
    );

    await expect(API.post("/api/orders", { qty: 1 })).rejects.toBeTruthy();

    // The reason this matters: a POST that timed out may already have been applied, with only
    // the response lost. Retrying it duplicates the order.
    expect(calls).toBe(1);
  }, 20000);

  it("does NOT retry a 4xx", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}/api/missing`, () => {
        calls += 1;
        return HttpResponse.json(null, { status: 404 });
      })
    );

    await expect(API.get("/api/missing")).rejects.toBeTruthy();

    // A 404 or a 400 will fail identically the second time - the request is what is wrong.
    expect(calls).toBe(1);
  }, 20000);

  it("does not retry once the caller's AbortSignal has fired", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}/api/cancelled`, async () => {
        calls += 1;
        return HttpResponse.json(null, { status: 503 });
      })
    );

    const controller = new AbortController();
    const promise = API.get("/api/cancelled", { signal: controller.signal });
    controller.abort();

    await promise.catch(() => {});

    expect(calls).toBeLessThanOrEqual(1);
  }, 20000);

  it("reports how many attempts were made", async () => {
    server.use(http.get(`${BASE_URL}/api/always-502`, () => HttpResponse.json(null, { status: 502 })));

    const error = await API.get("/api/always-502").then(() => null, (e) => e);

    expect(error.attempts).toBe(MAX_RETRIES + 1);
  }, 20000);

  it("a successful first attempt is not retried and not delayed", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}/api/fine`, () => {
        calls += 1;
        return HttpResponse.json({ ok: true });
      })
    );

    const started = Date.now();
    const response = await API.get("/api/fine");

    expect(calls).toBe(1);
    expect(response.data.ok).toBe(true);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe("error classification", () => {
  it("a refused request is neither a timeout nor a network error", async () => {
    server.use(http.get(`${BASE_URL}/api/forbidden-ish`, () => HttpResponse.json({ m: "no" }, { status: 400 })));

    const error = await API.get("/api/forbidden-ish").then(() => null, (e) => e);

    expect(isTimeoutError(error)).toBe(false);
    expect(isNetworkError(error)).toBe(false);
    expect(error.isTimeout).toBe(false);
    expect(error.isNetwork).toBe(false);
    // A caller can therefore tell "the backend said no" from "the backend was not there", which
    // is the difference between showing an error and showing fallback data.
    expect(error.response.status).toBe(400);
  }, 20000);

  it("the classifiers tolerate junk", () => {
    expect(isTimeoutError(null)).toBe(false);
    expect(isTimeoutError(undefined)).toBe(false);
    expect(isNetworkError(null)).toBe(false);
    expect(isTimeoutError({})).toBe(false);
  });
});
