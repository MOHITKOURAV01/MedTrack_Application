// Regression suite for the invariants of src/routes/routeRegistry.js.
//
// Why this file exists
// --------------------
// The registry is the single source of truth for SPA routing, and every one of the four defects
// below reached `main` at least once:
//
//   1. `const BiomedicalAiGovernancePage = ...` was written twice in the same module scope. That is
//      a hard SyntaxError, not a warning: the module never evaluated, so `npm run build` produced
//      no bundle and twenty-two of the thirty-seven test files failed at import time with
//      "Identifier 'BiomedicalAiGovernancePage' has already been declared" before a single
//      assertion ran. The suite was red for reasons that had nothing to do with the code under
//      test, which is the worst possible failure mode for a test suite.
//
//   2. Six page keys - quantum-kms, confidential-compute, ctem, clinical-ai,
//      biomedical-ai-governance and a second confidential-compute/ctem pair - were declared two or
//      three times over, each declaration carrying a *different* secondary slug. PAGE_TO_ROUTE is
//      built with a reduce that overwrites, so the last declaration silently won; SLUG_TO_PAGE is
//      built the same way, so /enclaves, /ctem-hub and /kms-vault resolved to whichever entry came
//      last rather than being unreachable in an obvious way. Nothing about that is visible at a
//      glance in a 130-entry array.
//
//   3. Two page keys - icu-vitals-telemetry and icu-vitals - rendered the same component from four
//      slugs across two entries, so the "canonical slug" that buildPath() returns depended on which
//      of the two keys a caller happened to use.
//
//   4. Nine finished hub consoles (regulatory audit, pharmacovigilance, surgical robotics, lab
//      automation, pediatric NICU, medication supply, telehealth monitoring, genomic trials,
//      hospital command orchestration) existed as page components under src/pages/ with no registry
//      entry at all. They were linked from navigation and rendered the 404 page.
//
// scripts/check-routes.js already catches (2), (3) and (4) from `prebuild`, and check-syntax.js
// catches (1). Both are static scans that run outside the test suite, which means a contributor
// running `npm test` locally gets a green tick on a registry that cannot be built. These tests
// close that gap: they exercise the *evaluated* module, so they also cover the resolution
// behaviour - resolvePath, buildPath, checkAccess, resolveEffectivePage - that a static scan
// cannot reach.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, it, expect, afterEach } from "vitest";

import {
  ROUTES,
  SLUG_TO_PAGE,
  PAGE_TO_ROUTE,
  BASE_PATH,
  PUBLIC,
  AUTHENTICATED,
  getRoute,
  hasChrome,
  resolvePath,
  buildPath,
  buildHref,
  checkAccess,
  resolveEffectivePage,
} from "../../routes/routeRegistry";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..", "..", "..");
const registryPath = path.join(projectRoot, "src", "routes", "routeRegistry.js");
const pagesRoot = path.join(projectRoot, "src", "pages");

const registrySource = fs.readFileSync(registryPath, "utf8");

/**
 * Page components under src/pages/ that intentionally have no route.
 *
 * Mirrors UNROUTED_PAGES in scripts/check-routes.js. Duplicated deliberately rather than imported:
 * that file is CommonJS and is executed by `prebuild` with no bundler in front of it, and importing
 * it here would couple a test to the module system of a build script. The reachability test below
 * asserts the two lists agree, so the duplication cannot drift silently.
 */
const UNROUTED_PAGES = [
  "ActivityCenter",
  "InvoiceModal",
  "HelpPage",
  "CookiePage",
  "ReceivingScreen",
  "SparePartsCatalog",
  "RfqQuoteComparison",
  "DuplicateDetection",
  "ProcurementLifecycleTimeline",
  "BioAiDiagnosticsGenomicHub",
  "CardiovascularHemodynamicsOverwatchPage",
  "EmergencyTriageDisasterCommandPage",
  "ContinuousDialysisAkiOverwatchPage",
  "NeuroCriticalCareIcpOverwatchPage",
  "PrecisionGenomicOncologyOverwatchPage",
  "PrecisionOncologyMolecularHub",
  "PediatricIcuHfovCommandHub",
  "PediatricIcuOverwatchHub",
];

/** Every *.jsx page component on disk, excluding test files. */
function collectPageComponents(directory = pagesRoot, relative = "src/pages") {
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectPageComponents(absolute, `${relative}/${entry.name}`));
    } else if (entry.isFile() && entry.name.endsWith(".jsx") && !entry.name.endsWith(".test.jsx")) {
      found.push({ name: entry.name.replace(/\.jsx$/, ""), directory: relative });
    }
  }
  return found;
}

/** Duplicate values in a list, each reported once with the number of times it appeared. */
function duplicatesOf(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value, count]) => `${value} (x${count})`);
}

describe("routeRegistry module scope", () => {
  it("evaluates - the module is importable at all", () => {
    // The whole point of the file. A duplicate `const` makes this fail before any other test in the
    // suite can run, and the failure names the offending identifier.
    expect(Array.isArray(ROUTES)).toBe(true);
    expect(ROUTES.length).toBeGreaterThan(0);
  });

  it("declares every lazy component binding exactly once", () => {
    const declarations = [...registrySource.matchAll(/^const\s+([A-Za-z_$][\w$]*)\s*=\s*lazy\(/gm)].map(
      (match) => match[1]
    );

    expect(declarations.length).toBeGreaterThan(50);
    expect(duplicatesOf(declarations)).toEqual([]);
  });

  it("imports every module specifier exactly once", () => {
    // A component bound twice under two different names would satisfy the test above while still
    // shipping the same page as two separate lazy chunks.
    const specifiers = [...registrySource.matchAll(/lazy\(\s*\(\s*\)\s*=>\s*import\(\s*"([^"]+)"\s*\)/g)].map(
      (match) => match[1]
    );

    expect(specifiers.length).toBeGreaterThan(50);
    expect(duplicatesOf(specifiers)).toEqual([]);
  });

  it("points every import at a module that exists on disk", () => {
    const specifiers = [...registrySource.matchAll(/lazy\(\s*\(\s*\)\s*=>\s*import\(\s*"([^"]+)"\s*\)/g)].map(
      (match) => match[1]
    );

    const missing = specifiers.filter((specifier) => {
      const resolved = path.resolve(path.dirname(registryPath), specifier);
      return ![".jsx", ".js", "/index.jsx", "/index.js"].some((suffix) =>
        fs.existsSync(resolved + suffix)
      );
    });

    expect(missing).toEqual([]);
  });
});

describe("route entry uniqueness", () => {
  it("declares every page key exactly once", () => {
    expect(duplicatesOf(ROUTES.map((route) => route.page))).toEqual([]);
  });

  it("keeps PAGE_TO_ROUTE the same size as ROUTES", () => {
    // The reduce that builds PAGE_TO_ROUTE overwrites on collision, so a shrunken map is the direct
    // symptom of a duplicate key - and the mechanism by which the last declaration silently won.
    expect(Object.keys(PAGE_TO_ROUTE)).toHaveLength(ROUTES.length);
  });

  it("claims every static slug exactly once", () => {
    const staticSlugs = ROUTES.filter((route) => !route.param).flatMap((route) => route.slugs);
    expect(duplicatesOf(staticSlugs)).toEqual([]);
  });

  it("claims every parameterised slug exactly once", () => {
    // `blog` and `blog/:slug` legitimately share a prefix, so the two kinds are counted separately.
    // Two *dynamic* routes sharing a prefix is not legitimate: resolvePath scans
    // PARAMETERISED_ROUTES in order and the second would never be reached.
    const parameterisedSlugs = ROUTES.filter((route) => route.param).flatMap((route) => route.slugs);
    expect(duplicatesOf(parameterisedSlugs)).toEqual([]);
  });

  it("renders each component from at most one page key", () => {
    // icu-vitals-telemetry and icu-vitals both rendered IcuVitalsTelemetryHubPage, which made
    // buildPath's answer depend on which of the two keys the caller used. Alternative URLs belong
    // in a single entry's `slugs` array, where the first element is unambiguously canonical.
    const componentsByPage = ROUTES.map((route) => ({
      page: route.page,
      component: route.component,
    }));

    const pagesPerComponent = new Map();
    for (const { page, component } of componentsByPage) {
      const pages = pagesPerComponent.get(component) || [];
      pages.push(page);
      pagesPerComponent.set(component, pages);
    }

    const shared = [...pagesPerComponent.values()]
      .filter((pages) => pages.length > 1)
      .map((pages) => pages.join(" / "));

    expect(shared).toEqual([]);
  });

  it("builds SLUG_TO_PAGE from every slug, static and parameterised", () => {
    // This used to assert the static slugs *only*, which is what #25 was: a parameterised route's
    // bare slug was in no table, so `/update-task` resolved to not-found while buildPath was
    // emitting it. Every slug now resolves; a list page still wins any collision, asserted below.
    const everySlug = ROUTES.flatMap((route) => route.slugs);
    expect(Object.keys(SLUG_TO_PAGE).sort()).toEqual([...new Set(everySlug)].sort());
  });

  it("gives a shared slug to the list page rather than the detail route", () => {
    // `blog` and `blog/:slug` legitimately share a prefix. The bare slug belongs to the list page.
    const staticSlugs = new Set(
      ROUTES.filter((route) => !route.param).flatMap((route) => route.slugs)
    );
    for (const route of ROUTES.filter((r) => r.param)) {
      for (const slug of route.slugs) {
        if (staticSlugs.has(slug)) {
          expect(SLUG_TO_PAGE[slug], `slug "${slug}"`).not.toBe(route.page);
        }
      }
    }
  });
});

describe("route entry shape", () => {
  it("gives every route a non-empty page key, slug list and component", () => {
    for (const route of ROUTES) {
      expect(typeof route.page, `page key of ${JSON.stringify(route.page)}`).toBe("string");
      expect(route.page.length, `page key of ${route.page}`).toBeGreaterThan(0);
      expect(Array.isArray(route.slugs), `slugs of ${route.page}`).toBe(true);
      expect(route.slugs.length, `slugs of ${route.page}`).toBeGreaterThan(0);
      expect(route.component, `component of ${route.page}`).toBeTruthy();
    }
  });

  it("uses lower-case, URL-safe page keys and slugs", () => {
    // resolvePath lower-cases the incoming path before the SLUG_TO_PAGE lookup, so a slug carrying
    // an upper-case character can never be matched.
    const safe = /^[a-z0-9-]*$/;
    for (const route of ROUTES) {
      expect(route.page, `page key ${route.page}`).toMatch(safe);
      for (const slug of route.slugs) {
        expect(slug, `slug "${slug}" on page ${route.page}`).toMatch(safe);
      }
    }
  });

  it("declares an access level on every route", () => {
    for (const route of ROUTES) {
      const isRoleList = Array.isArray(route.access) && route.access.length > 0;
      const isKeyword = route.access === PUBLIC || route.access === AUTHENTICATED;
      expect(isRoleList || isKeyword, `access of ${route.page}`).toBe(true);
    }
  });

  it("uses only lower-cased role names in role lists", () => {
    // checkAccess compares against `user.role.toLowerCase()`, so a capitalised entry here locks the
    // route for the very role it was meant to admit.
    for (const route of ROUTES) {
      if (!Array.isArray(route.access)) {
        continue;
      }
      for (const role of route.access) {
        expect(role, `role "${role}" on page ${route.page}`).toBe(role.toLowerCase());
      }
    }
  });

  it("names a real permission code on every permission-gated route", () => {
    const permissionsSource = fs.readFileSync(
      path.join(projectRoot, "src", "security", "permissions.js"),
      "utf8"
    );
    const known = new Set([...permissionsSource.matchAll(/"([A-Z][A-Z0-9_]{2,})"/g)].map((m) => m[1]));

    for (const route of ROUTES) {
      if (!route.permission) {
        continue;
      }
      expect(known.has(route.permission), `permission ${route.permission} on page ${route.page}`).toBe(
        true
      );
    }
  });

  it("only exempts routes from chrome explicitly", () => {
    // hasChrome() treats anything other than an explicit `false` as chrome-on, so a `chrome: 0` or
    // `chrome: "false"` typo would quietly wrap a full-bleed layout in the navbar and footer.
    for (const route of ROUTES) {
      if ("chrome" in route) {
        expect(typeof route.chrome, `chrome flag on ${route.page}`).toBe("boolean");
      }
    }
  });

  it("keeps the terminal routes the resolver depends on", () => {
    // resolvePath falls back to "not-found", resolveEffectivePage substitutes "login", and the
    // empty slug is the application root. All three are load-bearing.
    expect(getRoute("not-found")).toBeTruthy();
    expect(getRoute("login")).toBeTruthy();
    expect(SLUG_TO_PAGE[""]).toBe("landing");
  });
});

describe("page reachability", () => {
  const pageComponents = collectPageComponents();
  // Derived from the components ROUTES actually renders, not from the lazy() bindings at the top of
  // the module. Keying this off the import list is what let DialysisRenalHub and
  // SterileProcessingHub sit on `main` as *imported* pages with no route entry: the import made
  // them look registered to this audit while /dialysis and /sterile-processing both resolved to the
  // 404 page. An import is not reachability.
  // A lazy() component is an opaque object with no `.name`, so the binding has to come from the
  // source text. Reading `component:` rather than the `lazy(` import list is the whole point.
  const registeredComponentNames = new Set(
    [...registrySource.matchAll(/component:\s*([A-Za-z_$][\w$]*)/g)].map((match) => match[1])
  );

  it("finds page components on disk to audit", () => {
    expect(pageComponents.length).toBeGreaterThan(50);
  });

  it("registers every page component, or lists it as deliberately unrouted", () => {
    const orphaned = pageComponents
      .filter(({ name }) => !registeredComponentNames.has(name))
      .filter(({ name }) => !UNROUTED_PAGES.includes(name))
      .map(({ name, directory }) => `${directory}/${name}.jsx`);

    expect(orphaned).toEqual([]);
  });

  it("keeps the unrouted allow-list in step with scripts/check-routes.js", () => {
    const scriptSource = fs.readFileSync(path.join(projectRoot, "scripts", "check-routes.js"), "utf8");
    const block = scriptSource.slice(
      scriptSource.indexOf("const UNROUTED_PAGES = {"),
      scriptSource.indexOf("};", scriptSource.indexOf("const UNROUTED_PAGES = {"))
    );
    const listedInScript = [...block.matchAll(/^\s{2}([A-Za-z_$][\w$]*):/gm)].map((match) => match[1]);

    expect([...listedInScript].sort()).toEqual([...UNROUTED_PAGES].sort());
  });

  it("does not keep an allow-list entry for a page that no longer exists", () => {
    const onDisk = new Set(pageComponents.map(({ name }) => name));
    const stale = UNROUTED_PAGES.filter((name) => !onDisk.has(name));
    expect(stale).toEqual([]);
  });

  it("registers the nine hub consoles that had no route", () => {
    // The specific regression: each of these was a finished console that rendered the 404 page.
    //
    // The page keys below are the ones the registry actually declares. An earlier revision of this
    // test asserted on the keys the consoles were *first* proposed with - pediatric-nicu,
    // medication-supply, telehealth-monitoring, genomic-trials, command-orchestration - and the
    // registry entries landed under different names. getRoute() looks up by page key and
    // command-orchestration is only a *slug* of hospital-command, so five of these nine assertions
    // failed against a registry that was correct. A regression test that drifts from the thing it
    // guards stops being evidence either way, so the keys are pinned to the registry here.
    const restored = {
      "regulatory-audit": "provenance",
      pharmacovigilance: "drug-safety",
      "surgical-robotics": "or-orchestration",
      "lab-automation": "lab-hub",
      "pediatric-neonatal-icu": "pediatric-icu",
      "medication-cold-chain": "med-supply-chain",
      "telehealth-remote-monitoring": "remote-monitoring",
      "genomic-clinical-trials": "genomics",
      "hospital-command": "command-orchestration",
    };

    for (const [page, alternativeSlug] of Object.entries(restored)) {
      expect(getRoute(page), `route for ${page}`).toBeTruthy();
      expect(resolvePath(page)).toEqual({ page, data: null });
      expect(resolvePath(alternativeSlug)).toEqual({ page, data: null });
    }
  });

  it("registers the eleven consoles that were merged as components with no route at all", () => {
    // The second orphan set, and a wider failure than the first: nine of these eleven were never
    // imported here, and the remaining two - DialysisRenalHub and SterileProcessingHub - were
    // imported and then never referenced by an entry, which is the harder version of the bug
    // because the import makes the page look wired up.
    //
    // Every value is a secondary slug, so the assertion covers both the canonical route and the
    // alternative spelling the pages are linked by.
    const restored = {
      "biomedical-ai-diagnostics": "ai-diagnostics-overwatch",
      "blood-bank": "haemovigilance",
      "blood-bank-transfusion": "transfusion-medicine",
      "cardiology-cath-lab": "cath-lab",
      "icu-telemetry-overwatch": "icu-overwatch",
      "pathology-digital": "digital-pathology",
      "patient-ehr-analytics": "ehr-analytics",
      "dialysis-renal": "dialysis",
      "sterile-processing": "cssd",
      "backend-auth-infrastructure": "auth-infrastructure",
      "zerotrust-governance": "zero-trust-governance",
    };

    for (const [page, alternativeSlug] of Object.entries(restored)) {
      expect(getRoute(page), `route for ${page}`).toBeTruthy();
      expect(resolvePath(page)).toEqual({ page, data: null });
      expect(resolvePath(alternativeSlug)).toEqual({ page, data: null });
      // buildPath has to round-trip to the canonical slug, not to the alternative one, or the
      // address bar disagrees with the console the user is looking at.
      expect(buildPath(page)).toBe(`/${page}`);
    }
  });

  it("gives every restored console a third slug only where one was asked for", () => {
    // Three of the eleven carry a third, shorter slug because the domain is commonly referred to by
    // one word. Pinning them stops a later edit from quietly dropping the short form that gets
    // typed and linked most often.
    expect(resolvePath("cardiology").page).toBe("cardiology-cath-lab");
    expect(resolvePath("pathology").page).toBe("pathology-digital");
    expect(resolvePath("renal-replacement").page).toBe("dialysis-renal");
    expect(resolvePath("instrument-traceability").page).toBe("sterile-processing");
  });

  it("does not let a restored slug shadow a console that already owned one", () => {
    // The eleven entries added 24 slugs to a table that already held ~200, and the near misses were
    // real: "icu-overwatch" sits beside "icu-telemetry" and "icu-vitals", "dialysis" beside
    // "cryo-telemetry", "genomics" was already taken by the genomic trials console. resolvePath is
    // the observable consequence of a collision, so assert on it rather than on the slug table.
    expect(resolvePath("icu-telemetry").page).toBe("icu-telemetry");
    expect(resolvePath("icu").page).toBe("icu-telemetry");
    expect(resolvePath("icu-vitals").page).toBe("icu-vitals-telemetry");
    expect(resolvePath("genomics").page).toBe("genomic-clinical-trials");
    expect(resolvePath("neonatal-nicu").page).toBe("neonatal-nicu");
    expect(resolvePath("nicu").page).toBe("neonatal-nicu");
    expect(resolvePath("oncology-infusion").page).toBe("oncology-infusion");
  });

  it("scopes the two restored security consoles to the hospital admin role", () => {
    // Nine of the eleven are clinical consoles and read by every signed-in role. The other two are
    // tenant-wide security governance - ABAC policy tables, DEA vault clearance rules - and belong
    // with the rest of the HOSPITAL_ONLY block rather than with the clinical set.
    const admin = { role: "hospital" };
    const technician = { role: "technician" };

    for (const page of ["backend-auth-infrastructure", "zerotrust-governance"]) {
      expect(checkAccess(admin, page).allowed, `hospital admin on ${page}`).toBe(true);
      expect(checkAccess(technician, page).allowed, `technician on ${page}`).toBe(false);
      expect(checkAccess(null, page).reason, `anonymous on ${page}`).toBe("unauthenticated");
    }
  });

  it("keeps the alternative slugs of the consoles that were declared three times", () => {
    // Each of these resolved to a different entry - or to nothing - depending on which of the
    // duplicate declarations happened to be last in the array.
    expect(resolvePath("enclaves").page).toBe("confidential-compute");
    expect(resolvePath("secure-enclave").page).toBe("confidential-compute");
    expect(resolvePath("confidential-compute-enclave").page).toBe("confidential-compute");
    expect(resolvePath("ctem-hub").page).toBe("ctem");
    expect(resolvePath("attack-surface").page).toBe("ctem");
    expect(resolvePath("ctem-attack-surface").page).toBe("ctem");
    expect(resolvePath("kms-vault").page).toBe("quantum-kms");
    expect(resolvePath("quantum-crypto").page).toBe("quantum-kms");
    expect(resolvePath("icu-vitals").page).toBe("icu-vitals-telemetry");
    expect(resolvePath("vitals-telemetry").page).toBe("icu-vitals-telemetry");
    expect(resolvePath("bedside-telemetry").page).toBe("icu-vitals-telemetry");
  });
});

describe("navigation targets used by the application", () => {
  /** Every source file under src/, with comments stripped. */
  function collectSources(directory) {
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", "build", "dist", "coverage"].includes(entry.name)) {
          files.push(...collectSources(absolute));
        }
      } else if (/\.(js|jsx)$/.test(entry.name)) {
        files.push({
          path: path.relative(projectRoot, absolute),
          source: fs
            .readFileSync(absolute, "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\/\/[^\n]*/g, ""),
        });
      }
    }
    return files;
  }

  const sources = collectSources(path.join(projectRoot, "src"));

  it("resolves every literal onNavigate target to a registered page", () => {
    const unregistered = [];
    for (const { path: file, source } of sources) {
      for (const match of source.matchAll(/onNavigate\(\s*"([a-zA-Z0-9_-]+)"/g)) {
        if (!PAGE_TO_ROUTE[match[1]]) {
          unregistered.push(`${file}: onNavigate("${match[1]}")`);
        }
      }
    }
    expect(unregistered).toEqual([]);
  });

  it("resolves every { label, page } navigation link to a registered page", () => {
    // Nav bars build their buttons from arrays and call onNavigate(link.page), so the target is
    // invisible to the literal scan above - which is how two procurement buttons shipped pointing
    // at pages that did not exist.
    const patterns = [
      /\{\s*label:\s*"[^"]*"\s*,\s*page:\s*"([^"]+)"\s*\}/g,
      /\{\s*page:\s*"([^"]+)"\s*,\s*label:\s*"[^"]*"\s*\}/g,
    ];

    const unregistered = [];
    for (const { path: file, source } of sources) {
      if (file.endsWith("routes/routeRegistry.js")) {
        continue;
      }
      for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) {
          if (!PAGE_TO_ROUTE[match[1]]) {
            unregistered.push(`${file}: page "${match[1]}"`);
          }
        }
      }
    }
    expect(unregistered).toEqual([]);
  });
});

describe("resolvePath", () => {
  it("maps the empty path to the landing page", () => {
    expect(resolvePath("")).toEqual({ page: "landing", data: null });
    expect(resolvePath(undefined)).toEqual({ page: "landing", data: null });
  });

  it("maps an unknown slug to not-found rather than the landing page", () => {
    expect(resolvePath("no-such-console")).toEqual({ page: "not-found", data: null });
  });

  it("is case-insensitive on the slug", () => {
    expect(resolvePath("DASHBOARD").page).toBe("dashboard");
    expect(resolvePath("Cold-Chain").page).toBe("cold-chain");
  });

  it("round-trips every static slug back to its own page key", () => {
    const mismatches = [];
    for (const route of ROUTES) {
      if (route.param) {
        continue;
      }
      for (const slug of route.slugs) {
        const resolved = resolvePath(slug);
        if (resolved.page !== route.page) {
          mismatches.push(`"${slug}" -> ${resolved.page}, expected ${route.page}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("extracts the dynamic segment of a parameterised route", () => {
    expect(resolvePath("blog/mri-uptime")).toEqual({ page: "blog-post", data: "mri-uptime" });
    expect(resolvePath("edit-equipment/EQ-1001")).toEqual({
      page: "edit-equipment",
      data: "EQ-1001",
    });
  });

  it("decodes a percent-encoded dynamic segment", () => {
    expect(resolvePath("edit-equipment/EQ%2F1001").data).toBe("EQ/1001");
  });

  it("keeps the bare prefix on the list page, not the detail page", () => {
    // `blog` and `blog/:slug` share a prefix; SLUG_TO_PAGE deliberately skips parameterised routes
    // so the bare slug stays with the list page.
    expect(resolvePath("blog").page).toBe("blog");
  });
});

describe("buildPath", () => {
  it("is the inverse of resolvePath for every static route", () => {
    const mismatches = [];
    for (const route of ROUTES) {
      if (route.param) {
        continue;
      }
      const built = buildPath(route.page).replace(/^\//, "");
      const resolved = resolvePath(built);
      if (resolved.page !== route.page) {
        mismatches.push(`${route.page} -> "${built}" -> ${resolved.page}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("uses the first slug as the canonical one", () => {
    expect(buildPath("cold-chain")).toBe("/cold-chain");
    expect(buildPath("confidential-compute")).toBe("/confidential-compute");
    expect(buildPath("icu-vitals-telemetry")).toBe("/icu-vitals-telemetry");
  });

  it("maps the landing page to the root path", () => {
    expect(buildPath("landing")).toBe("/");
  });

  it("appends and encodes the dynamic segment when one is given", () => {
    expect(buildPath("blog-post", "mri-uptime")).toBe("/blog/mri-uptime");
    expect(buildPath("edit-equipment", "EQ/1001")).toBe("/edit-equipment/EQ%2F1001");
  });

  it("omits the dynamic segment when no data is supplied", () => {
    expect(buildPath("edit-equipment")).toBe("/edit-equipment");
  });

  it("falls back to the raw key for a page it does not know", () => {
    expect(buildPath("not-a-page")).toBe("/not-a-page");
  });
});

describe("buildHref", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("prefixes BASE_PATH when the app is served under it", () => {
    window.history.pushState({}, "", `${BASE_PATH}/equipment`);
    expect(buildHref("regulatory-audit")).toBe(`${BASE_PATH}/regulatory-audit`);
  });

  it("returns a bare path in local development", () => {
    window.history.pushState({}, "", "/equipment");
    expect(buildHref("regulatory-audit")).toBe("/regulatory-audit");
  });
});

describe("hasChrome", () => {
  it("defaults to showing the navbar and footer", () => {
    expect(hasChrome("dashboard")).toBe(false); // declared chrome: false
    expect(hasChrome("equipment")).toBe(true);
  });

  it("shows chrome for a page key it does not recognise", () => {
    expect(hasChrome("not-a-page")).toBe(true);
  });

  it("hides chrome on every full-bleed authentication screen", () => {
    for (const page of ["login", "register", "forgot-password", "verify-otp", "reset-password"]) {
      expect(hasChrome(page), `chrome on ${page}`).toBe(false);
    }
  });
});

describe("checkAccess", () => {
  const hospital = { role: "Hospital" };
  const technician = { role: "technician" };

  it("admits anyone to a public route", () => {
    expect(checkAccess(null, "landing")).toEqual({ allowed: true, reason: null });
    expect(checkAccess(technician, "terms")).toEqual({ allowed: true, reason: null });
  });

  it("rejects an anonymous visitor on an authenticated route with the reason the router keys off", () => {
    expect(checkAccess(null, "cold-chain")).toEqual({
      allowed: false,
      reason: "unauthenticated",
    });
  });

  it("admits any signed-in role to an authenticated route", () => {
    expect(checkAccess(technician, "cold-chain").allowed).toBe(true);
    expect(checkAccess(hospital, "cold-chain").allowed).toBe(true);
  });

  it("compares role names case-insensitively", () => {
    expect(checkAccess(hospital, "analytics").allowed).toBe(true);
  });

  it("rejects a signed-in role that is not on the allow-list, and says which role is needed", () => {
    const result = checkAccess(technician, "analytics");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("hospital");
  });

  it("treats an unknown page as public so the 404 page can render", () => {
    expect(checkAccess(null, "not-a-page")).toEqual({ allowed: true, reason: null });
  });

  it("tolerates a user record with no role", () => {
    expect(checkAccess({}, "analytics").allowed).toBe(false);
  });

  it("admits every restored hub console to any signed-in role", () => {
    // Page keys pinned to the registry rather than to the names the consoles were proposed under -
    // see the note on the matching reachability test. A technician reads these consoles; nothing on
    // them writes, so the gate is authentication, not role.
    const restored = [
      "regulatory-audit",
      "pharmacovigilance",
      "surgical-robotics",
      "lab-automation",
      "pediatric-neonatal-icu",
      "medication-cold-chain",
      "telehealth-remote-monitoring",
      "genomic-clinical-trials",
      "hospital-command",
      // the second orphan set, restored alongside the nine above
      "biomedical-ai-diagnostics",
      "blood-bank",
      "blood-bank-transfusion",
      "cardiology-cath-lab",
      "icu-telemetry-overwatch",
      "pathology-digital",
      "patient-ehr-analytics",
      "dialysis-renal",
      "sterile-processing",
    ];
    for (const page of restored) {
      expect(checkAccess(technician, page).allowed, `technician on ${page}`).toBe(true);
      expect(checkAccess(null, page).reason, `anonymous on ${page}`).toBe("unauthenticated");
    }
  });
});

describe("resolveEffectivePage", () => {
  it("substitutes the login screen for an anonymous hit on a protected console", () => {
    // App.jsx derives layout chrome from this call, so the substitution has to happen here rather
    // than inside the router: keying chrome off the *requested* page wrapped the full-bleed login
    // screen in the navbar and footer.
    expect(resolveEffectivePage(null, "equipment")).toBe("login");
    expect(hasChrome(resolveEffectivePage(null, "equipment"))).toBe(false);
  });

  it("leaves an authorised request untouched", () => {
    expect(resolveEffectivePage({ role: "hospital" }, "equipment")).toBe("equipment");
  });

  it("resolves an unknown page key to the 404 page", () => {
    expect(resolveEffectivePage({ role: "hospital" }, "not-a-page")).toBe("not-found");
  });

  it("keeps a role-denied page as itself so the Access Denied screen can explain it", () => {
    // Not "login": signing in again would not fix a technician opening an admin console.
    expect(resolveEffectivePage({ role: "technician" }, "analytics")).toBe("analytics");
  });

  it("does not redirect an anonymous visitor away from a public page", () => {
    expect(resolveEffectivePage(null, "landing")).toBe("landing");
    expect(resolveEffectivePage(null, "login")).toBe("login");
  });
});
