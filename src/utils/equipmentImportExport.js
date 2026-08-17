import * as XLSX from "xlsx";

/* =========================================================================
   Bulk equipment import / export helpers.

   The backend (/api/equipment/import) consumes one canonical CSV shape whose
   headers match EquipmentService.EQUIPMENT_CSV_HEADERS. This module is the
   single place that:
     - parses user-uploaded .csv / .xlsx / .xls files into that shape
     - converts the parsed rows back to the canonical CSV for upload
     - exports the currently filtered inventory view as CSV or Excel
   ========================================================================= */

export const IMPORT_HEADERS = [
  "Equipment Code",
  "Name",
  "Model",
  "Serial Number",
  "Department",
  "Category",
  "Status",
  "Purchase Date",
  "Warranty Expiry",
  "Purchase Cost",
  "Useful Life (Years)",
  "Depreciation Method",
  "Warranty Provider",
  "Warranty Contract Number",
  "Warranty Start Date",
  "Warranty Coverage Type",
  "Warranty Terms",
];

/** The columns that hold dates and therefore need normalising to YYYY-MM-DD on import. */
export const DATE_HEADERS = [
  "Purchase Date",
  "Warranty Start Date",
  "Warranty Expiry",
];

export const IMPORT_COLUMN_GUIDANCE = {
  "Equipment Code": "Optional. Stable ID like EQ-001. Omit to auto-generate.",
  Name: "Required. Asset name, e.g. MRI Scanner",
  Model: "Optional. Manufacturer model, e.g. GE Signa HDxt",
  "Serial Number": "Optional, but unique. Duplicates are rejected.",
  Department: "Required. e.g. Radiology, ICU, Emergency",
  Category: "Optional. IMAGING, SURGICAL, MONITORING, LABORATORY, RESPIRATORY or OTHER",
  Status: "Optional. Operational, Maintenance or Retired (default: Operational)",
  "Purchase Date": "Optional. YYYY-MM-DD, e.g. 2025-06-12",
  "Warranty Expiry": "Optional. Coverage end date, YYYY-MM-DD, e.g. 2027-06-12",
  "Purchase Cost": "Optional. Non-negative number, e.g. 250000.00",
  "Useful Life (Years)": "Optional. Positive whole years, e.g. 10",
  "Depreciation Method": "Optional. STRAIGHT_LINE or DECLINING_BALANCE (default: STRAIGHT_LINE)",
  "Warranty Provider": "Optional. Vendor backing the coverage, e.g. Siemens Healthineers",
  "Warranty Contract Number": "Optional. Contract or registration number",
  "Warranty Start Date": "Optional. Coverage start, YYYY-MM-DD",
  "Warranty Coverage Type": "Optional. FULL_PARTS_AND_LABOR, PARTS_ONLY or LABOR_ONLY",
  "Warranty Terms": "Optional. Exclusions and service notes",
};

const canonicalKey = (header) =>
  String(header).toLowerCase().replace(/[^a-z0-9]/g, "");

const CANONICAL_KEYS = new Map(IMPORT_HEADERS.map((h) => [canonicalKey(h), h]));

/** Alias-friendly lookup: "EquipmentCode" -> "Equipment Code", etc. */
const canonicalHeader = (header) => {
  const key = canonicalKey(header);
  if (CANONICAL_KEYS.has(key)) return CANONICAL_KEYS.get(key);
  if (key === "equipmentid") return "Equipment Code";
  if (key === "serialno" || key === "serial") return "Serial Number";
  if (key === "purchasedate" || key === "datepurchased") return "Purchase Date";
  if (key === "warrantyexpiry" || key === "warrantyexpiration" || key === "warranty") {
    return "Warranty Expiry";
  }
  if (key === "purchasecost" || key === "cost" || key === "price") return "Purchase Cost";
  if (key === "usefullife" || key === "usefullifeyears" || key === "life") return "Useful Life (Years)";
  if (key === "depreciationmethod" || key === "method") return "Depreciation Method";
  if (key === "warrantyprovider" || key === "provider") return "Warranty Provider";
  if (key === "warrantycontractnumber" || key === "contractnumber") return "Warranty Contract Number";
  // canonicalKey has already stripped spaces and punctuation, so aliases are compared in that
  // form. "coverage start" sat here for a while and could never match anything.
  if (key === "warrantystartdate" || key === "coveragestart") return "Warranty Start Date";
  if (key === "warrantycoveragetype" || key === "coveragetype") return "Warranty Coverage Type";
  if (key === "warrantyterms" || key === "terms") return "Warranty Terms";
  return null;
};

/**
 * Reads a File as an ArrayBuffer.
 *
 * <p>{@code File.prototype.arrayBuffer} is not available everywhere (older Safari, jsdom), so a
 * FileReader is used when the native method is missing.</p>
 */
const readFileAsArrayBuffer = (file) => {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Parses a user-uploaded spreadsheet (CSV, XLSX or XLS) into rows keyed by the
 * canonical import headers. Header names are matched case-insensitively and
 * tolerant of common aliases, so hospital spreadsheets rarely need editing.
 *
 * @param {File} file the uploaded file
 * @returns {Promise<{rows: Object[], unknownHeaders: string[], error: string|null}>}
 */
export const parseImportFile = (file) => {
  const extension = file.name.split(".").pop().toLowerCase();
  const supported = ["csv", "tsv", "xlsx", "xls"];
  if (!supported.includes(extension)) {
    return Promise.resolve({
      rows: [],
      unknownHeaders: [],
      error: "Unsupported file type. Please upload a .csv or .xlsx file.",
    });
  }

  return readFileAsArrayBuffer(file)
    .then((buffer) => {
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) {
        return { rows: [], unknownHeaders: [], error: "The file contains no worksheet." };
      }

      // header: 1 -> rows as arrays; defval keeps empty cells as "".
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (rawRows.length === 0) {
        return { rows: [], unknownHeaders: [], error: "The file contains no data rows." };
      }

      const headers = rawRows[0].map(String);
      const columnIndexes = new Map();
      const unknownHeaders = [];
      headers.forEach((header, index) => {
        const canonical = canonicalHeader(header);
        if (canonical) {
          // Later duplicate headers lose; the first occurrence wins.
          if (!columnIndexes.has(canonical)) columnIndexes.set(canonical, index);
        } else {
          unknownHeaders.push(header);
        }
      });

      const rows = [];
      // Every date column in IMPORT_HEADERS. "Warranty Start Date" was missing, so a real .xlsx
      // date cell in that column - which SheetJS hands back as an Excel serial - was uploaded as a
      // five-digit number while the two columns beside it converted correctly.
      const dateColumns = new Set(DATE_HEADERS);
      for (let i = 1; i < rawRows.length; i++) {
        const raw = rawRows[i];
        const row = {};
        let isEmpty = true;
        columnIndexes.forEach((index, canonical) => {
          let value = raw[index] !== undefined && raw[index] !== null ? raw[index] : "";
          if (dateColumns.has(canonical)) {
            value = normalizeDateValue(value);
          } else if (canonical === "Purchase Cost") {
            value = normalizeMoneyValue(value);
          } else {
            value = String(value).trim();
          }
          row[canonical] = value;
          if (value) isEmpty = false;
        });
        if (!isEmpty) rows.push(row);
      }

      return { rows, unknownHeaders, error: null };
    })
    .catch(() => ({
      rows: [],
      unknownHeaders: [],
      error: "Failed to read the file. Make sure it is a valid CSV or Excel file.",
    }));
};

/**
 * Normalises a money cell to a plain decimal string the backend's BigDecimal accepts.
 *
 * <p>Excel frequently formats costs as "$250,000.00". SheetJS hands formatted cells back as
 * locale strings and unformatted cells as numbers; both are converted to a bare number string
 * (e.g. "250000.00") so the import never trips over the currency decoration.</p>
 */
const normalizeMoneyValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return String(value);
  }
  const text = String(value).trim().replace(/[$,\s]/g, "");
  if (text === "" || text === "-" || text === "−") return "";
  return text;
};

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Formats calendar components as YYYY-MM-DD, or null when they are not a real date. */
const toIsoDate = (year, month, day) => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Reject 31 April and 30 February rather than letting them roll into the next month.
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

/**
 * Recognises the date layouts hospital spreadsheets actually contain.
 *
 * Deliberately explicit rather than handing the string to `new Date(...)`, whose behaviour on
 * anything but ISO is implementation-defined, and whose result then has to be formatted - which is
 * where the timezone bug came from. Returns null for anything not recognised, so the caller can
 * pass the cell through for the backend to report.
 *
 * Slash and dash layouts are ambiguous by nature. The rule: whichever component cannot be a month
 * decides. `13/06/2025` is day-first because there is no thirteenth month; `06/13/2025` is
 * month-first for the same reason. When both could be a month the string is read month-first,
 * matching what `new Date(...)` did before, so this change does not silently re-interpret files
 * that already imported correctly.
 */
const parseDateText = (text) => {
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text);
  if (iso) {
    return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const numeric = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const year = Number(numeric[3]);
    if (first > 12 && second <= 12) return toIsoDate(year, second, first);
    return toIsoDate(year, first, second);
  }

  // "12 June 2025", "12 Jun 2025"
  const dayFirstName = /^(\d{1,2})[\s-]+([A-Za-z]+),?[\s-]+(\d{4})$/.exec(text);
  if (dayFirstName) {
    const month = monthFromName(dayFirstName[2]);
    return month ? toIsoDate(Number(dayFirstName[3]), month, Number(dayFirstName[1])) : null;
  }

  // "June 12, 2025", "Jun 12 2025"
  const monthFirstName = /^([A-Za-z]+)[\s-]+(\d{1,2}),?[\s-]+(\d{4})$/.exec(text);
  if (monthFirstName) {
    const month = monthFromName(monthFirstName[1]);
    return month ? toIsoDate(Number(monthFirstName[3]), month, Number(monthFirstName[2])) : null;
  }

  return null;
};

/** 1-12 for a full or three-letter month name, or null. */
const monthFromName = (name) => {
  const lower = String(name).toLowerCase();
  const index = MONTH_NAMES.findIndex(
    (month) => month === lower || (lower.length >= 3 && month.startsWith(lower))
  );
  return index === -1 ? null : index + 1;
};

/**
 * Normalises a spreadsheet date cell to the YYYY-MM-DD the backend expects.
 *
 * SheetJS hands dates back as Excel serial numbers (e.g. 46550 for 2027-06-12) when the cell
 * carries a date format, and as locale-formatted strings in other cases. Both are converted to the
 * ISO date the import accepts; anything unrecognisable is passed through untouched so the backend
 * reports a clear per-row error instead of this layer silently guessing.
 *
 * The formatting is done from calendar components. The previous implementation finished with
 * `new Date(text).toISOString().slice(0, 10)`, and `new Date(...)` on a non-ISO string produces
 * local midnight while `toISOString()` converts to UTC - so in every timezone east of Greenwich,
 * including all of India, the imported date was the day before the one in the file.
 */
const normalizeDateValue = (value) => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") {
    // Excel serial dates for 1970..2100 fall in this band. Excel's epoch starts at serial 1
    // (1900-01-01), so an out-of-band number is almost certainly not a date.
    if (value >= 20000 && value <= 80000) {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        const iso = toIsoDate(date.y, date.m, date.d);
        if (iso) return iso;
      }
    }
    // Not a plausible serial. Pass it through rather than blanking the cell: a sheet that stores
    // dates as 20250612 deserves a per-row error naming the value, not an empty column.
    return String(value);
  }
  const text = String(value).trim();
  return parseDateText(text) ?? text;
};

/**
 * Spreadsheet formula triggers and the numeric exemption. Both mirror src/utils/csv.js, which
 * carries the reasoning; they are restated rather than imported because this module is also the
 * serialiser for the upload path and has to be readable without following a second file.
 */
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;
const NUMERIC_FIELD = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

/**
 * Escapes one CSV field per RFC 4180 (quotes, commas, newlines), and optionally neutralises a
 * spreadsheet formula.
 *
 * Only fields that need quoting get quoted here, unlike src/utils/csv.js which quotes everything.
 * The difference is deliberate and is not cosmetic: this serialiser's output is also uploaded to the
 * import endpoint, and the fixture files and backend tests are written against the minimal form.
 *
 * @param {*} value
 * @param {boolean} formulaSafe  prefix a leading =, +, -, @, tab or CR with a single quote
 */
const escapeCsvField = (value, formulaSafe) => {
  let text = value === null || value === undefined ? "" : String(value);
  if (formulaSafe && FORMULA_TRIGGERS.test(text) && !NUMERIC_FIELD.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
};

/**
 * Serialises parsed rows into the canonical CSV the backend imports.
 * A UTF-8 BOM is prepended so Excel on Windows reads non-ASCII names correctly.
 *
 * `formulaSafe` defaults to true because the overwhelmingly common case is a file a human opens in
 * Excel, and a security control should be on unless someone asks for it to be off.
 *
 * The one caller that asks is the import path. EquipmentList re-serialises the parsed rows and posts
 * them to the preview endpoint, and there the guard would be actively harmful: the apostrophe is not
 * interpreted by a CSV parser, so it would be stored as part of the value and every equipment code
 * beginning with a dash would arrive at the backend one character longer than the user typed.
 * Formula injection is a property of spreadsheets, not of CSV, so the mitigation belongs only on the
 * paths that end in one.
 *
 * @param {Array<object>} rows
 * @param {object} options  `{ formulaSafe: false }` for a CSV bound for a parser
 */
export const rowsToCsv = (rows, options = {}) => {
  const { formulaSafe = true } = options;
  const lines = [IMPORT_HEADERS.map((header) => escapeCsvField(header, formulaSafe)).join(",")];
  rows.forEach((row) => {
    lines.push(
      IMPORT_HEADERS.map((header) => escapeCsvField(row[header], formulaSafe)).join(",")
    );
  });
  return "\uFEFF" + lines.join("\r\n");
};

/** Triggers a browser download of a Blob. */
const downloadBlob = (blob, filename) => {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

/** Maps an equipment item (as rendered in the list) to canonical export row. */
const equipmentToRow = (item) => ({
  "Equipment Code": item.equipmentCode || item.id,
  Name: item.name || "",
  Model: item.model || "",
  "Serial Number": item.serialNumber || "",
  Department: item.department || "",
  Category: item.category || "",
  Status: item.status || "",
  "Purchase Date": item.purchaseDate || "",
  "Warranty Expiry": item.warrantyExpiry || "",
  "Purchase Cost": item.purchaseCost !== undefined && item.purchaseCost !== null ? String(item.purchaseCost) : "",
  "Useful Life (Years)": item.usefulLifeYears !== undefined && item.usefulLifeYears !== null ? String(item.usefulLifeYears) : "",
  "Depreciation Method": item.depreciationMethod || "",
  "Warranty Provider": item.warrantyProvider || "",
  "Warranty Contract Number": item.warrantyContractNumber || "",
  "Warranty Start Date": item.warrantyStartDate || "",
  "Warranty Coverage Type": item.warrantyCoverageType || "",
  "Warranty Terms": item.warrantyTerms || "",
});

/**
 * Exports the given (already filtered) equipment list as CSV.
 *
 * @param {Array} equipment the filtered inventory view
 * @param {string} filename e.g. "equipment_inventory.csv"
 */
export const exportEquipmentCsv = (equipment, filename) => {
  const csv = rowsToCsv(equipment.map(equipmentToRow));
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
};

/**
 * Exports the given (already filtered) equipment list as an Excel workbook.
 *
 * @param {Array} equipment the filtered inventory view
 * @param {string} filename e.g. "equipment_inventory.xlsx"
 */
export const exportEquipmentXlsx = (equipment, filename) => {
  const worksheet = XLSX.utils.json_to_sheet(
    equipment.map(equipmentToRow),
    { header: IMPORT_HEADERS }
  );
  worksheet["!cols"] = IMPORT_HEADERS.map(() => ({ wch: 24 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Equipment");
  XLSX.writeFile(workbook, filename);
};

/**
 * Generates a blank template for download (CSV or XLSX) with column guidance.
 */
export const buildImportTemplate = (format) => {
  const sample = {
    "Equipment Code": "EQ-001",
    Name: "MRI Scanner",
    Model: "GE Signa HDxt",
    "Serial Number": "SN-9281",
    Department: "Radiology",
    Category: "IMAGING",
    Status: "Operational",
    "Purchase Date": "2025-06-12",
    "Warranty Expiry": "2027-06-12",
    "Purchase Cost": "250000.00",
    "Useful Life (Years)": "10",
    "Depreciation Method": "STRAIGHT_LINE",
    "Warranty Provider": "GE Healthcare",
    "Warranty Contract Number": "WC-2027-001",
    "Warranty Start Date": "2025-06-12",
    "Warranty Coverage Type": "FULL_PARTS_AND_LABOR",
    "Warranty Terms": "Covers parts and labor for 2 years; travel excluded.",
  };

  if (format === "xlsx") {
    const worksheet = XLSX.utils.json_to_sheet([sample], { header: IMPORT_HEADERS });
    worksheet["!cols"] = IMPORT_HEADERS.map(() => ({ wch: 24 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "medtrack_equipment_template.xlsx");
    return;
  }

  const csv = rowsToCsv([sample]);
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "medtrack_equipment_template.csv");
};
