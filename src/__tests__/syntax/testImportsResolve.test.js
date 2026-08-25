/**
 * Every relative import in every test file resolves to a file that exists.
 *
 * Why this is its own guard rather than something the runner reports: when a suite's import does
 * not resolve, Vite fails the transform and the file is collected as **0 tests**. It is listed,
 * it is not red in a way anyone reads as "these assertions are gone", and it goes on reporting
 * nothing for as long as nobody looks. Three suites under `src/__tests__/components/` had been
 * doing exactly that - they used `../../../components/...`, which is right for a suite one
 * directory deeper and resolves to a `components/` beside the repo root from where they sit.
 *
 * That is the second time a batch of suites has been lost to import depth (#5 was eighteen of
 * them), and both times the symptom was silence. A wrong path is now a failing assertion in a
 * suite that does run.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TESTS_ROOT = path.resolve(HERE, "..");
const SRC_ROOT = path.resolve(TESTS_ROOT, "..");

/** Extensions the bundler will try, in order, for an extensionless specifier. */
const RESOLVE_EXTENSIONS = ["", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json"];

/** `import ... from "x"`, `export ... from "x"`, `import("x")`, and `require("x")`. */
const IMPORT_PATTERNS = [
  /(?:^|\n)\s*import\s+[^"';]*?from\s*["']([^"']+)["']/g,
  /(?:^|\n)\s*import\s*["']([^"']+)["']/g,
  /(?:^|\n)\s*export\s+[^"';]*?from\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  // vi.mock("...") - a wrong path here is worse than a broken import, because the mock silently
  // applies to nothing and the test exercises the real module while claiming otherwise.
  /\bvi\s*\.\s*(?:mock|doMock|unmock)\s*\(\s*["']([^"']+)["']/g,
];

/**
 * Strip the regions where an import-looking string is not an import.
 *
 * `undefinedIdentifiers.test.js` embeds whole source files as template literals to feed its
 * parser, and those fixtures contain `import Chart from "./Chart"` for modules that were never
 * meant to exist. This file's own regex sources are the same kind of false positive. Both are
 * inside comments or template literals, so removing those first is enough - and it is also the
 * honest thing to scan, since a bundler only resolves real import statements.
 */
function stripNonCode(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")   // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")  // line comments, but not the // in a URL
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, "``"); // template literals, contents dropped
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(test|spec)\.(js|jsx|ts|tsx)$/.test(entry.name) || /\.(jsx?|tsx?)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function resolves(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return true;
  }
  // A directory import picks up its index file.
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const ext of RESOLVE_EXTENSIONS.filter(Boolean)) {
      if (fs.existsSync(path.join(base, "index" + ext))) return true;
    }
  }
  return false;
}

const FILES = walk(TESTS_ROOT);

describe("every relative import under src/__tests__ resolves", () => {
  it("finds test files to check at all", () => {
    // Without this the suite passes vacuously if the walk ever stops finding anything.
    expect(FILES.length).toBeGreaterThan(50);
  });

  it.each(FILES.map((f) => [path.relative(SRC_ROOT, f), f]))("%s", (_label, file) => {
    const source = stripNonCode(fs.readFileSync(file, "utf8"));
    const broken = [];

    for (const pattern of IMPORT_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(source)) !== null) {
        const specifier = match[1];
        // Bare specifiers are package names; node_modules resolution is the bundler's problem.
        if (!specifier.startsWith(".")) continue;
        if (!resolves(file, specifier)) broken.push(specifier);
      }
    }

    expect(broken).toEqual([]);
  });
});
