import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Navbar from "../../components/common/Navbar";
import { AuthContext } from "../../context/AuthContext";
import { ThemeProvider } from "../../context/ThemeContext";
import { getRoute } from "../../routes/routeRegistry";

vi.mock("../../services/OrderService", () => ({
  getAllOrders: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../services/EventStreamService", () => ({
  getUnreadCounts: vi.fn().mockResolvedValue({ total: 0 }),
}));

/**
 * The technician links carried no `permission` field while the hospital and supplier links beside
 * them all did. filterNavLinks can only drop a link that declares one, so a revoked permission left
 * the menu entry in place and the click landed on Access Denied - which is the outcome the comment
 * directly above that block says the design prevents.
 */

function authValue({ user, permissions }) {
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
    hasPermission: (name) => (!name ? true : permissions.includes(name)),
    refreshAuthority: () => Promise.resolve(),
  };
}

function renderNavbar(value) {
  render(
    <AuthContext.Provider value={value}>
      <ThemeProvider>
        <Navbar onNavigate={() => {}} currentPage="dashboard" />
      </ThemeProvider>
    </AuthContext.Provider>
  );
}

const TECH = { id: "t1", name: "Sam Okafor", role: "technician" };
const labels = () => screen.queryAllByRole("button").map((node) => node.textContent);

beforeEach(() => { vi.clearAllMocks(); });

describe("technician navigation links", () => {
  it("shows both links when the role matrix grants their permissions", () => {
    // An empty server list falls back to the role matrix, which grants a technician both.
    renderNavbar(authValue({ user: TECH, permissions: [] }));
    expect(labels()).toContain("My Tasks");
    expect(labels()).toContain("Update Task");
  });

  it("drops Update Task when UPDATE_MAINTENANCE is revoked", () => {
    renderNavbar(
      authValue({ user: TECH, permissions: ["READ_EQUIPMENT", "READ_MAINTENANCE"] })
    );
    expect(labels()).toContain("My Tasks");
    expect(labels()).not.toContain("Update Task");
  });

  it("drops My Tasks when READ_MAINTENANCE is revoked", () => {
    renderNavbar(
      authValue({ user: TECH, permissions: ["READ_EQUIPMENT", "UPDATE_MAINTENANCE"] })
    );
    expect(labels()).not.toContain("My Tasks");
    expect(labels()).toContain("Update Task");
  });

  it("tags each link with the permission its route actually declares", () => {
    // The tag has to match the registry, or the menu and the router disagree about the same page.
    expect(getRoute("tasks").permission).toBe("READ_MAINTENANCE");
    expect(getRoute("update-task").permission).toBe("UPDATE_MAINTENANCE");
  });
});

describe("the other roles are unchanged", () => {
  it("still drops a supplier's order links when READ_ORDERS is revoked", () => {
    renderNavbar(
      authValue({ user: { id: "s1", name: "Devi", role: "supplier" }, permissions: ["SEND_INVOICE"] })
    );
    expect(labels()).not.toContain("Orders");
    expect(labels()).not.toContain("Order Status");
  });

  it("still shows a hospital admin their equipment links", () => {
    renderNavbar(
      authValue({ user: { id: "h1", name: "Ana", role: "hospital" }, permissions: [] })
    );
    expect(labels()).toContain("Equipment");
    expect(labels()).toContain("Maintenance");
  });
});
