// CSV export utility for database views.
// Serializes database rows to RFC 4180-compliant CSV.

import type {
  DatabaseProperty,
  DatabaseRow,
  SelectOption,
} from "@/lib/types";
import { isComputedType, buildComputedValue } from "@/components/database/property-types";
import { evaluateFormulaForRow } from "@/components/database/property-types/formula";

// ---------------------------------------------------------------------------
// RFC 4180 helpers
// ---------------------------------------------------------------------------

/** Escape a value per RFC 4180: wrap in quotes if it contains commas, quotes, or newlines. */
export function escapeCSVField(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Per-type value serialization
// ---------------------------------------------------------------------------

function getSelectOptions(config: Record<string, unknown>): SelectOption[] {
  if (Array.isArray(config.options)) {
    return config.options as SelectOption[];
  }
  return [];
}

interface PersonInfo {
  id: string;
  display_name: string;
}

function getMembers(config: Record<string, unknown>): PersonInfo[] {
  if (Array.isArray(config._members)) {
    return config._members as PersonInfo[];
  }
  return [];
}

/**
 * Serialize a single cell value to a plain-text string for CSV export.
 * Each property type has its own serialization logic matching the acceptance criteria.
 */
export function serializeCellValue(
  property: DatabaseProperty,
  value: Record<string, unknown>,
): string {
  switch (property.type) {
    case "text": {
      const text =
        typeof value.text === "string"
          ? value.text
          : typeof value.value === "string"
            ? value.value
            : "";
      return text;
    }

    case "number": {
      const num = value.number ?? value.value;
      if (num === null || num === undefined || num === "") return "";
      return String(num);
    }

    case "select":
    case "status": {
      const optionId =
        typeof value.option_id === "string" ? value.option_id : null;
      if (!optionId) return "";
      const options = getSelectOptions(property.config);
      const option = options.find((o) => o.id === optionId);
      return option?.name ?? "";
    }

    case "multi_select": {
      const optionIds = Array.isArray(value.option_ids)
        ? (value.option_ids as string[])
        : [];
      if (optionIds.length === 0) return "";
      const options = getSelectOptions(property.config);
      const optionMap = new Map(options.map((o) => [o.id, o.name]));
      return optionIds
        .map((id) => optionMap.get(id) ?? "")
        .filter(Boolean)
        .join(", ");
    }

    case "checkbox": {
      const checked = value.checked === true;
      return String(checked);
    }

    case "date": {
      const date =
        typeof value.date === "string"
          ? value.date
          : typeof value.value === "string"
            ? value.value
            : "";
      return date;
    }

    case "url": {
      return typeof value.url === "string"
        ? value.url
        : typeof value.value === "string"
          ? value.value
          : "";
    }

    case "email": {
      return typeof value.email === "string"
        ? value.email
        : typeof value.value === "string"
          ? value.value
          : "";
    }

    case "phone": {
      return typeof value.phone === "string"
        ? value.phone
        : typeof value.value === "string"
          ? value.value
          : "";
    }

    case "person": {
      const userIds = Array.isArray(value.user_ids)
        ? (value.user_ids as string[])
        : [];
      if (userIds.length === 0) return "";
      const members = getMembers(property.config);
      const memberMap = new Map(members.map((m) => [m.id, m.display_name]));
      return userIds
        .map((id) => memberMap.get(id) ?? id)
        .join(", ");
    }

    case "files": {
      const files = Array.isArray(value.files)
        ? (value.files as { name?: string; url?: string }[])
        : [];
      return files
        .map((f) => (typeof f.url === "string" ? f.url : ""))
        .filter(Boolean)
        .join(", ");
    }

    case "relation": {
      // Relation values store page_ids. If _resolved_titles is available
      // (populated by the export function before serialization), use those.
      // Otherwise fall back to raw page IDs.
      const pageIds = Array.isArray(value.page_ids)
        ? (value.page_ids as string[])
        : [];
      if (pageIds.length === 0) return "";
      const resolvedTitles = value._resolved_titles as
        | Record<string, string>
        | undefined;
      if (resolvedTitles) {
        return pageIds
          .map((id) => resolvedTitles[id] ?? id)
          .join(", ");
      }
      return pageIds.join(", ");
    }

    case "formula": {
      const display =
        typeof value._display === "string" ? value._display : "";
      return display;
    }

    case "created_time": {
      return typeof value.created_at === "string" ? value.created_at : "";
    }

    case "updated_time": {
      return typeof value.updated_at === "string" ? value.updated_at : "";
    }

    case "created_by": {
      const userId =
        typeof value.created_by === "string" ? value.created_by : "";
      if (!userId) return "";
      const members = getMembers(property.config);
      const member = members.find((m) => m.id === userId);
      return member?.display_name ?? userId;
    }

    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Row serialization
// ---------------------------------------------------------------------------

/**
 * Get the effective value for a cell, handling computed types and formulas.
 */
function getCellValue(
  property: DatabaseProperty,
  row: DatabaseRow,
  allProperties: DatabaseProperty[],
): Record<string, unknown> {
  if (isComputedType(property.type)) {
    return buildComputedValue(property.type, row.page);
  }
  if (property.type === "formula") {
    return evaluateFormulaForRow(property, row, allProperties);
  }
  return row.values[property.id]?.value ?? {};
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

export interface SerializeRowsToCSVOptions {
  /** Resolved relation page titles: { pageId: title } */
  resolvedRelationTitles?: Record<string, string>;
}

/**
 * Serialize database rows to a CSV string.
 *
 * The first column is always "Title" (the row's page title).
 * Subsequent columns follow property order.
 */
export function serializeRowsToCSV(
  rows: DatabaseRow[],
  properties: DatabaseProperty[],
  options?: SerializeRowsToCSVOptions,
): string {
  const resolvedTitles = options?.resolvedRelationTitles ?? {};

  // Header row: Title + property names
  const headers = ["Title", ...properties.map((p) => p.name)];
  const headerLine = headers.map(escapeCSVField).join(",");

  // Data rows
  const dataLines = rows.map((row) => {
    const title = row.page.title || "Untitled";
    const cells = properties.map((prop) => {
      const rawValue = getCellValue(prop, row, properties);

      // Inject resolved relation titles into the value for serialization
      const value =
        prop.type === "relation" && Object.keys(resolvedTitles).length > 0
          ? { ...rawValue, _resolved_titles: resolvedTitles }
          : rawValue;

      return serializeCellValue(prop, value);
    });

    return [title, ...cells].map(escapeCSVField).join(",");
  });

  return [headerLine, ...dataLines].join("\r\n");
}

// ---------------------------------------------------------------------------
// Download trigger (browser-only, same pattern as markdown export)
// ---------------------------------------------------------------------------

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Collect all relation page IDs from rows for batch resolution
// ---------------------------------------------------------------------------

export function collectRelationPageIds(
  rows: DatabaseRow[],
  properties: DatabaseProperty[],
): string[] {
  const relationProps = properties.filter((p) => p.type === "relation");
  if (relationProps.length === 0) return [];

  const ids = new Set<string>();
  for (const row of rows) {
    for (const prop of relationProps) {
      const value = row.values[prop.id]?.value;
      if (value && Array.isArray(value.page_ids)) {
        for (const id of value.page_ids) {
          if (typeof id === "string") ids.add(id);
        }
      }
    }
  }
  return Array.from(ids);
}
