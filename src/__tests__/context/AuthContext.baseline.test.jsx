import { render, act, waitFor } from "@testing-library/react";
import { useContext, useEffect } from "react";
import { it, expect, vi, beforeEach, describe } from "vitest";
import { AuthProvider, AuthContext } from "../../context/AuthContext";
import { getAuthorityVersion } from "../../services/AuthService";

vi.mock("../../services/AuthService", () => ({
  getAuthorityVersion: vi.fn(),
}));

/**
 * The authority version exists so an administrator can end live sessions, and the client enforces
 * that by revoking itself when the server reports a version above the one it holds.
 *
 * The bug in #22 was that "the one it holds" defaulted to the literal 1, which is a real version -
 * it is where every tenant starts - so a session that had never fetched could not tell "I have no
 * baseline" from "I hold version 1". Any tenant past version 1 therefore revoked every sign-in.
 *
 * These tests pin both halves: a first fetch establishes a baseline, and every fetch after it still
 * revokes. AuthContext.revocation.test.jsx covers the restored-session case and is deliberately left
 * untouched - it must keep passing exactly as written.
 */

function Consumer({ onMount }) {
  const ctx = useContext(AuthContext);
  useEffect(() => { onMount(ctx); }, [ctx, onMount]);
  return null;
}

/** Renders the provider and returns a live handle on its context value. */
function renderProvider() {
  const handle = { ctx: null };
  render(
    <AuthProvider>
      <Consumer onMount={(c) => { handle.ctx = c; }} />
    </AuthProvider>
  );
  return handle;
}

const HOSPITAL = { id: "u1", name: "Ana Reyes", role: "hospital", token: "tok" };

/** Lets the provider's effect fire and its promise settle. */
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe("first fetch of a new session", () => {
  it("adopts a tenant already past version 1 instead of revoking the sign-in", async () => {
    // The tenant has had "Invalidate active tokens" pressed six times. Nothing about that should
    // stop the next person signing in.
    getAuthorityVersion.mockResolvedValue({
      authorityVersion: 7,
      permissions: ["READ_EQUIPMENT", "READ_MAINTENANCE"],
      role: "hospital",
      active: true,
    });

    const handle = renderProvider();
    await act(async () => { handle.ctx.login(HOSPITAL); });
    await waitFor(() => expect(getAuthorityVersion).toHaveBeenCalledWith("u1"));
    await settle();

    expect(handle.ctx.user).toEqual(HOSPITAL);
    expect(handle.ctx.revokedReason).toBeNull();
    expect(handle.ctx.authorityVersion).toBe(7);
    expect(handle.ctx.permissions).toEqual(["READ_EQUIPMENT", "READ_MAINTENANCE"]);
  });

  it("persists the adopted version so the next page load has a real baseline", async () => {
    getAuthorityVersion.mockResolvedValue({
      authorityVersion: 7, permissions: [], role: "hospital", active: true,
    });

    const handle = renderProvider();
    await act(async () => { handle.ctx.login(HOSPITAL); });
    await waitFor(() => expect(getAuthorityVersion).toHaveBeenCalled());
    await settle();

    expect(JSON.parse(sessionStorage.getItem("medtrack_authority")).authorityVersion).toBe(7);
  });

  it("issues exactly one authority fetch for a sign-in", async () => {
    // login() used to fetch as well as the effect, so two requests raced for the same sign-in and
    // the loser could compare against a baseline the winner had only just established.
    getAuthorityVersion.mockResolvedValue({
      authorityVersion: 7, permissions: [], role: "hospital", active: true,
    });

    const handle = renderProvider();
    await act(async () => { handle.ctx.login(HOSPITAL); });
    await waitFor(() => expect(getAuthorityVersion).toHaveBeenCalled());
    await settle();

    expect(getAuthorityVersion).toHaveBeenCalledTimes(1);
    expect(handle.ctx.user).toEqual(HOSPITAL);
  });

  it("still signs in when the tenant is at version 1", async () => {
    getAuthorityVersion.mockResolvedValue({
      authorityVersion: 1, permissions: ["READ_EQUIPMENT"], role: "hospital", active: true,
    });

    const handle = renderProvider();
    await act(async () => { handle.ctx.login(HOSPITAL); });
    await waitFor(() => expect(getAuthorityVersion).toHaveBeenCalled());
    await settle();

    expect(handle.ctx.user).toEqual(HOSPITAL);
    expect(handle.ctx.revokedReason).toBeNull();
  });
});

describe("revocation after a baseline exists", () => {
  it("ends the session when a later poll reports a higher version", async () => {
    // Sign in against a tenant at 7, which becomes the baseline...
    getAuthorityVersion.mockResolvedValue({
      authorityVersion: 7, permissions: [], role: "hospital", active: true,
    });

    const handle = renderProvider();
    await act(async () => { handle.ctx.login(HOSPITAL); });
    await waitFor(() => expect(handle.ctx.authorityVersion).toBe(7));

    // ...then an administrator revokes. The very next poll must end the session.
    getAuthorityVersion.mockResolvedValue({
      authorityVersion: 8, permissions: [], role: "hospital", active: true,
    });
    await act(async () => { await handle.ctx.refreshAuthority(); });

    expect(handle.ctx.user).toBeNull();
    expect(handle.ctx.revokedReason).toContain("administrator");
    expect(sessionStorage.getItem("medtrack_user")).toBeNull();
  });

  it("does not revoke when the version is unchanged", async () => {
    getAuthorityVersion.mockResolvedValue({
      authorityVersion: 7, permissions: [], role: "hospital", active: true,
    });

    const handle = renderProvider();
    await act(async () => { handle.ctx.login(HOSPITAL); });
    await waitFor(() => expect(handle.ctx.authorityVersion).toBe(7));

    await act(async () => { await handle.ctx.refreshAuthority(); });
    await act(async () => { await handle.ctx.refreshAuthority(); });

    expect(handle.ctx.user).toEqual(HOSPITAL);
    expect(handle.ctx.revokedReason).toBeNull();
  });

  it("does not revoke when the server reports a lower version", async () => {
    // A counter that went backwards is a rolled-back tenant, not a revocation. Ending sessions over
    // it would be a denial of service rather than a control.
    getAuthorityVersion.mockResolvedValue({
      authorityVersion: 7, permissions: [], role: "hospital", active: true,
    });

    const handle = renderProvider();
    await act(async () => { handle.ctx.login(HOSPITAL); });
    await waitFor(() => expect(handle.ctx.authorityVersion).toBe(7));

    getAuthorityVersion.mockResolvedValue({
      authorityVersion: 4, permissions: [], role: "hospital", active: true,
    });
    await act(async () => { await handle.ctx.refreshAuthority(); });

    expect(handle.ctx.user).toEqual(HOSPITAL);
    expect(handle.ctx.authorityVersion).toBe(4);
  });
});

describe("switching accounts", () => {
  it("does not carry one user's version over to the next sign-in", async () => {
    // Sign in as a user on a tenant at 12.
    getAuthorityVersion.mockResolvedValue({
      authorityVersion: 12, permissions: [], role: "hospital", active: true,
    });

    const handle = renderProvider();
    await act(async () => { handle.ctx.login(HOSPITAL); });
    await waitFor(() => expect(handle.ctx.authorityVersion).toBe(12));

    await act(async () => { handle.ctx.logout(); });
    expect(handle.ctx.user).toBeNull();

    // A different account on a tenant at 30. Inheriting 12 as a baseline would revoke it on sight.
    getAuthorityVersion.mockResolvedValue({
      authorityVersion: 30, permissions: ["READ_ORDERS"], role: "supplier", active: true,
    });
    const SUPPLIER = { id: "u2", name: "Devi Shah", role: "supplier", token: "tok2" };
    await act(async () => { handle.ctx.login(SUPPLIER); });
    await waitFor(() => expect(getAuthorityVersion).toHaveBeenCalledWith("u2"));
    await settle();

    expect(handle.ctx.user).toEqual(SUPPLIER);
    expect(handle.ctx.revokedReason).toBeNull();
    expect(handle.ctx.authorityVersion).toBe(30);
  });

  it("clears the stored authority entry on sign-out", async () => {
    getAuthorityVersion.mockResolvedValue({
      authorityVersion: 12, permissions: [], role: "hospital", active: true,
    });

    const handle = renderProvider();
    await act(async () => { handle.ctx.login(HOSPITAL); });
    await waitFor(() => expect(handle.ctx.authorityVersion).toBe(12));

    await act(async () => { handle.ctx.logout("bye"); });

    expect(sessionStorage.getItem("medtrack_authority")).toBeNull();
    expect(handle.ctx.authorityVersion).toBe(1);
  });
});

describe("sessions that never fetch", () => {
  it("leaves a demo account signed in", async () => {
    // fetchUserAuthority returns early for "demo-user", so no baseline is ever established. That
    // must be a session that simply never revokes, not one that revokes on a placeholder.
    const handle = renderProvider();
    await act(async () => {
      handle.ctx.login({ id: "demo-user", name: "Demo", role: "hospital" });
    });
    await settle();

    expect(getAuthorityVersion).not.toHaveBeenCalled();
    expect(handle.ctx.user.id).toBe("demo-user");
    expect(handle.ctx.revokedReason).toBeNull();
  });

  it("keeps the session when the authority endpoint fails", async () => {
    getAuthorityVersion.mockRejectedValue(new Error("backend unreachable"));

    const handle = renderProvider();
    await act(async () => { handle.ctx.login(HOSPITAL); });
    await waitFor(() => expect(getAuthorityVersion).toHaveBeenCalled());
    await settle();

    expect(handle.ctx.user).toEqual(HOSPITAL);
    expect(handle.ctx.revokedReason).toBeNull();
  });
});
