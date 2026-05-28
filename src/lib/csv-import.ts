// CSV import utility for database views.
// Parses RFC 4180-compliant CSV and coerces values to database property types.

import type { DatabaseProperty, PropertyType } from "@/lib/types";

// ---------------------------------------------------------------------------
// RFC 4180 parser
// ---------------------------------------------------------------------------

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

/**
 * Parse a CSV string per RFC 4180.
 * Handles quoted fields, escaped double-quotes, and CRLF/LF line endings.
 */
export function parseCSV(input: string): ParsedCSV {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        // Peek ahead: escaped quote ("") or end of quoted field
        if (i + 1 < input.length && input[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        current.push(field);
        field = "";
        i++;
      } else if (ch === "\r") {
        // CRLF or bare CR
        current.push(field);
        field = "";
        rows.push(current);
        current = [];
        i++;
        if (i < input.length && input[i] === "\n") {
          i++;
        }
      } else if (ch === "\n") {
        current.push(field);
        field = "";
        rows.push(current);
        current = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Push the last field/row if there's content
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  // Filter out completely empty trailing rows
  while (rows.length > 0 && rows[rows.length - 1].every((f) => f === "")) {
    rows.pop();
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  return { headers, rows: dataRows };
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

export interface ColumnMapping {
  /** Index of the CSV column */
  csvIndex: number;
  /** CSV header name */
  csvHeader: string;
  /** Matched database property, or null if unmatched */
  property: DatabaseProperty | null;
  /** Whether to create a new text property for this column */
  createAsNew: boolean;
}

/**
 * Match CSV headers to existing database properties by name (case-insensitive).
 * The "Title" column is handled separately and excluded from mappings.
 */
export function buildColumnMappings(
  csvHeaders: string[],
  properties: DatabaseProperty[],
): { titleIndex: number; mappings: ColumnMapping[] } {
  // Find the Title column (case-insensitive)
  const titleIndex = csvHeaders.findIndex(
    (h) => h.trim().toLowerCase() === "title",
  );

  const propsByName = new Map<string, DatabaseProperty>();
  for (const prop of properties) {
    propsByName.set(prop.name.trim().toLowerCase(), prop);
  }

  const mappings: ColumnMapping[] = [];
  for (let i = 0; i < csvHeaders.length; i++) {
    if (i === titleIndex) continue;

    const header = csvHeaders[i].trim();
    if (!header) continue;

    const matchedProp = propsByName.get(header.toLowerCase()) ?? null;

    mappings.push({
      csvIndex: i,
      csvHeader: header,
      property: matchedProp,
      createAsNew: matchedProp === null,
    });
  }

  return { titleIndex, mappings };
}

// ---------------------------------------------------------------------------
// Type coercion
// ---------------------------------------------------------------------------

const TRUE_VALUES = new Set(["true", "yes", "1"]);
const FALSE_VALUES = new Set(["false", "no", "0"]);

/**
 * Coerce a raw CSV string value into the structured value format
 * expected by the database row_values table.
 */
export function coerceValue(
  raw: string,
  type: PropertyType,
  property?: DatabaseProperty,
): { value: Record<string, unknown>; error?: string } {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return { value: getEmptyValue(type) };
  }

  switch (type) {
    case "text":
      return { value: { text: trimmed } };

    case "number": {
      const num = Number(trimmed);
      if (isNaN(num)) {
        return { value: {}, error: `Invalid number: "${trimmed}"` };
      }
      return { value: { number: num } };
    }

    case "checkbox": {
      const lower = trimmed.toLowerCase();
      if (TRUE_VALUES.has(lower)) {
        return { value: { checked: true } };
      }
      if (FALSE_VALUES.has(lower)) {
        return { value: { checked: false } };
      }
      return { value: {}, error: `Invalid checkbox value: "${trimmed}"` };
    }

    case "date": {
      // Accept ISO 8601 dates and common date formats
      const parsed = Date.parse(trimmed);
      if (isNaN(parsed)) {
        return { value: {}, error: `Invalid date: "${trimmed}"` };
      }
      // Store as ISO date string (date-only if no time component)
      const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
        ? trimmed
        : new Date(parsed).toISOString();
      return { value: { date: dateStr } };
    }

    case "url":
      return { value: { url: trimmed } };

    case "email":
      return { value: { email: trimmed } };

    case "phone":
      return { value: { phone: trimmed } };

    case "select":
    case "status": {
      // Match option by name (case-insensitive)
      if (!property) return { value: { text: trimmed } };
      const options = getSelectOptions(property.config);
      const match = options.find(
        (o) => o.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (match) {
        return { value: { option_id: match.id } };
      }
      return { value: {}, error: `Unknown option: "${trimmed}"` };
    }

    case "multi_select": {
      if (!property) return { value: { text: trimmed } };
      const options = getSelectOptions(property.config);
      const names = trimmed.split(",").map((n) => n.trim()).filter(Boolean);
      const optionIds: string[] = [];
      const errors: string[] = [];
      for (const name of names) {
        const match = options.find(
          (o) => o.name.toLowerCase() === name.toLowerCase(),
        );
        if (match) {
          optionIds.push(match.id);
        } else {
          errors.push(name);
        }
      }
      if (errors.length > 0) {
        return {
          value: optionIds.length > 0 ? { option_ids: optionIds } : {},
          error: `Unknown options: ${errors.join(", ")}`,
        };
      }
      return { value: { option_ids: optionIds } };
    }

    // Types that can't be meaningfully imported from CSV
    case "person":
    case "files":
    case "relation":
    case "formula":
    case "created_time":
    case "updated_time":
    case "created_by":
      return { value: {}, error: `Cannot import ${type} from CSV` };

    default:
      return { value: { text: trimmed } };
  }
}

function getEmptyValue(type: PropertyType): Record<string, unknown> {
  switch (type) {
    case "text":
      return { text: "" };
    case "number":
      return {};
    case "checkbox":
      return { checked: false };
    case "date":
      return {};
    case "url":
      return { url: "" };
    case "email":
      return { email: "" };
    case "phone":
      return { phone: "" };
    case "select":
    case "status":
      return {};
    case "multi_select":
      return { option_ids: [] };
    default:
      return {};
  }
}

interface SelectOption {
  id: string;
  name: string;
  color: string;
}

function getSelectOptions(config: Record<string, unknown>): SelectOption[] {
  if (Array.isArray(config.options)) {
    return config.options as SelectOption[];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Infer property type from CSV values
// ---------------------------------------------------------------------------

/**
 * Infer the most likely property type from a sample of CSV values.
 * Used when creating new properties for unmatched columns.
 */
export function inferPropertyType(values: string[]): PropertyType {
  const nonEmpty = values.map((v) => v.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return "text";

  // Check if all values are booleans
  const allBooleans = nonEmpty.every((v) => {
    const lower = v.toLowerCase();
    return TRUE_VALUES.has(lower) || FALSE_VALUES.has(lower);
  });
  if (allBooleans) return "checkbox";

  // Check if all values are numbers
  const allNumbers = nonEmpty.every((v) => !isNaN(Number(v)));
  if (allNumbers) return "number";

  // Check if all values are valid dates
  const allDates = nonEmpty.every((v) => !isNaN(Date.parse(v)));
  if (allDates && nonEmpty.length > 0) return "date";

  return "text";
}

// ---------------------------------------------------------------------------
// Import result
// ---------------------------------------------------------------------------

export interface ImportRowResult {
  /** Row index in the CSV (0-based, excluding header) */
  csvRowIndex: number;
  /** Title for the row */
  title: string;
  /** Property values keyed by property ID */
  values: Record<string, Record<string, unknown>>;
  /** Per-cell errors */
  errors: { column: string; message: string }[];
}

/**
 * Process parsed CSV rows into import-ready row data.
 * Returns structured results with per-row error tracking.
 */
export function processCSVRows(
  parsedCSV: ParsedCSV,
  titleIndex: number,
  mappings: ColumnMapping[],
): ImportRowResult[] {
  return parsedCSV.rows.map((csvRow, rowIndex) => {
    const title = titleIndex >= 0 ? (csvRow[titleIndex]?.trim() ?? "") : "";
    const values: Record<string, Record<string, unknown>> = {};
    const errors: { column: string; message: string }[] = [];

    for (const mapping of mappings) {
      if (!mapping.property) continue;

      const raw = csvRow[mapping.csvIndex] ?? "";
      const { value, error } = coerceValue(
        raw,
        mapping.property.type,
        mapping.property,
      );

      // Only set value if it has content
      if (Object.keys(value).length > 0) {
        values[mapping.property.id] = value;
      }

      if (error) {
        errors.push({ column: mapping.csvHeader, message: error });
      }
    }

    return { csvRowIndex: rowIndex, title, values, errors };
  });
}
