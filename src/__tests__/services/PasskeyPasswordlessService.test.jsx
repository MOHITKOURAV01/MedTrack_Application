import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const BASE = "http://localhost:8081";

const server = setupServer(
  http.get(`${BASE}/api/auth/passkeys`, () =>
    HttpResponse.json([{ id: "key_001", friendlyName: "YubiKey 5 NFC", status: "ACTIVE" }])
  ),
  http.get(`${BASE}/api/auth/passkeys/policy`, () =>
    HttpResponse.json({ enforcePasswordlessForAdmins: true, timeoutSeconds: 60 })
  ),
  http.post(`${BASE}/api/auth/passkeys/register/options`, () =>
    HttpResponse.json({ success: true, challenge: "mock_challenge" })
  ),
  http.delete(`${BASE}/api/auth/passkeys/:id`, () =>
    HttpResponse.json({ success: true })
  ),
  http.put(`${BASE}/api/auth/passkeys/policy`, () =>
    HttpResponse.json({ success: true, message: "Policy updated" })
  ),
);

beforeEach(() => sessionStorage.clear());
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import {
  getRegisteredPasskeys,
  getPasskeyPolicySettings,
  initiatePasskeyRegistration,
  revokePasskey,
  updatePasskeyPolicy,
} from "../../services/PasskeyPasswordlessService";

describe("PasskeyPasswordlessService", () => {
  it("getRegisteredPasskeys returns passkey list", async () => {
    const data = await getRegisteredPasskeys();
    expect(data).toHaveLength(1);
    expect(data[0].friendlyName).toBe("YubiKey 5 NFC");
  });

  it("getPasskeyPolicySettings returns policy", async () => {
    const data = await getPasskeyPolicySettings();
    expect(data.enforcePasswordlessForAdmins).toBe(true);
    expect(data.timeoutSeconds).toBe(60);
  });

  it("initiatePasskeyRegistration returns challenge", async () => {
    const result = await initiatePasskeyRegistration("My YubiKey");
    expect(result.success).toBe(true);
    expect(result.challenge).toBeDefined();
  });

  it("revokePasskey removes a passkey", async () => {
    const result = await revokePasskey("key_001");
    expect(result.success).toBe(true);
  });

  it("updatePasskeyPolicy updates policy settings", async () => {
    const result = await updatePasskeyPolicy({ timeoutSeconds: 120 });
    expect(result.success).toBe(true);
  });

  it("getRegisteredPasskeys falls back on error", async () => {
    server.use(http.get(`${BASE}/api/auth/passkeys`, () => HttpResponse.error("fail")));
    const data = await getRegisteredPasskeys();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("getPasskeyPolicySettings falls back on error", async () => {
    server.use(http.get(`${BASE}/api/auth/passkeys/policy`, () => HttpResponse.error("fail")));
    const data = await getPasskeyPolicySettings();
    expect(data.enforcePasswordlessForAdmins).toBe(true);
  });

  it("initiatePasskeyRegistration falls back on error", async () => {
    server.use(http.post(`${BASE}/api/auth/passkeys/register/options`, () => HttpResponse.error("fail")));
    const result = await initiatePasskeyRegistration();
    expect(result.success).toBe(true);
    expect(result.challenge).toContain("mock_webauthn");
  });

  it("revokePasskey falls back on error", async () => {
    server.use(http.delete(`${BASE}/api/auth/passkeys/:id`, () => HttpResponse.error("fail")));
    const result = await revokePasskey("key_999");
    expect(result.success).toBe(true);
    expect(result.message).toContain("key_999");
  });

  it("updatePasskeyPolicy falls back on error", async () => {
    server.use(http.put(`${BASE}/api/auth/passkeys/policy`, () => HttpResponse.error("fail")));
    const result = await updatePasskeyPolicy({ enforcePasswordlessForAdmins: true });
    expect(result.success).toBe(true);
    expect(result.message).toContain("updated");
  });
});
