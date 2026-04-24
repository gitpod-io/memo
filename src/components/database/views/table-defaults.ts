import type { PropertyType, RowValue, SelectOption } from "@/lib/types";
import { DEFAULT_STATUS_OPTIONS } from "@/components/database/property-types/status";

// ---------------------------------------------------------------------------
// Pure helpers for resolving default options and extracting display values
// from table cell data. Extracted from table-view.tsx to reduce file size
// and enable isolated unit testing.
// ---------------------------------------------------------------------------

/**
 * Maps a property type to the key its registry editor/renderer expects inside
 * the value object. For example, "text" → "text", "number" → "number", etc.
 * Returns "value" for types without a specific key (fallback).
 */
export function valueKeyForType(propertyType: PropertyType): string {
  switch (propertyType) {
    case "text":
      return "text";
    case "number":
      return "number";
    case "url":
      return "url";
    case "email":
      return "email";
    case "phone":
      return "phone";
    case "checkbox":
      return "checked";
    case "date":
      return "date";
    default:
      return "value";
  }
}

/**
 * Resolves the options array for a select/multi_select/status property.
 * Falls back to `DEFAULT_STATUS_OPTIONS` for status properties with no
 * configured options.
 */
export function getSelectOptions(
  config: Record<string, unknown>,
  type?: PropertyType,
): SelectOption[] {
  if (Array.isArray(config.options) && config.options.length > 0) {
    return config.options as SelectOption[];
  }
  if (type === "status") return DEFAULT_STATUS_OPTIONS;
  return [];
}

/**
 * Extracts a human-readable display string from a row value, reading from
 * the type-specific key first and falling back to the legacy generic "value"
 * key for data saved before the format was corrected.
 */
export function extractDisplayValue(
  value: RowValue | undefined,
  propertyType: PropertyType,
): string {
  if (!value) return "";

  const raw = value.value;
  if (!raw) return "";

  const key = valueKeyForType(propertyType);
  const typed = raw[key];
  const legacy = raw.value;

  switch (propertyType) {
    case "checkbox": {
      const checked = typed ?? legacy;
      return checked === true ? "true" : checked === false ? "false" : "";
    }
    case "select":
    case "multi_select":
    case "status":
      // Select/multi-select/status rendering is handled directly by CellRenderer
      // using option IDs from the raw value and the property config.
      return "";
    default: {
      const inner = typed ?? legacy;
      if (typeof inner === "string") return inner;
      if (typeof inner === "number") return String(inner);
      if (inner === null || inner === undefined) return "";
      return String(inner);
    }
  }
}

/**
 * Formats an ISO date string into a short human-readable form
 * (e.g. "Apr 24, 2026"). Returns the input as-is if parsing fails.
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (_e) {
    // Invalid date string — return as-is rather than crashing
    return dateStr;
  }
}
