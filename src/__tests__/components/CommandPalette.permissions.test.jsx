import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CommandPalette from "../../components/common/CommandPalette";
import Navbar from "../../components/common/Navbar";
import { AuthContext } from "../../context/AuthContext";
import { ThemeProvider } from "../../context/ThemeContext";

vi.mock("../../services/OrderService", () => ({
  getAllOrders: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../services/EventStreamService", () => ({
  getUnreadCounts: vi.fn().mockResolvedValue({ total: 0 }),
}));

/**
 * Permission gating in the palette (#24).
 *
 * There are four permission consumers in the app - AppRoutes, Navbar, RequirePermission and this
 * palette. The first three read the merged effective set; the palette read the raw authority list,
 * which is empty in three ordinary situations (a demo account, the window between sign-in and the
 * authority response, and an unreachable backend). So the navbar offered Equipment and the palette,
 * opened a second later, reported "No results for equipment".
 *
 * The parity test below is the one that matters: it renders the palette and the navbar against one
 * session and asserts they agree. A test that only checked the palette in isolation would pass
 * against a palette that listed everything, which is the other way to get this wrong.
 */

/** Exactly the context shape AuthProvider supplies, so the test cannot drift from the real one. */
function authValue({ user, permissions = [] }) {
  return {
    user,
    permissions,
    authorityState: { authorityVersion: 1, permissions },
    authorityVersion: 1,
    authorityLoading: false,
    revokedReason: null,
    clearRevokedReason: () => {},
    login: () => {},
    logout: () => {},
    // AuthContext's own predicate, reproduced verbatim: it reads the raw list.
    hasPermission: (name) => (!name ? true : permissions.includes(name)),
    refreshAuthority: () => Promise.resolve(),
  };
}

function renderPalette(value) {
  return render(
    <AuthContext.Provider value={value}>
      <ThemeProvider>
        <CommandPalette open onClose={() => {}} onNavigate={() => {}} />
      </ThemeProvider>
    </AuthContext.Provider>
  );
}

function renderNavbar(value) {
  return render(
    <AuthContext.Provider value={value}>
      <ThemeProvider>
        <Navbar onNavigate={() => {}} currentPage="dashboard" />
      </ThemeProvider>
    </AuthContext.Provider>
  );
}

/** The destinations the palette is currently offering, by label. */
const paletteLabels = () =>
  screen.queryAllByRole("option").map((node) => node.getAttribute("aria-label"));

const HOSPITAL_DEMO = { id: "demo-user", name: "Demo Hospital", role: "hospital" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("a demo account, whose authority list is never populated", () => {
  it("offers the permission-gated pages the navbar is offering", () => {
    // fetchUserAuthority returns early for "demo-user", so `permissions` is [] for the whole
    // session. The role matrix is what makes this session usable, and all four consumers have to
    // read it the same way.
    const value = authValue({ user: HOSPITAL_DEMO, permissions: [] });

    const { unmount } = renderNavbar(value);
    const navbarLinks = screen
      .queryAllByRole("button")
      .map((node) => node.textContent)
      .filter((text) => ["Equipment", "Maintenance", "PM Rules"].includes(text));
    expect(navbarLinks).toEqual(["Equipment", "Maintenance", "PM Rules"]);
    unmount();

    renderPalette(value);
    const labels = paletteLabels();
    expect(labels).toContain("Equipment");
    expect(labels).toContain("Maintenance Schedule");
    expect(labels).toContain("Preventive Maintenance Rules");
  });

  it("finds Equipment when the user searches for it", () => {
    // The user-visible symptom: typing the name of a page the navbar links to returned nothing,
    // which reads as a broken search rather than a permission decision.
    renderPalette(authValue({ user: HOSPITAL_DEMO, permissions: [] }));
    expect(screen.getByRole("option", { name: "Equipment" })).toBeInTheDocument();
    expect(screen.queryByText(/No results for/)).not.toBeInTheDocument();
  });

  it("offers a technician the maintenance pages their role matrix grants", () => {
    renderPalette(
      authValue({ user: { id: "demo-user", name: "Tech", role: "technician" }, permissions: [] })
    );
    const labels = paletteLabels();
    expect(labels).toContain("My Tasks");
    expect(labels).toContain("Equipment");
  });

  it("offers a supplier the order pages their role matrix grants", () => {
    renderPalette(
      authValue({ user: { id: "demo-user", name: "Sup", role: "supplier" }, permissions: [] })
    );
    expect(paletteLabels()).toContain("Orders");
  });
});

describe("a session waiting on the authority response", () => {
  it("does not blank out gated destinations before the fetch answers", () => {
    // permissions is [] for the few hundred milliseconds after sign-in, which is exactly when a
    // keyboard-first user reaches for Ctrl+K.
    renderPalette(
      authValue({ user: { id: "u1", name: "Ana", role: "hospital" }, permissions: [] })
    );
    expect(paletteLabels()).toContain("Equipment");
  });
});

describe("the server's list stays authoritative", () => {
  it("hides a destination whose permission the RBAC console revoked", () => {
    // A non-empty server list wins over the role matrix, so a revoked READ_EQUIPMENT really does
    // remove the destination. Without this the fix would just be "show everything".
    renderPalette(
      authValue({
        user: { id: "u1", name: "Ana", role: "hospital" },
        permissions: ["READ_MAINTENANCE", "READ_ORDERS"],
      })
    );
    const labels = paletteLabels();
    expect(labels).not.toContain("Equipment");
    expect(labels).not.toContain("Add Equipment");
    expect(labels).toContain("Maintenance Schedule");
  });

  it("agrees with the navbar about a revoked permission", () => {
    const value = authValue({
      user: { id: "u1", name: "Ana", role: "hospital" },
      permissions: ["READ_MAINTENANCE"],
    });

    const { unmount } = renderNavbar(value);
    const texts = screen.queryAllByRole("button").map((node) => node.textContent);
    expect(texts).not.toContain("Equipment");
    expect(texts).toContain("Maintenance");
    unmount();

    renderPalette(value);
    const labels = paletteLabels();
    expect(labels).not.toContain("Equipment");
    expect(labels).toContain("Maintenance Schedule");
  });
});

describe("role gating is unchanged", () => {
  it("keeps hospital-only consoles out of a technician's palette", () => {
    // Permission gating must not become a way around the role gate.
    renderPalette(
      authValue({ user: { id: "demo-user", name: "Tech", role: "technician" }, permissions: [] })
    );
    expect(paletteLabels()).not.toContain("Add Equipment");
  });

  it("offers a signed-out visitor public pages only", () => {
    renderPalette(authValue({ user: null, permissions: [] }));
    const labels = paletteLabels();
    expect(labels).toContain("Blog");
    expect(labels).not.toContain("Equipment");
    expect(labels).not.toContain("My Tasks");
  });
});
