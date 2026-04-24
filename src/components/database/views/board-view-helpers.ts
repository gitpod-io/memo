// Pure functions for board-view grouping and drag-and-drop resolution.
// No React dependencies — all computation is side-effect-free.

import { DEFAULT_STATUS_OPTIONS } from "@/components/database/property-types/status";
import type {
  DatabaseProperty,
  DatabaseRow,
  SelectOption,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const UNCATEGORIZED_COLUMN_ID = "__uncategorized__";
export const UNCATEGORIZED_LABEL = "No value";

// ---------------------------------------------------------------------------
// Column data type
// ---------------------------------------------------------------------------

export interface ColumnData {
  id: string;
  label: string;
  color: string;
  rows: DatabaseRow[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the effective select/status options for a property. */
export function getSelectOptions(property: DatabaseProperty): SelectOption[] {
  if (Array.isArray(property.config.options) && property.config.options.length > 0) {
    return property.config.options as SelectOption[];
  }
  if (property.type === "status") {
    return DEFAULT_STATUS_OPTIONS;
  }
  return [];
}

/** Extract the option_id from a row's value for a given property. */
export function getRowOptionId(row: DatabaseRow, propertyId: string): string | null {
  const rv = row.values[propertyId];
  if (!rv) return null;
  const optionId = rv.value?.option_id;
  return typeof optionId === "string" ? optionId : null;
}

// ---------------------------------------------------------------------------
// Column grouping
// ---------------------------------------------------------------------------

export interface GroupColumnsOptions {
  groupByProperty: DatabaseProperty;
  rows: DatabaseRow[];
  hideEmptyGroups: boolean;
}

/**
 * Group rows into board columns based on a select/status property.
 * Returns one column per option, plus an uncategorized column for rows
 * without a value (or when hideEmptyGroups is false).
 */
export function groupRowsIntoColumns({
  groupByProperty,
  rows,
  hideEmptyGroups,
}: GroupColumnsOptions): ColumnData[] {
  const options = getSelectOptions(groupByProperty);

  // Group rows by option_id
  const rowsByOption = new Map<string, DatabaseRow[]>();
  const uncategorized: DatabaseRow[] = [];

  for (const row of rows) {
    const optionId = getRowOptionId(row, groupByProperty.id);
    if (!optionId) {
      uncategorized.push(row);
    } else {
      const existing = rowsByOption.get(optionId);
      if (existing) {
        existing.push(row);
      } else {
        rowsByOption.set(optionId, [row]);
      }
    }
  }

  const cols: ColumnData[] = [];

  for (const option of options) {
    const columnRows = rowsByOption.get(option.id) ?? [];
    if (hideEmptyGroups && columnRows.length === 0) continue;
    cols.push({
      id: option.id,
      label: option.name,
      color: option.color,
      rows: columnRows,
    });
  }

  // Uncategorized column last
  if (uncategorized.length > 0 || !hideEmptyGroups) {
    cols.push({
      id: UNCATEGORIZED_COLUMN_ID,
      label: UNCATEGORIZED_LABEL,
      color: "gray",
      rows: uncategorized,
    });
  }

  return cols;
}

// ---------------------------------------------------------------------------
// Drag-and-drop resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a drop target column ID to the option_id that should be set on the
 * moved card. Returns `null` for the uncategorized column (clear the value).
 */
export function resolveDropOptionId(columnId: string): string | null {
  return columnId === UNCATEGORIZED_COLUMN_ID ? null : columnId;
}
