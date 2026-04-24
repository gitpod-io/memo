import { describe, it, expect } from "vitest";
import {
  valueKeyForType,
  getSelectOptions,
  extractDisplayValue,
  formatDate,
} from "./table-defaults";
import { DEFAULT_STATUS_OPTIONS } from "@/components/database/property-types/status";
import type { PropertyType, RowValue } from "@/lib/types";

/** Build a minimal RowValue for testing — only `value` matters for these tests. */
function makeRowValue(value: Record<string, unknown>): RowValue {
  return {
    id: "test-id",
    row_id: "test-row",
    property_id: "test-prop",
    value,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// valueKeyForType
// ---------------------------------------------------------------------------

describe("valueKeyForType", () => {
  it.each([
    ["text", "text"],
    ["number", "number"],
    ["url", "url"],
    ["email", "email"],
    ["phone", "phone"],
    ["checkbox", "checked"],
    ["date", "date"],
  ] as [PropertyType, string][])(
    "returns '%s' for property type '%s'",
    (type, expectedKey) => {
      expect(valueKeyForType(type)).toBe(expectedKey);
    },
  );

  it("returns 'value' for unknown/fallback types", () => {
    expect(valueKeyForType("select")).toBe("value");
    expect(valueKeyForType("multi_select")).toBe("value");
    expect(valueKeyForType("status")).toBe("value");
    expect(valueKeyForType("formula")).toBe("value");
    expect(valueKeyForType("created_time")).toBe("value");
  });
});

// ---------------------------------------------------------------------------
// getSelectOptions
// ---------------------------------------------------------------------------

describe("getSelectOptions", () => {
  it("returns config.options when present and non-empty", () => {
    const options = [
      { id: "1", name: "A", color: "blue" },
      { id: "2", name: "B", color: "red" },
    ];
    expect(getSelectOptions({ options })).toEqual(options);
  });

  it("returns DEFAULT_STATUS_OPTIONS for status type with empty config", () => {
    expect(getSelectOptions({}, "status")).toEqual(DEFAULT_STATUS_OPTIONS);
  });

  it("returns DEFAULT_STATUS_OPTIONS for status type with empty options array", () => {
    expect(getSelectOptions({ options: [] }, "status")).toEqual(DEFAULT_STATUS_OPTIONS);
  });

  it("returns empty array for non-status type with empty config", () => {
    expect(getSelectOptions({})).toEqual([]);
    expect(getSelectOptions({}, "select")).toEqual([]);
    expect(getSelectOptions({}, "multi_select")).toEqual([]);
  });

  it("prefers config.options over defaults even for status type", () => {
    const custom = [{ id: "x", name: "Custom", color: "green" }];
    expect(getSelectOptions({ options: custom }, "status")).toEqual(custom);
  });
});

// ---------------------------------------------------------------------------
// extractDisplayValue
// ---------------------------------------------------------------------------

describe("extractDisplayValue", () => {
  it("returns empty string for undefined value", () => {
    expect(extractDisplayValue(undefined, "text")).toBe("");
  });

  it("returns empty string when value.value is null", () => {
    const val = { value: null } as unknown as RowValue;
    expect(extractDisplayValue(val, "text")).toBe("");
  });

  it("reads from type-specific key for text", () => {
    const val = makeRowValue({ text: "hello" });
    expect(extractDisplayValue(val, "text")).toBe("hello");
  });

  it("reads from type-specific key for number", () => {
    const val = makeRowValue({ number: 42 });
    expect(extractDisplayValue(val, "number")).toBe("42");
  });

  it("falls back to legacy 'value' key", () => {
    const val = makeRowValue({ value: "legacy" });
    expect(extractDisplayValue(val, "text")).toBe("legacy");
  });

  it("prefers type-specific key over legacy key", () => {
    const val = makeRowValue({ text: "typed", value: "legacy" });
    expect(extractDisplayValue(val, "text")).toBe("typed");
  });

  it("returns 'true' for checked checkbox", () => {
    const val = makeRowValue({ checked: true });
    expect(extractDisplayValue(val, "checkbox")).toBe("true");
  });

  it("returns 'false' for unchecked checkbox", () => {
    const val = makeRowValue({ checked: false });
    expect(extractDisplayValue(val, "checkbox")).toBe("false");
  });

  it("returns empty string for select/multi_select/status types", () => {
    const val = makeRowValue({ option_id: "abc" });
    expect(extractDisplayValue(val, "select")).toBe("");
    expect(extractDisplayValue(val, "multi_select")).toBe("");
    expect(extractDisplayValue(val, "status")).toBe("");
  });

  it("returns empty string for null inner value", () => {
    const val = makeRowValue({ text: null });
    expect(extractDisplayValue(val, "text")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate", () => {
  it("returns empty string for empty input", () => {
    expect(formatDate("")).toBe("");
  });

  it("formats a valid ISO date string", () => {
    const result = formatDate("2026-04-24T12:00:00Z");
    expect(result).toMatch(/Apr\s+24,\s+2026/);
  });

  it("returns the input as-is for an invalid date", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });

  it("handles date-only strings", () => {
    const result = formatDate("2025-01-15");
    expect(result).toMatch(/Jan\s+1[45],\s+2025/);
  });
});
