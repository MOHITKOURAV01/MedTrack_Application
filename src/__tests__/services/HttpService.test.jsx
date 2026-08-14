import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE_URL = "http://localhost:8081";

const server = setupServer(
  http.get(`${BASE_URL}/api/test`, () => HttpResponse.json({ ok: true })),
);

const mockAlert = vi.fn();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("alert", mockAlert);
  // pathname matters: the interceptor mirrors App.jsx's base-path handling and reads
  // window.location.pathname to decide whether the app is served from BASE_PATH. The stub used to
  // carry href alone, so pathname was undefined, the base resolved to "" and the redirect assertion
  // below could never hold - that test has been red since it was written.
  vi.stubGlobal("location", {
    href: "http://localhost:8081",
    pathname: "/MedTrack_Application/dashboard",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function getInterceptorBehavior() {
  return await import("../../services/HttpService");
}

it("attaches JWT Bearer token from sessionStorage", async () => {
  sessionStorage.setItem("medtrack_user", JSON.stringify({
    id: "u1", token: "my-jwt-token",
  }));

  const { default: API } = await getInterceptorBehavior();

  let capturedHeaders;
  server.use(
    http.get(`${BASE_URL}/api/test`, ({ request }) => {
      capturedHeaders = request.headers;
      return HttpResponse.json({ ok: true });
    }),
  );

  await API.get("/api/test");
  expect(capturedHeaders.get("Authorization")).toBe("Bearer my-jwt-token");
});

it("handles 401 by clearing sessionStorage, toasting and redirecting under the base path", async () => {
  sessionStorage.setItem("medtrack_user", JSON.stringify({ id: "u1", token: "tok" }));

  const { default: API, errorEmitter } = await getInterceptorBehavior();
  const dispatchSpy = vi.spyOn(errorEmitter, "dispatchEvent");
  // errorEmitter is a module singleton and the module is cached across tests in this file,
  // so the spy carries calls from earlier tests unless it is reset here.
  dispatchSpy.mockClear();

  server.use(
    http.get(`${BASE_URL}/api/test`, () => HttpResponse.json(null, { status: 401 })),
  );

  await expect(API.get("/api/test")).rejects.toThrow();

  expect(sessionStorage.getItem("medtrack_user")).toBeNull();
  expect(dispatchSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      detail: { message: "Session expired. Please login again.", type: "error" },
    }),
  );
  expect(window.location.href).toBe("/MedTrack_Application/login");
});

it("handles 403 with a toast and without redirect", async () => {
  sessionStorage.setItem("medtrack_user", JSON.stringify({ id: "u1", token: "tok" }));

  const { default: API, errorEmitter } = await getInterceptorBehavior();
  const dispatchSpy = vi.spyOn(errorEmitter, "dispatchEvent");
  // errorEmitter is a module singleton and the module is cached across tests in this file,
  // so the spy carries calls from earlier tests unless it is reset here.
  dispatchSpy.mockClear();

  server.use(
    http.get(`${BASE_URL}/api/test`, () => HttpResponse.json(null, { status: 403 })),
  );

  await expect(API.get("/api/test")).rejects.toThrow();

  expect(sessionStorage.getItem("medtrack_user")).not.toBeNull();
  expect(dispatchSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      detail: { message: "Access denied: You are not authorised to perform this action.", type: "error" },
    }),
  );
  expect(window.location.href).toBe("http://localhost:8081");
});

it("does not attach token when no user in sessionStorage", async () => {
  const { default: API } = await getInterceptorBehavior();

  let capturedHeaders;
  server.use(
    http.get(`${BASE_URL}/api/test`, ({ request }) => {
      capturedHeaders = request.headers;
      return HttpResponse.json({ ok: true });
    }),
  );

  await API.get("/api/test");
  expect(capturedHeaders.get("Authorization")).toBeNull();
});

it("clears the cached authority alongside the user on a session 401", async () => {
  sessionStorage.setItem("medtrack_user", JSON.stringify({ id: "u1", token: "tok" }));
  sessionStorage.setItem(
    "medtrack_authority",
    JSON.stringify({ authorityVersion: 4, permissions: ["EQUIPMENT_DELETE"] }),
  );

  const { default: API } = await getInterceptorBehavior();

  server.use(
    http.get(`${BASE_URL}/api/test`, () => HttpResponse.json(null, { status: 401 })),
  );

  await expect(API.get("/api/test")).rejects.toThrow();

  // AuthProvider seeds its permission state from this key on mount, so a leftover entry hands the
  // next person to sign in on this tab the previous user's permissions until the first poll returns.
  expect(sessionStorage.getItem("medtrack_authority")).toBeNull();
});

// ---------------------------------------------------------------------------
// A 401 from an unauthenticated auth endpoint is a rejected credential, not an
// expired session. Both are 401; only one of them means "you have been signed out".
// ---------------------------------------------------------------------------

describe.each([
  ["/api/auth/login", "a wrong password"],
  ["/api/auth/register", "an email already taken"],
  ["/api/auth/forgot-password", "an unrecognised email"],
  ["/api/auth/verify-otp", "a wrong OTP"],
  ["/api/auth/reset-password", "an expired reset token"],
])("a 401 from %s", (path, scenario) => {
  beforeEach(() => {
    server.use(
      http.post(`${BASE_URL}${path}`, () =>
        HttpResponse.json({ message: "Invalid credentials" }, { status: 401 }),
      ),
    );
  });

  it(`does not redirect the page away from the form (${scenario})`, async () => {
    const { default: API } = await getInterceptorBehavior();

    await expect(API.post(path, {})).rejects.toThrow();

    // The regression: window.location.href is a full document navigation, so it destroyed the
    // error message the form had just rendered.
    expect(window.location.href).toBe("http://localhost:8081");
  });

  it("does not announce an expired session", async () => {
    const { default: API, errorEmitter } = await getInterceptorBehavior();
    const dispatchSpy = vi.spyOn(errorEmitter, "dispatchEvent");
    // errorEmitter is a module singleton and the module is cached across tests in this file,
    // so the spy carries calls from earlier tests unless it is reset here.
    dispatchSpy.mockClear();

    await expect(API.post(path, {})).rejects.toThrow();

    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("leaves any existing session untouched", async () => {
    sessionStorage.setItem("medtrack_user", JSON.stringify({ id: "u1", token: "tok" }));
    sessionStorage.setItem("medtrack_authority", JSON.stringify({ authorityVersion: 2 }));

    const { default: API } = await getInterceptorBehavior();

    await expect(API.post(path, {})).rejects.toThrow();

    expect(sessionStorage.getItem("medtrack_user")).not.toBeNull();
    expect(sessionStorage.getItem("medtrack_authority")).not.toBeNull();
  });

  it("propagates the server's reason so the form can display it", async () => {
    const { default: API } = await getInterceptorBehavior();

    // This is exactly what LoginPage reads:
    //   setError(err.response.data.message || "Invalid credentials.")
    await expect(API.post(path, {})).rejects.toMatchObject({
      response: { status: 401, data: { message: "Invalid credentials" } },
    });
  });
});

it("still treats a 401 from an authenticated auth endpoint as an expired session", async () => {
  sessionStorage.setItem("medtrack_user", JSON.stringify({ id: "u1", token: "tok" }));

  const { default: API, errorEmitter } = await getInterceptorBehavior();
  const dispatchSpy = vi.spyOn(errorEmitter, "dispatchEvent");
  // errorEmitter is a module singleton and the module is cached across tests in this file,
  // so the spy carries calls from earlier tests unless it is reset here.
  dispatchSpy.mockClear();

  // The authority endpoints sit under /api/auth but are only reachable with a session, so a 401
  // there really does mean the session has gone - an administrator revoking it, for instance.
  server.use(
    http.get(`${BASE_URL}/api/auth/authority/version/u1`, () =>
      HttpResponse.json(null, { status: 401 }),
    ),
  );

  await expect(API.get("/api/auth/authority/version/u1")).rejects.toThrow();

  expect(sessionStorage.getItem("medtrack_user")).toBeNull();
  expect(dispatchSpy).toHaveBeenCalled();
  expect(window.location.href).toBe("/MedTrack_Application/login");
});

it("matches the auth paths on the path alone, ignoring any query string", async () => {
  const { default: API } = await getInterceptorBehavior();

  server.use(
    http.post(`${BASE_URL}/api/auth/login`, () => HttpResponse.json(null, { status: 401 })),
  );

  await expect(API.post("/api/auth/login?redirect=%2Fdashboard", {})).rejects.toThrow();

  expect(window.location.href).toBe("http://localhost:8081");
});

it("does not exempt an unrelated path that merely starts the same way", async () => {
  sessionStorage.setItem("medtrack_user", JSON.stringify({ id: "u1", token: "tok" }));

  const { default: API } = await getInterceptorBehavior();

  server.use(
    http.get(`${BASE_URL}/api/auth/login-history`, () => HttpResponse.json(null, { status: 401 })),
  );

  await expect(API.get("/api/auth/login-history")).rejects.toThrow();

  // Prefix matching would have exempted this; the comparison is an exact one.
  expect(sessionStorage.getItem("medtrack_user")).toBeNull();
});
