import { describe, it, expect } from "vitest";
import {
  getSelectOptions,
  getRowOptionId,
  groupRowsIntoColumns,
  resolveDropOptionId,
  UNCATEGORIZED_COLUMN_ID,
  UNCATEGORIZED_LABEL,
} from "./board-view-helpers";
import { DEFAULT_STATUS_OPTIONS } from "@/components/database/property-types/status";
import type { DatabaseProperty, DatabaseRow, RowValue } from "@/lib/types";

// ---------------------------------------------------------------------------
// Test factories
// ---------------------------------------------------------------------------

function makeProperty(
  overrides: Partial<DatabaseProperty> & { id: string; type: DatabaseProperty["type"] },
): DatabaseProperty {
  return {
    database_id: "db-1",
    name: overrides.name ?? "Prop",
    config: {},
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeRowValue(value: Record<string, unknown>, propertyId: string): RowValue {
  return {
    id: `rv-${propertyId}`,
    row_id: "row-1",
    property_id: propertyId,
    value,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function makeRow(
  id: string,
  values: Record<string, RowValue> = {},
): DatabaseRow {
  return {
    page: {
      id,
      title: `Row ${id}`,
      icon: null,
      cover_url: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      created_by: "user-1",
    },
    values,
  };
}

// ---------------------------------------------------------------------------
// getSelectOptions
// ---------------------------------------------------------------------------

describe("getSelectOptions", () => {
  it("returns config.options when present and non-empty", () => {
    const options = [
      { id: "1", name: "A", color: "blue" },
      { id: "2", name: "B", color: "red" },
    ];
    const prop = makeProperty({
      id: "p1",
      type: "select",
      config: { options },
    });
    expect(getSelectOptions(prop)).toEqual(options);
  });

  it("returns DEFAULT_STATUS_OPTIONS for status type with empty config", () => {
    const prop = makeProperty({ id: "p1", type: "status", config: {} });
    expect(getSelectOptions(prop)).toEqual(DEFAULT_STATUS_OPTIONS);
  });

  it("returns DEFAULT_STATUS_OPTIONS for status type with empty options array", () => {
    const prop = makeProperty({
      id: "p1",
      type: "status",
      config: { options: [] },
    });
    expect(getSelectOptions(prop)).toEqual(DEFAULT_STATUS_OPTIONS);
  });

  it("returns empty array for non-status type with no options", () => {
    const prop = makeProperty({ id: "p1", type: "select", config: {} });
    expect(getSelectOptions(prop)).toEqual([]);
  });

  it("prefers config.options over defaults for status type", () => {
    const custom = [{ id: "x", name: "Custom", color: "green" }];
    const prop = makeProperty({
      id: "p1",
      type: "status",
      config: { options: custom },
    });
    expect(getSelectOptions(prop)).toEqual(custom);
  });
});

// ---------------------------------------------------------------------------
// getRowOptionId
// ---------------------------------------------------------------------------

describe("getRowOptionId", () => {
  it("returns the option_id when present", () => {
    const row = makeRow("r1", {
      prop1: makeRowValue({ option_id: "opt-a" }, "prop1"),
    });
    expect(getRowOptionId(row, "prop1")).toBe("opt-a");
  });

  it("returns null when the property has no value", () => {
    const row = makeRow("r1", {});
    expect(getRowOptionId(row, "prop1")).toBeNull();
  });

  it("returns null when option_id is not a string", () => {
    const row = makeRow("r1", {
      prop1: makeRowValue({ option_id: 123 }, "prop1"),
    });
    expect(getRowOptionId(row, "prop1")).toBeNull();
  });

  it("returns null when option_id is missing from value", () => {
    const row = makeRow("r1", {
      prop1: makeRowValue({ text: "hello" }, "prop1"),
    });
    expect(getRowOptionId(row, "prop1")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// groupRowsIntoColumns
// ---------------------------------------------------------------------------

describe("groupRowsIntoColumns", () => {
  const options = [
    { id: "opt-a", name: "To Do", color: "gray" },
    { id: "opt-b", name: "In Progress", color: "blue" },
    { id: "opt-c", name: "Done", color: "green" },
  ];

  const groupByProperty = makeProperty({
    id: "status-prop",
    type: "select",
    config: { options },
  });

  it("groups rows into the correct columns", () => {
    const rows = [
      makeRow("r1", { "status-prop": makeRowValue({ option_id: "opt-a" }, "status-prop") }),
      makeRow("r2", { "status-prop": makeRowValue({ option_id: "opt-b" }, "status-prop") }),
      makeRow("r3", { "status-prop": makeRowValue({ option_id: "opt-a" }, "status-prop") }),
    ];

    const cols = groupRowsIntoColumns({
      groupByProperty,
      rows,
      hideEmptyGroups: false,
    });

    // 3 option columns + 1 uncategorized
    expect(cols).toHaveLength(4);
    expect(cols[0].id).toBe("opt-a");
    expect(cols[0].rows).toHaveLength(2);
    expect(cols[0].rows[0].page.id).toBe("r1");
    expect(cols[0].rows[1].page.id).toBe("r3");

    expect(cols[1].id).toBe("opt-b");
    expect(cols[1].rows).toHaveLength(1);

    expect(cols[2].id).toBe("opt-c");
    expect(cols[2].rows).toHaveLength(0);

    expect(cols[3].id).toBe(UNCATEGORIZED_COLUMN_ID);
    expect(cols[3].label).toBe(UNCATEGORIZED_LABEL);
    expect(cols[3].rows).toHaveLength(0);
  });

  it("places rows without a value in the uncategorized column", () => {
    const rows = [
      makeRow("r1", {}), // no value at all
      makeRow("r2", { "status-prop": makeRowValue({ text: "hello" }, "status-prop") }), // no option_id
    ];

    const cols = groupRowsIntoColumns({
      groupByProperty,
      rows,
      hideEmptyGroups: false,
    });

    const uncategorized = cols.find((c) => c.id === UNCATEGORIZED_COLUMN_ID);
    expect(uncategorized).toBeDefined();
    expect(uncategorized!.rows).toHaveLength(2);
  });

  it("returns columns with uncategorized for an empty database", () => {
    const cols = groupRowsIntoColumns({
      groupByProperty,
      rows: [],
      hideEmptyGroups: false,
    });

    // All option columns (empty) + uncategorized
    expect(cols).toHaveLength(4);
    cols.forEach((col) => expect(col.rows).toHaveLength(0));
  });

  it("hides empty columns when hideEmptyGroups is true", () => {
    const rows = [
      makeRow("r1", { "status-prop": makeRowValue({ option_id: "opt-a" }, "status-prop") }),
    ];

    const cols = groupRowsIntoColumns({
      groupByProperty,
      rows,
      hideEmptyGroups: true,
    });

    // Only opt-a has rows; opt-b, opt-c, and uncategorized are empty and hidden
    expect(cols).toHaveLength(1);
    expect(cols[0].id).toBe("opt-a");
  });

  it("shows uncategorized column when it has rows even with hideEmptyGroups", () => {
    const rows = [
      makeRow("r1", {}), // uncategorized
    ];

    const cols = groupRowsIntoColumns({
      groupByProperty,
      rows,
      hideEmptyGroups: true,
    });

    // Only uncategorized has rows
    expect(cols).toHaveLength(1);
    expect(cols[0].id).toBe(UNCATEGORIZED_COLUMN_ID);
    expect(cols[0].rows).toHaveLength(1);
  });

  it("preserves column order matching the options array", () => {
    const rows = [
      makeRow("r1", { "status-prop": makeRowValue({ option_id: "opt-c" }, "status-prop") }),
      makeRow("r2", { "status-prop": makeRowValue({ option_id: "opt-a" }, "status-prop") }),
    ];

    const cols = groupRowsIntoColumns({
      groupByProperty,
      rows,
      hideEmptyGroups: false,
    });

    expect(cols[0].id).toBe("opt-a");
    expect(cols[1].id).toBe("opt-b");
    expect(cols[2].id).toBe("opt-c");
    expect(cols[3].id).toBe(UNCATEGORIZED_COLUMN_ID);
  });

  it("handles rows with option_ids not matching any defined option", () => {
    const rows = [
      makeRow("r1", { "status-prop": makeRowValue({ option_id: "opt-unknown" }, "status-prop") }),
    ];

    const cols = groupRowsIntoColumns({
      groupByProperty,
      rows,
      hideEmptyGroups: false,
    });

    // The row has an option_id but it doesn't match any option, so it won't
    // appear in any option column. It also won't be in uncategorized because
    // it has a non-null option_id. This is the expected behavior — orphaned
    // option_ids are silently dropped from the board.
    const allRowIds = cols.flatMap((c) => c.rows.map((r) => r.page.id));
    expect(allRowIds).not.toContain("r1");
  });
});

// ---------------------------------------------------------------------------
// resolveDropOptionId
// ---------------------------------------------------------------------------

describe("resolveDropOptionId", () => {
  it("returns null for the uncategorized column", () => {
    expect(resolveDropOptionId(UNCATEGORIZED_COLUMN_ID)).toBeNull();
  });

  it("returns the column ID as the option ID for regular columns", () => {
    expect(resolveDropOptionId("opt-a")).toBe("opt-a");
    expect(resolveDropOptionId("some-id")).toBe("some-id");
  });
});
