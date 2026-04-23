// Pure sort and filter functions for database rows.
// Operates on loaded DatabaseRow[] — no data fetching.

import type {
  DatabaseProperty,
  DatabaseRow,
  PropertyType,
  RowValue,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SortRule {
  property_id: string;
  direction: "asc" | "desc";
}

export type FilterOperator =
  | "contains"
  | "equals"
  | "is_empty"
  | "is_not_empty"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "before"
  | "after"
  | "is_checked"
  | "is_not_checked";

export interface FilterRule {
  property_id: string;
  operator: FilterOperator;
  value: unknown;
}

// ---------------------------------------------------------------------------
// Operator registry per property type
// ---------------------------------------------------------------------------

const TEXT_OPERATORS: FilterOperator[] = [
  "contains",
  "equals",
  "is_empty",
  "is_not_empty",
];
const NUMBER_OPERATORS: FilterOperator[] = [
  "equals",
  "gt",
  "lt",
  "gte",
  "lte",
  "is_empty",
  "is_not_empty",
];
const SELECT_OPERATORS: FilterOperator[] = [
  "equals",
  "is_empty",
  "is_not_empty",
];
const MULTI_SELECT_OPERATORS: FilterOperator[] = [
  "contains",
  "is_empty",
  "is_not_empty",
];
const CHECKBOX_OPERATORS: FilterOperator[] = ["is_checked", "is_not_checked"];
const DATE_OPERATORS: FilterOperator[] = [
  "equals",
  "before",
  "after",
  "is_empty",
  "is_not_empty",
];
const PERSON_OPERATORS: FilterOperator[] = [
  "contains",
  "is_empty",
  "is_not_empty",
];
const STRING_LIKE_OPERATORS: FilterOperator[] = [
  "contains",
  "equals",
  "is_empty",
  "is_not_empty",
];

const OPERATORS_BY_TYPE: Record<PropertyType, FilterOperator[]> = {
  text: TEXT_OPERATORS,
  number: NUMBER_OPERATORS,
  select: SELECT_OPERATORS,
  multi_select: MULTI_SELECT_OPERATORS,
  status: SELECT_OPERATORS,
  checkbox: CHECKBOX_OPERATORS,
  date: DATE_OPERATORS,
  url: STRING_LIKE_OPERATORS,
  email: STRING_LIKE_OPERATORS,
  phone: STRING_LIKE_OPERATORS,
  person: PERSON_OPERATORS,
  files: ["is_empty", "is_not_empty"],
  relation: ["contains", "is_empty", "is_not_empty"],
  formula: TEXT_OPERATORS,
  created_time: DATE_OPERATORS,
  updated_time: DATE_OPERATORS,
  created_by: PERSON_OPERATORS,
};

/** Return the valid filter operators for a given property type. */
export function getOperatorsForType(type: PropertyType): FilterOperator[] {
  return OPERATORS_BY_TYPE[type] ?? TEXT_OPERATORS;
}

/** Human-readable label for a filter operator. */
export function getOperatorLabel(operator: FilterOperator): string {
  switch (operator) {
    case "contains":
      return "contains";
    case "equals":
      return "is";
    case "is_empty":
      return "is empty";
    case "is_not_empty":
      return "is not empty";
    case "gt":
      return ">";
    case "lt":
      return "<";
    case "gte":
      return "≥";
    case "lte":
      return "≤";
    case "before":
      return "before";
    case "after":
      return "after";
    case "is_checked":
      return "is checked";
    case "is_not_checked":
      return "is not checked";
  }
}

/** Whether the operator requires a user-provided value. */
export function operatorNeedsValue(operator: FilterOperator): boolean {
  return (
    operator !== "is_empty" &&
    operator !== "is_not_empty" &&
    operator !== "is_checked" &&
    operator !== "is_not_checked"
  );
}

// ---------------------------------------------------------------------------
// Value extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract a comparable primitive from a RowValue.
 * RowValue.value is `Record<string, unknown>` — the inner shape depends on
 * the property type. Newer data uses type-specific keys (text, number,
 * checked, date, option_id, etc.), while legacy data uses a generic `value` key.
 */
function extractPrimitive(
  rv: RowValue | undefined,
): string | number | boolean | null {
  if (!rv) return null;
  const raw = rv.value;
  if (!raw) return null;

  // Try type-specific keys first, then fall back to legacy `value` key
  const candidates = [
    raw.text,
    raw.number,
    raw.checked,
    raw.date,
    raw.url,
    raw.email,
    raw.phone,
    raw.value,
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null && c !== "") {
      return c as string | number | boolean;
    }
  }
  return null;
}

/**
 * Extract a string value for text-like comparisons.
 */
function extractString(rv: RowValue | undefined): string {
  const v = extractPrimitive(rv);
  if (v === null) return "";
  return String(v);
}

/**
 * Extract a numeric value.
 */
function extractNumber(rv: RowValue | undefined): number | null {
  if (!rv) return null;
  const raw = rv.value;
  if (!raw) return null;
  const v = raw.number ?? raw.value;
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/**
 * Extract a date string (ISO 8601) for date comparisons.
 */
function extractDate(rv: RowValue | undefined): string | null {
  if (!rv) return null;
  const raw = rv.value;
  if (!raw) return null;
  const v = raw.date ?? raw.value;
  if (v === undefined || v === null || v === "") return null;
  return String(v);
}

/**
 * Extract the select option_id from a select/status value.
 * Newer data stores `{ option_id: "uuid" }`, legacy stores `{ value: "name" }`.
 */
function extractSelectId(rv: RowValue | undefined): string | null {
  if (!rv) return null;
  const raw = rv.value;
  if (!raw) return null;
  if (typeof raw.option_id === "string" && raw.option_id) return raw.option_id;
  // Legacy format: value is the option name string
  if (typeof raw.value === "string" && raw.value) return raw.value;
  return null;
}

/**
 * Check if a RowValue is empty (no value set or value is null/empty string).
 */
function isEmpty(rv: RowValue | undefined): boolean {
  if (!rv) return true;
  const raw = rv.value;
  if (!raw) return true;

  // Check type-specific keys
  for (const key of [
    "text", "number", "checked", "date", "url", "email", "phone",
    "option_id", "option_ids", "value",
  ]) {
    const v = raw[key];
    if (v !== undefined && v !== null && v !== "") {
      if (Array.isArray(v) && v.length === 0) continue;
      return false;
    }
  }
  return true;
}

/**
 * Extract multi-select option IDs.
 * Newer data stores `{ option_ids: string[] }`, legacy stores `{ value: string[] }`.
 */
function extractMultiSelectValues(rv: RowValue | undefined): string[] {
  if (!rv) return [];
  const raw = rv.value;
  if (!raw) return [];
  if (Array.isArray(raw.option_ids)) return raw.option_ids.map(String);
  if (Array.isArray(raw.value)) return raw.value.map(String);
  return [];
}

/**
 * Get a computed property value from page metadata.
 * Computed types (created_time, updated_time, created_by) derive from the page.
 */
function getComputedValue(
  row: DatabaseRow,
  type: PropertyType,
): string | null {
  switch (type) {
    case "created_time":
      return row.page.created_at ?? null;
    case "updated_time":
      return row.page.updated_at ?? null;
    case "created_by":
      return row.page.created_by ?? null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

/**
 * Sort rows by multiple criteria. Null/empty values sort last regardless of
 * direction. Returns a new array (does not mutate the input).
 */
export function sortRows(
  rows: DatabaseRow[],
  sorts: SortRule[],
  properties: DatabaseProperty[],
): DatabaseRow[] {
  if (sorts.length === 0) return rows;

  const propMap = new Map(properties.map((p) => [p.id, p]));

  return [...rows].sort((a, b) => {
    for (const sort of sorts) {
      const prop = propMap.get(sort.property_id);
      if (!prop) continue;

      const result = compareForSort(a, b, prop, sort.direction);
      if (result !== 0) return result;
    }
    return 0;
  });
}

/**
 * Compare two rows for sorting. Null/empty values always sort last,
 * regardless of direction. Non-null values are compared normally and
 * the direction is applied.
 */
function compareForSort(
  a: DatabaseRow,
  b: DatabaseRow,
  prop: DatabaseProperty,
  direction: "asc" | "desc",
): number {
  const aIsNull = isValueNull(a, prop);
  const bIsNull = isValueNull(b, prop);

  // Both null → equal
  if (aIsNull && bIsNull) return 0;
  // Null always sorts last regardless of direction
  if (aIsNull) return 1;
  if (bIsNull) return -1;

  const cmp = compareValues(a, b, prop);
  return direction === "asc" ? cmp : -cmp;
}

/**
 * Check if a row's value for a property is null/empty.
 */
function isValueNull(row: DatabaseRow, prop: DatabaseProperty): boolean {
  const isComputed =
    prop.type === "created_time" ||
    prop.type === "updated_time" ||
    prop.type === "created_by";

  if (isComputed) {
    return getComputedValue(row, prop.type) === null;
  }

  const rv = row.values[prop.id];
  if (!rv) return true;
  const inner = rv.value?.value;
  if (inner === undefined || inner === null || inner === "") return true;
  if (Array.isArray(inner) && inner.length === 0) return true;
  return false;
}

/**
 * Compare two rows by a single property. Returns negative if a < b,
 * positive if a > b, 0 if equal. Assumes both values are non-null.
 */
function compareValues(
  a: DatabaseRow,
  b: DatabaseRow,
  prop: DatabaseProperty,
): number {
  const isComputed =
    prop.type === "created_time" ||
    prop.type === "updated_time" ||
    prop.type === "created_by";

  if (isComputed) {
    const va = getComputedValue(a, prop.type);
    const vb = getComputedValue(b, prop.type);
    if (va === null || vb === null) return 0; // handled by compareForSort
    if (prop.type === "created_by") {
      return va.localeCompare(vb);
    }
    return va < vb ? -1 : va > vb ? 1 : 0;
  }

  const rvA = a.values[prop.id];
  const rvB = b.values[prop.id];

  switch (prop.type) {
    case "text":
    case "url":
    case "email":
    case "phone":
    case "formula": {
      const sa = extractString(rvA);
      const sb = extractString(rvB);
      return sa.localeCompare(sb);
    }

    case "number": {
      const na = extractNumber(rvA) ?? 0;
      const nb = extractNumber(rvB) ?? 0;
      return na - nb;
    }

    case "select": {
      const sa = extractString(rvA);
      const sb = extractString(rvB);
      return sa.localeCompare(sb);
    }

    case "multi_select": {
      const msA = extractMultiSelectValues(rvA);
      const msB = extractMultiSelectValues(rvB);
      const firstA = msA[0] ?? "";
      const firstB = msB[0] ?? "";
      return firstA.localeCompare(firstB);
    }

    case "checkbox": {
      const ca = extractPrimitive(rvA);
      const cb = extractPrimitive(rvB);
      const ba = ca === true ? 1 : 0;
      const bb = cb === true ? 1 : 0;
      return ba - bb;
    }

    case "date": {
      const da = extractDate(rvA) ?? "";
      const db = extractDate(rvB) ?? "";
      return da < db ? -1 : da > db ? 1 : 0;
    }

    case "person": {
      const pa = extractString(rvA);
      const pb = extractString(rvB);
      return pa.localeCompare(pb);
    }

    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

/**
 * Filter rows by multiple criteria (AND logic — all must match).
 * Returns a new array.
 */
export function filterRows(
  rows: DatabaseRow[],
  filters: FilterRule[],
  properties: DatabaseProperty[],
): DatabaseRow[] {
  if (filters.length === 0) return rows;

  const propMap = new Map(properties.map((p) => [p.id, p]));

  return rows.filter((row) =>
    filters.every((filter) => {
      const prop = propMap.get(filter.property_id);
      if (!prop) return true; // unknown property — don't filter out
      return matchesFilter(row, prop, filter);
    }),
  );
}

/**
 * Check if a single row matches a single filter rule.
 */
function matchesFilter(
  row: DatabaseRow,
  prop: DatabaseProperty,
  filter: FilterRule,
): boolean {
  const isComputed =
    prop.type === "created_time" ||
    prop.type === "updated_time" ||
    prop.type === "created_by";

  // Handle is_empty / is_not_empty for all types
  if (filter.operator === "is_empty") {
    if (isComputed) {
      return getComputedValue(row, prop.type) === null;
    }
    return isEmpty(row.values[prop.id]);
  }
  if (filter.operator === "is_not_empty") {
    if (isComputed) {
      return getComputedValue(row, prop.type) !== null;
    }
    return !isEmpty(row.values[prop.id]);
  }

  // Handle checkbox operators (no value needed)
  if (filter.operator === "is_checked") {
    const rv = row.values[prop.id];
    return extractPrimitive(rv) === true;
  }
  if (filter.operator === "is_not_checked") {
    const rv = row.values[prop.id];
    return extractPrimitive(rv) !== true;
  }

  // Computed properties
  if (isComputed) {
    const cv = getComputedValue(row, prop.type);
    if (cv === null) return false;

    if (prop.type === "created_by") {
      return matchStringFilter(cv, filter);
    }
    // Date-based computed properties
    return matchDateFilter(cv, filter);
  }

  const rv = row.values[prop.id];

  switch (prop.type) {
    case "text":
    case "url":
    case "email":
    case "phone":
    case "formula":
      return matchStringFilter(extractString(rv), filter);

    case "number":
      return matchNumberFilter(extractNumber(rv), filter);

    case "select":
    case "status":
      return matchSelectFilter(extractSelectId(rv), filter);

    case "multi_select":
      return matchMultiSelectFilter(extractMultiSelectValues(rv), filter);

    case "checkbox":
      return matchCheckboxFilter(extractPrimitive(rv), filter);

    case "date":
      return matchDateFilter(extractDate(rv), filter);

    case "person":
      return matchStringFilter(extractString(rv), filter);

    default:
      return true;
  }
}

function matchStringFilter(value: string, filter: FilterRule): boolean {
  const filterVal = String(filter.value ?? "");
  switch (filter.operator) {
    case "contains":
      return value.toLowerCase().includes(filterVal.toLowerCase());
    case "equals":
      return value.toLowerCase() === filterVal.toLowerCase();
    default:
      return true;
  }
}

function matchNumberFilter(
  value: number | null,
  filter: FilterRule,
): boolean {
  if (value === null) return false;
  const filterVal = Number(filter.value);
  if (Number.isNaN(filterVal)) return false;

  switch (filter.operator) {
    case "equals":
      return value === filterVal;
    case "gt":
      return value > filterVal;
    case "lt":
      return value < filterVal;
    case "gte":
      return value >= filterVal;
    case "lte":
      return value <= filterVal;
    default:
      return true;
  }
}

function matchSelectFilter(
  value: string | null,
  filter: FilterRule,
): boolean {
  if (value === null) return false;
  const filterVal = String(filter.value ?? "");
  switch (filter.operator) {
    case "equals":
      // Match by option ID or by name (case-insensitive for legacy data)
      return (
        value === filterVal || value.toLowerCase() === filterVal.toLowerCase()
      );
    default:
      return true;
  }
}

function matchMultiSelectFilter(
  values: string[],
  filter: FilterRule,
): boolean {
  const filterVal = String(filter.value ?? "");
  switch (filter.operator) {
    case "contains":
      // Match by option ID or by name (case-insensitive for legacy data)
      return values.some(
        (v) =>
          v === filterVal || v.toLowerCase() === filterVal.toLowerCase(),
      );
    default:
      return true;
  }
}

function matchCheckboxFilter(
  value: string | number | boolean | null,
  filter: FilterRule,
): boolean {
  if (filter.operator !== "equals") return true;
  // No value set → does not match either true or false
  if (value === null) return false;
  const expected =
    filter.value === true ||
    filter.value === "true" ||
    filter.value === 1;
  const actual = value === true;
  return actual === expected;
}

function matchDateFilter(
  value: string | null,
  filter: FilterRule,
): boolean {
  if (value === null) return false;
  const filterVal = String(filter.value ?? "");
  if (!filterVal) return false;

  switch (filter.operator) {
    case "equals":
      // Compare date portion only (YYYY-MM-DD)
      return value.slice(0, 10) === filterVal.slice(0, 10);
    case "before":
      return value < filterVal;
    case "after":
      return value > filterVal;
    default:
      return true;
  }
}
