// Tests for the page directory, the navbar console menu and the palette labels it feeds.
//
// Why this file exists
// --------------------
// Thirty-four clinical and operational consoles were registered routes with no entry anywhere in the
// navigation. The navbar carried six links for a hospital admin, two for a technician and two for a
// supplier, and not one of them was a console; the only way to open the blood bank, the cath lab, the
// NICU or sterile processing was to know the URL and type it.
//
// The command palette did index every route automatically, which is what kept them nominally
// reachable, but it fell back to `humanize(page)` for the fifty pages with no entry in its label map.
// That fallback produces "Icu Telemetry Overwatch" and supplies no keywords at all, so the palette
// could not find the blood bank from "transfusion", cold chain from "freezer", or dialysis from
// "renal" - it only matched the string you would have had to know already.
//
// Two things need guarding, and neither is about how the menu looks.
//
//   1. Every registered page has a real label. The `humanize` fallback stays in the palette as a
//      safety net, but nothing should reach it - and a new console added without a label reaches it
//      silently, which is precisely how fifty of them accumulated.
//
//   2. Every page key named by the directory is a registered route. A key that drifts renders a menu
//      item pointing at the 404 page, and a menu item that 404s is worse than no menu item.

import { screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { renderWithProviders } from "../utils/renderWithProviders";
import Navbar from "../../components/common/Navbar";
import { PAGE_LABELS, CONSOLE_GROUPS, CONSOLE_PAGES } from "../../components/common/pageDirectory";
import { ROUTES, getRoute, checkAccess } from "../../routes/routeRegistry";

/** Mirrors the palette's exclusion set: auth screens and the 404 page are never destinations. */
const EXCLUDED_PAGES = new Set([
  "login",
  "register",
  "forgot-password",
  "verify-otp",
  "reset-password",
  "not-found",
]);

const addressablePages = ROUTES.filter(
  (route) => !EXCLUDED_PAGES.has(route.page) && !route.param
);

describe("PAGE_LABELS", () => {
  it("names every page a user can navigate to", () => {
    // The regression, stated directly. Fifty registered pages had no entry and fell through to a
    // humanised key with no keywords.
    const unlabelled = addressablePages
      .map((route) => route.page)
      .filter((page) => !PAGE_LABELS[page]);

    expect(unlabelled).toEqual([]);
  });

  it("gives every entry a non-empty label", () => {
    const empty = Object.entries(PAGE_LABELS)
      .filter(([, meta]) => !meta.label || meta.label.trim() === "")
      .map(([page]) => page);

    expect(empty).toEqual([]);
  });

  it("does not label a page that is not registered", () => {
    // The mirror of the first test. A stale entry is harmless in the palette, which indexes ROUTES,
    // but it is a menu item pointing at the 404 page as soon as the directory feeds the navbar.
    const stale = Object.keys(PAGE_LABELS).filter((page) => !getRoute(page));
    expect(stale).toEqual([]);
  });

  it("gives every clinical console search keywords that are not just its own name", () => {
    // A label alone only matches what the user already knows the console is called. The keywords are
    // the terms a clinician or a biomed would actually type.
    for (const page of CONSOLE_PAGES) {
      const meta = PAGE_LABELS[page];
      expect(meta, `label for ${page}`).toBeTruthy();
      expect(meta.keywords, `keywords for ${page}`).toBeTruthy();
      expect(meta.keywords.split(/\s+/).length, `keyword count for ${page}`).toBeGreaterThan(2);
    }
  });

  it("can be found by the vocabulary a clinician would use", () => {
    // Spot checks on the searches that returned nothing before. The palette scores against
    // `${keywords} ${page}`, so these are the strings that have to be present.
    const haystack = (page) => `${PAGE_LABELS[page].keywords} ${page}`.toLowerCase();

    expect(haystack("blood-bank-transfusion")).toContain("crossmatch");
    expect(haystack("cold-chain")).toContain("freezer");
    expect(haystack("dialysis-renal")).toContain("ktv");
    expect(haystack("sterile-processing")).toContain("autoclave");
    expect(haystack("cardiology-cath-lab")).toContain("stent");
    expect(haystack("oncology-infusion")).toContain("chemotherapy");
    expect(haystack("emergency-triage")).toContain("ambulance");
    expect(haystack("radiology-imaging")).toContain("dicom");
  });
});

describe("CONSOLE_GROUPS", () => {
  it("names only registered routes", () => {
    const unregistered = CONSOLE_PAGES.filter((page) => !getRoute(page));
    expect(unregistered).toEqual([]);
  });

  it("lists no console twice", () => {
    expect(new Set(CONSOLE_PAGES).size).toBe(CONSOLE_PAGES.length);
  });

  it("gives every group an id, a label and at least one console", () => {
    for (const group of CONSOLE_GROUPS) {
      expect(group.id, "group id").toBeTruthy();
      expect(group.label, `label for ${group.id}`).toBeTruthy();
      expect(group.pages.length, `pages in ${group.id}`).toBeGreaterThan(0);
    }
    expect(new Set(CONSOLE_GROUPS.map((g) => g.id)).size).toBe(CONSOLE_GROUPS.length);
  });

  it("lists only consoles a signed-in user can actually open", () => {
    // Every console in the menu is AUTHENTICATED rather than role-scoped, so a technician sees the
    // same set as a hospital admin. If one is ever tightened, the navbar filters it out per session -
    // this asserts the current state so a change to either is visible.
    const technician = { role: "technician" };
    const denied = CONSOLE_PAGES.filter((page) => !checkAccess(technician, page).allowed);
    expect(denied).toEqual([]);
  });

  it("excludes the enterprise security consoles", () => {
    // Twenty-eight of them, hospital-admin only, and they already have their own hub. Putting them in
    // the menu would triple its length for an audience of one role.
    expect(CONSOLE_PAGES).not.toContain("pam");
    expect(CONSOLE_PAGES).not.toContain("siem-analytics");
    expect(CONSOLE_PAGES).not.toContain("sbom");
    // The hub itself is in, because it is the way to the rest of them.
    expect(CONSOLE_PAGES).toContain("security-compliance");
  });
});

describe("Navbar console menu", () => {
  const signedIn = { role: "hospital", name: "A. Rahman" };

  it("is not rendered for an anonymous visitor", () => {
    // Every console is authenticated, so an anonymous visitor would see a menu whose every entry
    // bounces to the login screen.
    renderWithProviders(<Navbar onNavigate={() => {}} currentPage="landing" />, {
      authValue: { user: null },
    });

    expect(screen.queryByRole("button", { name: "Consoles" })).not.toBeInTheDocument();
  });

  it("is rendered for a signed-in user and starts closed", () => {
    renderWithProviders(<Navbar onNavigate={() => {}} currentPage="dashboard" />, {
      authValue: { user: signedIn },
    });

    expect(screen.getByRole("button", { name: "Consoles" })).toBeInTheDocument();
    expect(screen.queryByRole("menu", { name: "Clinical consoles" })).not.toBeInTheDocument();
  });

  it("opens to every group and every console", () => {
    renderWithProviders(<Navbar onNavigate={() => {}} currentPage="dashboard" />, {
      authValue: { user: signedIn },
    });

    fireEvent.click(screen.getByRole("button", { name: "Consoles" }));

    const menu = screen.getByRole("menu", { name: "Clinical consoles" });
    for (const group of CONSOLE_GROUPS) {
      expect(within(menu).getByText(group.label), `group ${group.id}`).toBeInTheDocument();
    }
    for (const page of CONSOLE_PAGES) {
      expect(
        within(menu).getByRole("menuitem", { name: PAGE_LABELS[page].label }),
        `console ${page}`
      ).toBeInTheDocument();
    }
  });

  it("navigates to the console that was chosen and closes", () => {
    const navigated = [];
    renderWithProviders(
      <Navbar onNavigate={(page) => navigated.push(page)} currentPage="dashboard" />,
      { authValue: { user: signedIn } }
    );

    fireEvent.click(screen.getByRole("button", { name: "Consoles" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Transfusion Medicine" }));

    expect(navigated).toEqual(["blood-bank-transfusion"]);
    expect(screen.queryByRole("menu", { name: "Clinical consoles" })).not.toBeInTheDocument();
  });

  it("closes again when the trigger is pressed a second time", () => {
    renderWithProviders(<Navbar onNavigate={() => {}} currentPage="dashboard" />, {
      authValue: { user: signedIn },
    });

    const trigger = screen.getByRole("button", { name: "Consoles" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu", { name: "Clinical consoles" })).not.toBeInTheDocument();
  });

  it("marks the console currently on screen", () => {
    renderWithProviders(<Navbar onNavigate={() => {}} currentPage="dialysis-renal" />, {
      authValue: { user: signedIn },
    });

    fireEvent.click(screen.getByRole("button", { name: "Consoles" }));

    const current = screen.getByRole("menuitem", { name: "Dialysis & Renal Replacement" });
    expect(current.className).toContain("text-blue-600");
  });

  it("offers the same consoles to a technician", () => {
    // The menu is filtered per session through checkAccess, so this is a real assertion about the
    // access model rather than about the markup.
    renderWithProviders(<Navbar onNavigate={() => {}} currentPage="tasks" />, {
      authValue: { user: { role: "technician" } },
    });

    fireEvent.click(screen.getByRole("button", { name: "Consoles" }));

    const menu = screen.getByRole("menu", { name: "Clinical consoles" });
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(CONSOLE_PAGES.length);
  });
});
