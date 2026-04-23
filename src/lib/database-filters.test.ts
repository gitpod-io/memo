import { describe, it, expect } from "vitest";
import {
  sortRows,
  filterRows,
  getOperatorsForType,
  getOperatorLabel,
  operatorNeedsValue,
  type SortRule,
  type FilterRule,
} from "./database-filters";
import type { DatabaseProperty, DatabaseRow } from "./types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeProp(
  id: string,
  name: string,
  type: DatabaseProperty["type"],
  config: Record<string, unknown> = {},
): DatabaseProperty {
  return {
    id,
    database_id: "db-1",
    name,
    type,
    config,
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function makeRow(
  id: string,
  title: string,
  values: Record<string, Record<string, unknown>>,
  overrides?: Partial<DatabaseRow["page"]>,
): DatabaseRow {
  const rowValues: DatabaseRow["values"] = {};
  for (const [propId, val] of Object.entries(values)) {
    rowValues[propId] = {
      id: `rv-${id}-${propId}`,
      row_id: id,
      property_id: propId,
      value: val,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
  }
  return {
    page: {
      id,
      title,
      icon: null,
      cover_url: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-15T00:00:00Z",
      created_by: "user-1",
      ...overrides,
    },
    values: rowValues,
  };
}

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const textProp = makeProp("p-text", "Name", "text");
const numberProp = makeProp("p-num", "Score", "number");
const selectProp = makeProp("p-sel", "Status", "select");
const multiSelectProp = makeProp("p-ms", "Tags", "multi_select");
const checkboxProp = makeProp("p-cb", "Done", "checkbox");
const dateProp = makeProp("p-date", "Due", "date");
const urlProp = makeProp("p-url", "Link", "url");
const createdTimeProp = makeProp("p-ct", "Created", "created_time");
const createdByProp = makeProp("p-cby", "Creator", "created_by");

const allProps = [
  textProp,
  numberProp,
  selectProp,
  multiSelectProp,
  checkboxProp,
  dateProp,
  urlProp,
  createdTimeProp,
  createdByProp,
];

const rows: DatabaseRow[] = [
  makeRow("r1", "Alpha", {
    "p-text": { value: "Alpha" },
    "p-num": { value: 10 },
    "p-sel": { value: "Done", color: "green" },
    "p-ms": { value: ["tag-a", "tag-b"] },
    "p-cb": { value: true },
    "p-date": { value: "2026-03-01" },
    "p-url": { value: "https://alpha.com" },
  }),
  makeRow("r2", "Beta", {
    "p-text": { value: "Beta" },
    "p-num": { value: 5 },
    "p-sel": { value: "In Progress", color: "blue" },
    "p-ms": { value: ["tag-c"] },
    "p-cb": { value: false },
    "p-date": { value: "2026-05-15" },
    "p-url": { value: "https://beta.com" },
  }),
  makeRow(
    "r3",
    "Gamma",
    {
      "p-text": { value: "Gamma" },
      "p-num": { value: 20 },
      "p-sel": { value: "To Do", color: "gray" },
      "p-ms": { value: [] },
      "p-cb": { value: false },
      "p-date": { value: "2026-01-10" },
    },
    {
      created_at: "2026-02-01T00:00:00Z",
      updated_at: "2026-02-15T00:00:00Z",
      created_by: "user-2",
    },
  ),
  makeRow("r4", "Delta", {
    "p-text": { value: "" },
    "p-num": { value: null as unknown as number },
  }),
];

// ---------------------------------------------------------------------------
// Sort tests
// ---------------------------------------------------------------------------

describe("sortRows", () => {
  it("returns the same array reference when no sorts", () => {
    const result = sortRows(rows, [], allProps);
    expect(result).toEqual(rows);
  });

  it("sorts by text ascending", () => {
    const sorts: SortRule[] = [{ property_id: "p-text", direction: "asc" }];
    const result = sortRows(rows, sorts, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r1", "r2", "r3", "r4"]);
  });

  it("sorts by text descending", () => {
    const sorts: SortRule[] = [{ property_id: "p-text", direction: "desc" }];
    const result = sortRows(rows, sorts, allProps);
    // Gamma > Beta > Alpha, then empty (r4) last
    expect(result.map((r) => r.page.id)).toEqual(["r3", "r2", "r1", "r4"]);
  });

  it("sorts by number ascending — null sorts last", () => {
    const sorts: SortRule[] = [{ property_id: "p-num", direction: "asc" }];
    const result = sortRows(rows, sorts, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r2", "r1", "r3", "r4"]);
  });

  it("sorts by number descending — null sorts last", () => {
    const sorts: SortRule[] = [{ property_id: "p-num", direction: "desc" }];
    const result = sortRows(rows, sorts, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r3", "r1", "r2", "r4"]);
  });

  it("sorts by select (alphabetical by option name)", () => {
    const sorts: SortRule[] = [{ property_id: "p-sel", direction: "asc" }];
    const result = sortRows(rows, sorts, allProps);
    // Done < In Progress < To Do, r4 has no select → last
    expect(result.map((r) => r.page.id)).toEqual(["r1", "r2", "r3", "r4"]);
  });

  it("sorts by checkbox — false before true ascending", () => {
    const sorts: SortRule[] = [{ property_id: "p-cb", direction: "asc" }];
    const result = sortRows(rows, sorts, allProps);
    // false (0) < true (1); r4 has no checkbox value
    const ids = result.map((r) => r.page.id);
    // r2, r3 are false (0), r1 is true (1), r4 has no value
    expect(ids.indexOf("r1")).toBeGreaterThan(ids.indexOf("r2"));
    expect(ids.indexOf("r1")).toBeGreaterThan(ids.indexOf("r3"));
  });

  it("sorts by date ascending", () => {
    const sorts: SortRule[] = [{ property_id: "p-date", direction: "asc" }];
    const result = sortRows(rows, sorts, allProps);
    // 2026-01-10 < 2026-03-01 < 2026-05-15, r4 has no date → last
    expect(result.map((r) => r.page.id)).toEqual(["r3", "r1", "r2", "r4"]);
  });

  it("sorts by multi_select (first option name)", () => {
    const sorts: SortRule[] = [{ property_id: "p-ms", direction: "asc" }];
    const result = sortRows(rows, sorts, allProps);
    // tag-a < tag-c, r3 has empty array → last, r4 has no value → last
    expect(result[0].page.id).toBe("r1");
    expect(result[1].page.id).toBe("r2");
  });

  it("sorts by computed created_time", () => {
    const sorts: SortRule[] = [{ property_id: "p-ct", direction: "asc" }];
    const result = sortRows(rows, sorts, allProps);
    // r1, r2, r4 have 2026-01-01, r3 has 2026-02-01
    expect(result[result.length - 1].page.id).toBe("r3");
  });

  it("sorts by computed created_by", () => {
    const sorts: SortRule[] = [{ property_id: "p-cby", direction: "asc" }];
    const result = sortRows(rows, sorts, allProps);
    // user-1 < user-2
    const user1Rows = result.filter((r) => r.page.created_by === "user-1");
    const user2Rows = result.filter((r) => r.page.created_by === "user-2");
    expect(result.indexOf(user1Rows[0])).toBeLessThan(
      result.indexOf(user2Rows[0]),
    );
  });

  it("applies multiple sort rules in order", () => {
    const sorts: SortRule[] = [
      { property_id: "p-cb", direction: "asc" },
      { property_id: "p-num", direction: "desc" },
    ];
    const result = sortRows(rows, sorts, allProps);
    // First sort by checkbox: false (r2=5, r3=20) then true (r1=10), r4 last
    // Within false group, sort by number desc: r3(20) > r2(5)
    expect(result[0].page.id).toBe("r3");
    expect(result[1].page.id).toBe("r2");
    expect(result[2].page.id).toBe("r1");
  });

  it("does not mutate the input array", () => {
    const original = [...rows];
    const sorts: SortRule[] = [{ property_id: "p-num", direction: "desc" }];
    sortRows(rows, sorts, allProps);
    expect(rows.map((r) => r.page.id)).toEqual(original.map((r) => r.page.id));
  });

  it("sorts text stored with type-specific key (not legacy value key)", () => {
    const prop = makeProp("p-t2", "Label", "text");
    const typedRows = [
      makeRow("t1", "Row1", { "p-t2": { text: "Cherry" } }),
      makeRow("t2", "Row2", { "p-t2": { text: "Apple" } }),
      makeRow("t3", "Row3", { "p-t2": { text: "Banana" } }),
    ];
    const sorts: SortRule[] = [{ property_id: "p-t2", direction: "asc" }];
    const result = sortRows(typedRows, sorts, [prop]);
    expect(result.map((r) => r.page.id)).toEqual(["t2", "t3", "t1"]);
  });

  it("sorts numbers stored with type-specific key", () => {
    const prop = makeProp("p-n2", "Score", "number");
    const typedRows = [
      makeRow("n1", "Row1", { "p-n2": { number: 30 } }),
      makeRow("n2", "Row2", { "p-n2": { number: 10 } }),
      makeRow("n3", "Row3", { "p-n2": { number: 20 } }),
    ];
    const sorts: SortRule[] = [{ property_id: "p-n2", direction: "asc" }];
    const result = sortRows(typedRows, sorts, [prop]);
    expect(result.map((r) => r.page.id)).toEqual(["n2", "n3", "n1"]);
  });

  it("null-sorts rows with type-specific keys correctly", () => {
    const prop = makeProp("p-t3", "Name", "text");
    const mixedRows = [
      makeRow("m1", "Row1", { "p-t3": { text: "Zebra" } }),
      makeRow("m2", "Row2", {}),
      makeRow("m3", "Row3", { "p-t3": { text: "Aardvark" } }),
    ];
    const sorts: SortRule[] = [{ property_id: "p-t3", direction: "asc" }];
    const result = sortRows(mixedRows, sorts, [prop]);
    expect(result.map((r) => r.page.id)).toEqual(["m3", "m1", "m2"]);
  });
});

// ---------------------------------------------------------------------------
// Filter tests
// ---------------------------------------------------------------------------

describe("filterRows", () => {
  it("returns all rows when no filters", () => {
    const result = filterRows(rows, [], allProps);
    expect(result).toEqual(rows);
  });

  // Text filters
  it("filters text contains", () => {
    const filters: FilterRule[] = [
      { property_id: "p-text", operator: "contains", value: "alp" },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r1"]);
  });

  it("filters text contains (case-insensitive)", () => {
    const filters: FilterRule[] = [
      { property_id: "p-text", operator: "contains", value: "BETA" },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r2"]);
  });

  it("filters text equals", () => {
    const filters: FilterRule[] = [
      { property_id: "p-text", operator: "equals", value: "gamma" },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r3"]);
  });

  it("filters text is_empty", () => {
    const filters: FilterRule[] = [
      { property_id: "p-text", operator: "is_empty", value: null },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r4"]);
  });

  it("filters text is_not_empty", () => {
    const filters: FilterRule[] = [
      { property_id: "p-text", operator: "is_not_empty", value: null },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r1", "r2", "r3"]);
  });

  // Number filters
  it("filters number equals", () => {
    const filters: FilterRule[] = [
      { property_id: "p-num", operator: "equals", value: 10 },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r1"]);
  });

  it("filters number gt", () => {
    const filters: FilterRule[] = [
      { property_id: "p-num", operator: "gt", value: 5 },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r1", "r3"]);
  });

  it("filters number lt", () => {
    const filters: FilterRule[] = [
      { property_id: "p-num", operator: "lt", value: 10 },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r2"]);
  });

  it("filters number gte", () => {
    const filters: FilterRule[] = [
      { property_id: "p-num", operator: "gte", value: 10 },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r1", "r3"]);
  });

  it("filters number lte", () => {
    const filters: FilterRule[] = [
      { property_id: "p-num", operator: "lte", value: 10 },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r1", "r2"]);
  });

  it("filters number is_empty", () => {
    const filters: FilterRule[] = [
      { property_id: "p-num", operator: "is_empty", value: null },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r4"]);
  });

  // Select filters
  it("filters select equals (legacy name format)", () => {
    const filters: FilterRule[] = [
      { property_id: "p-sel", operator: "equals", value: "Done" },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r1"]);
  });

  it("filters select equals with option_id format", () => {
    // Row with option_id format data
    const optIdRow = makeRow("r-opt", "OptRow", {
      "p-sel": { option_id: "opt-done-id" },
    });
    const filters: FilterRule[] = [
      { property_id: "p-sel", operator: "equals", value: "opt-done-id" },
    ];
    const result = filterRows([optIdRow, rows[1]], filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r-opt"]);
  });

  // Multi-select filters
  it("filters multi_select contains", () => {
    const filters: FilterRule[] = [
      { property_id: "p-ms", operator: "contains", value: "tag-a" },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r1"]);
  });

  it("filters multi_select is_empty", () => {
    const filters: FilterRule[] = [
      { property_id: "p-ms", operator: "is_empty", value: null },
    ];
    const result = filterRows(rows, filters, allProps);
    // r3 has empty array, r4 has no value
    expect(result.map((r) => r.page.id)).toEqual(["r3", "r4"]);
  });

  // Checkbox filters (legacy equals operator)
  it("filters checkbox equals true", () => {
    const filters: FilterRule[] = [
      { property_id: "p-cb", operator: "equals", value: true },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r1"]);
  });

  it("filters checkbox equals false", () => {
    const filters: FilterRule[] = [
      { property_id: "p-cb", operator: "equals", value: false },
    ];
    const result = filterRows(rows, filters, allProps);
    // r2 and r3 are false, r4 has no checkbox value (null ≠ false)
    expect(result.map((r) => r.page.id)).toEqual(["r2", "r3"]);
  });

  // Checkbox filters (new is_checked / is_not_checked operators)
  it("filters checkbox is_checked", () => {
    const filters: FilterRule[] = [
      { property_id: "p-cb", operator: "is_checked", value: null },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r1"]);
  });

  it("filters checkbox is_not_checked", () => {
    const filters: FilterRule[] = [
      { property_id: "p-cb", operator: "is_not_checked", value: null },
    ];
    const result = filterRows(rows, filters, allProps);
    // r2 and r3 are false, r4 has no checkbox value — all are "not checked"
    expect(result.map((r) => r.page.id)).toEqual(["r2", "r3", "r4"]);
  });

  // Date filters
  it("filters date equals", () => {
    const filters: FilterRule[] = [
      { property_id: "p-date", operator: "equals", value: "2026-03-01" },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r1"]);
  });

  it("filters date before", () => {
    const filters: FilterRule[] = [
      { property_id: "p-date", operator: "before", value: "2026-04-01" },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r1", "r3"]);
  });

  it("filters date after", () => {
    const filters: FilterRule[] = [
      { property_id: "p-date", operator: "after", value: "2026-04-01" },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r2"]);
  });

  // URL filters
  it("filters url contains", () => {
    const filters: FilterRule[] = [
      { property_id: "p-url", operator: "contains", value: "alpha" },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r1"]);
  });

  // Computed property filters
  it("filters created_time after", () => {
    const filters: FilterRule[] = [
      { property_id: "p-ct", operator: "after", value: "2026-01-15" },
    ];
    const result = filterRows(rows, filters, allProps);
    // r3 has created_at 2026-02-01
    expect(result.map((r) => r.page.id)).toEqual(["r3"]);
  });

  it("filters created_by contains", () => {
    const filters: FilterRule[] = [
      { property_id: "p-cby", operator: "contains", value: "user-2" },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.map((r) => r.page.id)).toEqual(["r3"]);
  });

  // AND logic
  it("applies multiple filters with AND logic", () => {
    const filters: FilterRule[] = [
      { property_id: "p-num", operator: "gte", value: 5 },
      { property_id: "p-cb", operator: "equals", value: false },
    ];
    const result = filterRows(rows, filters, allProps);
    // r2 (num=5, cb=false) and r3 (num=20, cb=false)
    expect(result.map((r) => r.page.id)).toEqual(["r2", "r3"]);
  });

  it("does not mutate the input array", () => {
    const original = [...rows];
    const filters: FilterRule[] = [
      { property_id: "p-text", operator: "contains", value: "alpha" },
    ];
    filterRows(rows, filters, allProps);
    expect(rows.map((r) => r.page.id)).toEqual(original.map((r) => r.page.id));
  });

  it("passes through rows with unknown property in filter", () => {
    const filters: FilterRule[] = [
      { property_id: "p-nonexistent", operator: "equals", value: "x" },
    ];
    const result = filterRows(rows, filters, allProps);
    expect(result.length).toBe(rows.length);
  });
});

// ---------------------------------------------------------------------------
// Utility function tests
// ---------------------------------------------------------------------------

describe("getOperatorsForType", () => {
  it("returns type-appropriate operators for number", () => {
    const ops = getOperatorsForType("number");
    expect(ops).toContain("gt");
    expect(ops).toContain("lt");
    expect(ops).not.toContain("contains");
  });

  it("returns type-appropriate operators for text", () => {
    const ops = getOperatorsForType("text");
    expect(ops).toContain("contains");
    expect(ops).toContain("equals");
    expect(ops).not.toContain("gt");
  });

  it("returns type-appropriate operators for checkbox", () => {
    const ops = getOperatorsForType("checkbox");
    expect(ops).toEqual(["is_checked", "is_not_checked"]);
  });

  it("returns type-appropriate operators for date", () => {
    const ops = getOperatorsForType("date");
    expect(ops).toContain("before");
    expect(ops).toContain("after");
    expect(ops).not.toContain("gt");
  });

  it("returns type-appropriate operators for select", () => {
    const ops = getOperatorsForType("select");
    expect(ops).toContain("equals");
    expect(ops).not.toContain("contains");
  });
});

describe("getOperatorLabel", () => {
  it("returns human-readable labels", () => {
    expect(getOperatorLabel("contains")).toBe("contains");
    expect(getOperatorLabel("equals")).toBe("is");
    expect(getOperatorLabel("is_empty")).toBe("is empty");
    expect(getOperatorLabel("gt")).toBe(">");
    expect(getOperatorLabel("before")).toBe("before");
  });
});

describe("operatorNeedsValue", () => {
  it("returns false for is_empty and is_not_empty", () => {
    expect(operatorNeedsValue("is_empty")).toBe(false);
    expect(operatorNeedsValue("is_not_empty")).toBe(false);
  });

  it("returns false for is_checked and is_not_checked", () => {
    expect(operatorNeedsValue("is_checked")).toBe(false);
    expect(operatorNeedsValue("is_not_checked")).toBe(false);
  });

  it("returns true for all other operators", () => {
    expect(operatorNeedsValue("contains")).toBe(true);
    expect(operatorNeedsValue("equals")).toBe(true);
    expect(operatorNeedsValue("gt")).toBe(true);
    expect(operatorNeedsValue("before")).toBe(true);
  });
});
