#!/usr/bin/env node
/**
 * Validates src/routes/routeRegistry.js against the pages that actually exist on disk.
 *
 * Why this exists
 * ---------------
 * Route information used to live in three hand-maintained places — the `routeMap` object in
 * App.jsx, the `switch` in AppRoutes.jsx, and the import list above it — with nothing keeping them
 * consistent. The drift that accumulated:
 *
 *   - `KeyVaultSecurityPage` and `MicrosegmentationPage` were rendered but never imported, an
 *     uncaught ReferenceError that the ErrorBoundary turns into a blank screen;
 *   - `case "keyvault-security"` and `case "microsegmentation"` each appeared twice, so the second
 *     was dead code and `/microsegmentation` silently rendered the ZTNA page instead;
 *   - `routeMap` declared `help` twice and `microsegmentation` twice with *different* targets, and
 *     in an object literal the last one silently wins;
 *   - fourteen security consoles existed as page components with no route at all.
 *
 * Collapsing the three lists into one registry removes the drift by construction. This script
 * closes the remaining gap: it fails the build when the registry itself is inconsistent, or when a
 * page component under src/pages/ is never registered. It used to audit only src/pages/auth/ -
 * the directory that had already bit us - but that let a whole second class of orphans through:
 * pages outside src/pages/auth (public marketing pages, hospital and supplier pages) that existed
 * as files, were linked to from the footer, navbar or cookie banner, and still resolved to the
 * 404 page because nobody had added them to the registry. So the audit now walks every *.jsx
 * file under src/pages/ (test files excluded) and requires each one to be either registered or
 * listed in UNROUTED_PAGES below with a reason.
 *
 * It works by static analysis rather than by importing the registry, so it needs no React runtime,
 * no JSDOM and no test framework, and it runs in well under a second from `prebuild`.
 *
 * Usage:  node scripts/check-routes.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const registryPath = path.join(projectRoot, 'src', 'routes', 'routeRegistry.js');
const pagesRoot = path.join(projectRoot, 'src', 'pages');

/**
 * Page components under src/pages/ that intentionally have no route. Keep this list small and
 * give every entry a reason: a page that can be reached from a URL belongs in ROUTES instead.
 *
 *   - ActivityCenter and InvoiceModal are not pages at all - components that live in src/pages/
 *     and are rendered inline by Navbar / OrdersList respectively.
 *   - HelpPage and CookiePage are superseded by HelpCenterPage (route "help") and
 *     CookieConsentPage (route "cookies"), which were both registered; the duplicates remain on
 *     disk as dead files.
 *   - The five procurement workflow pages are drafts: complete components, but nothing links to
 *     them yet, so they are parked here until the procurement flow is wired into navigation.
 *   - The nine clinical consoles at the end are near-duplicates: each covers the same care area as
 *     a console that now has a route, under a different directory and a slightly different name.
 *     Registering all of them would put several menu entries in front of the user that open almost
 *     identical screens, so one per care area is routed and the rest are parked here. They are
 *     candidates for deletion once someone confirms which variant the product wants to keep.
 */
const UNROUTED_PAGES = {
  ActivityCenter: 'rendered inline inside the Navbar (imported directly), not as a route',
  InvoiceModal: 'modal component rendered inside src/pages/supplier/OrdersList.jsx, not a page',
  HelpPage: 'superseded by HelpCenterPage, which serves the "help" route',
  CookiePage: 'superseded by CookieConsentPage, which serves the "cookies" route',
  ReceivingScreen: 'procurement workflow draft - no link reaches it yet',
  SparePartsCatalog: 'procurement workflow draft - no link reaches it yet',
  RfqQuoteComparison: 'procurement workflow draft - no link reaches it yet',
  DuplicateDetection: 'procurement workflow draft - no link reaches it yet',
  ProcurementLifecycleTimeline: 'procurement workflow draft - no link reaches it yet',
  BioAiDiagnosticsGenomicHub: 'near-duplicate of BioAiDiagnosticsHub, which serves the "bioai-diagnostics" route',
  CardiovascularHemodynamicsOverwatchPage: 'near-duplicate of CardiovascularHemodynamicsHub, which serves "cardiovascular-hemodynamics"',
  EmergencyTriageDisasterCommandPage: 'near-duplicate of EmergencyDisasterMciCommandHub, which serves "emergency-disaster-mci"',
  ContinuousDialysisAkiOverwatchPage: 'near-duplicate of NephrologyCrrtHub, which serves the "nephrology-crrt" route',
  NeuroCriticalCareIcpOverwatchPage: 'near-duplicate of NeuroIcuIcpHub, which serves the "neuro-icu-icp" route',
  PrecisionGenomicOncologyOverwatchPage: 'near-duplicate of PrecisionOncologyHub, which serves the "precision-oncology" route',
  PrecisionOncologyMolecularHub: 'near-duplicate of PrecisionOncologyHub, which serves the "precision-oncology" route',
  PediatricIcuHfovCommandHub: 'near-duplicate of PediatricIcuTelemetryHub, which serves "pediatric-icu-telemetry"',
  PediatricIcuOverwatchHub: 'near-duplicate of PediatricIcuTelemetryHub, which serves "pediatric-icu-telemetry"',
};

const failures = [];

function fail(message) {
  failures.push(message);
}

function readRegistry() {
  if (!fs.existsSync(registryPath)) {
    console.error(`check-routes: ${path.relative(projectRoot, registryPath)} not found.`);
    process.exit(2);
  }
  return fs.readFileSync(registryPath, 'utf8');
}

/**
 * Collects the component bindings the registry can render, in either of the two forms it uses.
 *
 *   import Foo from "../pages/auth/Foo";                     -> { Foo: '../pages/auth/Foo' }
 *   const Foo = lazy(() => import("../pages/auth/Foo"));     -> { Foo: '../pages/auth/Foo' }
 *
 * The registry moved to the second form so each page ships as its own chunk instead of being pulled
 * into the main bundle. Recognising only the first form would have made every one of the ~66 checks
 * below report a false "never imported" and this script useless the moment it mattered.
 */
function parseImports(source) {
  const imports = {};

  const eagerPattern = /^import\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["'];/gm;
  let match;
  while ((match = eagerPattern.exec(source)) !== null) {
    imports[match[1]] = match[2];
  }

  const lazyPattern =
    /^const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:React\.)?lazy\(\s*\(\s*\)\s*=>\s*import\(\s*["']([^"']+)["']\s*\)\s*\);/gm;
  while ((match = lazyPattern.exec(source)) !== null) {
    imports[match[1]] = match[2];
  }

  return imports;
}

/**
 * Extracts the ROUTES entries. Deliberately regex-based and shallow: the registry is a flat array
 * of object literals with a fixed shape, and a real parser would add a dependency for no gain.
 */
function parseRoutes(source) {
  const start = source.indexOf('export const ROUTES = [');
  if (start < 0) {
    console.error('check-routes: could not find `export const ROUTES = [` in the registry.');
    process.exit(2);
  }
  const end = source.indexOf('\n];', start);
  const body = source.slice(start, end < 0 ? source.length : end);

  const routes = [];
  const entryPattern = /\{\s*page:\s*"([^"]+)"\s*,\s*slugs:\s*\[([^\]]*)\]\s*,\s*component:\s*([A-Za-z_$][\w$]*)([^}]*)\}/g;
  let match;
  while ((match = entryPattern.exec(body)) !== null) {
    const slugs = match[2]
      .split(',')
      .map((slug) => slug.trim().replace(/^["']|["']$/g, ''))
      .filter((slug) => slug.length > 0 || slug === '');
    routes.push({
      page: match[1],
      slugs: match[2].trim() === '""' ? [''] : slugs,
      component: match[3],
      rest: match[4],
      isParameterised: /\bparam:\s*"/.test(match[4]),
    });
  }
  return routes;
}

function main() {
  const source = readRegistry();
  const imports = parseImports(source);
  const routes = parseRoutes(source);

  if (routes.length === 0) {
    console.error('check-routes: parsed zero routes out of the registry. The parsing in this '
      + 'script has drifted from the file and every check below would be vacuous.');
    process.exit(2);
  }

  // 1. Every referenced component must be imported. This is the defect that produced a blank
  //    screen on /keyvault and /microsegmentation.
  for (const route of routes) {
    if (!imports[route.component]) {
      fail(`route "${route.page}" renders ${route.component}, which is never imported`);
    }
  }

  // 2. Every imported page module must exist on disk.
  for (const [name, specifier] of Object.entries(imports)) {
    if (!specifier.startsWith('../pages/')) {
      continue;
    }
    const resolved = path.resolve(path.dirname(registryPath), specifier);
    const exists = ['.jsx', '.js', '/index.jsx', '/index.js'].some((suffix) =>
      fs.existsSync(resolved + suffix)
    );
    if (!exists) {
      fail(`import ${name} points at ${specifier}, which does not exist`);
    }
  }

  // 3. No duplicate page keys.
  const seenPages = new Map();
  for (const route of routes) {
    if (seenPages.has(route.page)) {
      fail(`page key "${route.page}" is declared more than once`);
    }
    seenPages.set(route.page, route);
  }

  // 4. No duplicate slugs. A parameterised route legitimately shares its prefix with its list page
  //    (`blog` and `blog/:slug` are different routes), so the two kinds get their own map: a slug
  //    may appear once as static and once as parameterised, but not twice within either kind.
  //    Skipping parameterised routes outright, as an earlier version of this script did, let two
  //    dynamic routes claim the same prefix — `resolvePath` would then always pick whichever came
  //    first in ROUTES and the other would be permanently unreachable.
  const seenSlugs = new Map();
  const seenParameterisedSlugs = new Map();
  for (const route of routes) {
    const seen = route.isParameterised ? seenParameterisedSlugs : seenSlugs;
    const kind = route.isParameterised ? 'parameterised ' : '';
    for (const slug of route.slugs) {
      if (seen.has(slug)) {
        fail(
          `${kind}slug "${slug || '(root)'}" is claimed by both "${seen.get(slug)}" and `
          + `"${route.page}" - one of them is unreachable`
        );
      }
      seen.set(slug, route.page);
    }
  }

  // 5. Every page component under src/pages/ must be reachable. Originally this audit covered
  //    only src/pages/auth/ - the directory that had already produced fourteen unreachable
  //    consoles - but pages elsewhere drifted the same way: ResearchPage, SupplierCentrePage,
  //    PrivacyPage, CookieConsentPage and DoNotSellPage existed as files and were linked from the
  //    footer or cookie banner while resolving to NotFoundPage, and the rewritten Equipment
  //    Lifecycle page had no route at all. Walking the whole tree (excluding *.test.jsx) closes
  //    the gap; UNROUTED_PAGES is the explicit, reason-carrying list of files that are allowed to
  //    stay unrouted.
  const registered = new Set(routes.map((route) => route.component));
  const pageFiles = [];
  (function walk(dir, relative) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), `${relative}/${entry.name}`);
      } else if (entry.isFile() && entry.name.endsWith('.jsx') && !entry.name.endsWith('.test.jsx')) {
        pageFiles.push({ name: entry.name.replace('.jsx', ''), relative });
      }
    }
  })(pagesRoot, 'src/pages');

  for (const { name, relative } of pageFiles) {
    if (registered.has(name)) {
      continue;
    }
    if (UNROUTED_PAGES[name]) {
      continue;
    }
    fail(`${name} exists in ${relative}/ but is not registered, so no URL reaches it`);
  }

  // 6. Every onNavigate target in the codebase must be a registered page key. This is what let
  //    'home' (the Login/Register back buttons) and the SIEM/SOAR dashboard shortcuts slip
  //    through: they looked like routes, but no such page key existed, so clicking them rendered
  //    the 404 page on every deployment. Static scan, same as the checks above - no React runtime.
  const registeredKeys = new Set(routes.map((route) => route.page));
  const navTargetPattern = /onNavigate\s*\(\s*["']([a-zA-Z0-9_-]+)["']/g;
  function walkSource(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', 'build', 'dist', 'coverage', '.git'].includes(entry.name)) {
          walkSource(absolute);
        }
      } else if (/\.(js|jsx)$/.test(entry.name)) {
        const source = fs
          .readFileSync(absolute, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '') // strip block comments
          .replace(/\/\/[^\n]*/g, ''); // strip line comments
        let match;
        while ((match = navTargetPattern.exec(source)) !== null) {
          if (!registeredKeys.has(match[1])) {
            fail(`onNavigate("${match[1]}") in ${path.relative(projectRoot, absolute)} is not a registered page key`);
          }
        }
      }
    }
  }
  walkSource(path.join(projectRoot, 'src'));

  // 6. Every navigation target declared as a `{ label, page }` link object must be registered.
  //    Literal onNavigate("...") calls are caught elsewhere, but nav bars build their buttons from
  //    arrays and call onNavigate(link.page), so the target is invisible to a literal scan - which
  //    is exactly how the "New Procurement" / "Approval Inbox" buttons shipped pointing at
  //    unregistered pages while every literal target checked out.
  const pageKeys = new Set(routes.map((route) => route.page));
  const linkPatterns = [
    /\{\s*label:\s*["'][^"']*["']\s*,\s*page:\s*["']([^"']+)["']\s*\}/g,
    /\{\s*page:\s*["']([^"']+)["']\s*,\s*label:\s*["'][^"']*["']\s*\}/g,
  ];
  const linkFiles = [];
  function collectJsxFiles(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'node_modules') {
          collectJsxFiles(full);
        }
      } else if (/^\.(jsx|js)$/.test(path.extname(entry.name))) {
        linkFiles.push(full);
      }
    }
  }
  collectJsxFiles(path.join(projectRoot, 'src'));

  for (const file of linkFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of linkPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const target = match[1];
        if (!pageKeys.has(target)) {
          fail(
            `${path.relative(projectRoot, file)} links to page "${target}", which is not `
            + 'registered in the route registry - the button renders the 404 page'
          );
        }
      }
    }
  }

  // 6. Every route `permission` field must name a permission code that actually exists in
  //    src/security/permissions.js (which mirrors the backend AuthorityService matrix). A typo
  //    here silently locks a route forever - AppRoutes denies anyone who does not hold the
  //    mistyped code - so it has to fail the build instead. The valid codes are collected by
  //    regex from the source, exactly like the route entries above, so this script never needs
  //    to import the ESM module.
  const permissionsPath = path.join(projectRoot, 'src', 'security', 'permissions.js');
  const permissionsSource = fs.readFileSync(permissionsPath, 'utf8');
  const permissionCodes = new Set();
  const permissionCodePattern = /"([A-Z][A-Z0-9_]{2,})"/g;
  let codeMatch;
  while ((codeMatch = permissionCodePattern.exec(permissionsSource)) !== null) {
    permissionCodes.add(codeMatch[1]);
  }

  const permissionFieldPattern = /permission:\s*"([^"]+)"/;
  for (const route of routes) {
    const match = permissionFieldPattern.exec(route.rest || '');
    if (!match) {
      continue;
    }
    const code = match[1];
    if (!permissionCodes.has(code)) {
      fail(
        `route "${route.page}" requires permission "${code}", which is not defined in `
        + 'src/security/permissions.js - AppRoutes would lock this route for everyone'
      );
    }
  }

  if (failures.length > 0) {
    console.error(`\ncheck-routes: ${failures.length} problem(s) found.\n`);
    failures.forEach((message) => console.error(`  - ${message}`));
    console.error('');
    process.exit(1);
  }

  console.log(
    `check-routes: ${routes.length} routes, ${seenSlugs.size} slugs, `
    + `${seenParameterisedSlugs.size} parameterised, `
    + `${pageFiles.length} page components under src/pages/ - all consistent.`
  );
}

main();
