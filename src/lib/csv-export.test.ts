import { describe, it, expect } from "vitest";
import {
  escapeCSVField,
  serializeCellValue,
  serializeRowsToCSV,
  collectRelationPageIds,
} from "./csv-export";
import type { DatabaseProperty, DatabaseRow } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProp(
  overrides: Partial<DatabaseProperty> & { id: string; type: DatabaseProperty["type"] },
): DatabaseProperty {
  return {
    database_id: "db-1",
    name: overrides.name ?? overrides.type,
    config: {},
    position: 0,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

function makeRow(
  id: string,
  title: string,
  values: Record<string, Record<string, unknown>>,
): DatabaseRow {
  const rowValues: Record<string, DatabaseRow["values"][string]> = {};
  for (const [propId, val] of Object.entries(values)) {
    rowValues[propId] = {
      id: `rv-${id}-${propId}`,
      row_id: id,
      property_id: propId,
      value: val,
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
    };
  }
  return {
    page: {
      id,
      title,
      icon: null,
      cover_url: null,
      created_at: "2026-04-20T10:00:00Z",
      updated_at: "2026-04-21T15:30:00Z",
      created_by: "user-1",
    },
    values: rowValues,
  };
}

// ---------------------------------------------------------------------------
// escapeCSVField
// ---------------------------------------------------------------------------

describe("escapeCSVField", () => {
  it("returns plain text unchanged", () => {
    expect(escapeCSVField("hello")).toBe("hello");
  });

  it("wraps text with commas in quotes", () => {
    expect(escapeCSVField("a, b")).toBe('"a, b"');
  });

  it("wraps text with double quotes and escapes them", () => {
    expect(escapeCSVField('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps text with newlines in quotes", () => {
    expect(escapeCSVField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("wraps text with carriage returns in quotes", () => {
    expect(escapeCSVField("line1\rline2")).toBe('"line1\rline2"');
  });

  it("handles empty string", () => {
    expect(escapeCSVField("")).toBe("");
  });

  it("handles text with both commas and quotes", () => {
    expect(escapeCSVField('"a", "b"')).toBe('"""a"", ""b"""');
  });
});

// ---------------------------------------------------------------------------
// serializeCellValue — per property type
// ---------------------------------------------------------------------------

describe("serializeCellValue", () => {
  it("serializes text", () => {
    const prop = makeProp({ id: "p1", type: "text" });
    expect(serializeCellValue(prop, { text: "hello" })).toBe("hello");
    expect(serializeCellValue(prop, { value: "fallback" })).toBe("fallback");
    expect(serializeCellValue(prop, {})).toBe("");
  });

  it("serializes number", () => {
    const prop = makeProp({ id: "p1", type: "number" });
    expect(serializeCellValue(prop, { number: 42 })).toBe("42");
    expect(serializeCellValue(prop, { number: 3.14 })).toBe("3.14");
    expect(serializeCellValue(prop, { value: 99 })).toBe("99");
    expect(serializeCellValue(prop, {})).toBe("");
  });

  it("serializes select", () => {
    const prop = makeProp({
      id: "p1",
      type: "select",
      config: {
        options: [
          { id: "opt-1", name: "Done", color: "green" },
          { id: "opt-2", name: "Todo", color: "gray" },
        ],
      },
    });
    expect(serializeCellValue(prop, { option_id: "opt-1" })).toBe("Done");
    expect(serializeCellValue(prop, { option_id: "opt-unknown" })).toBe("");
    expect(serializeCellValue(prop, {})).toBe("");
  });

  it("serializes status (same as select)", () => {
    const prop = makeProp({
      id: "p1",
      type: "status",
      config: {
        options: [{ id: "s-1", name: "Active", color: "blue" }],
      },
    });
    expect(serializeCellValue(prop, { option_id: "s-1" })).toBe("Active");
  });

  it("serializes multi_select as comma-separated names", () => {
    const prop = makeProp({
      id: "p1",
      type: "multi_select",
      config: {
        options: [
          { id: "ms-1", name: "Frontend", color: "blue" },
          { id: "ms-2", name: "Backend", color: "green" },
          { id: "ms-3", name: "Design", color: "purple" },
        ],
      },
    });
    expect(
      serializeCellValue(prop, { option_ids: ["ms-1", "ms-3"] }),
    ).toBe("Frontend, Design");
    expect(serializeCellValue(prop, { option_ids: [] })).toBe("");
    expect(serializeCellValue(prop, {})).toBe("");
  });

  it("serializes checkbox as true/false", () => {
    const prop = makeProp({ id: "p1", type: "checkbox" });
    expect(serializeCellValue(prop, { checked: true })).toBe("true");
    expect(serializeCellValue(prop, { checked: false })).toBe("false");
    expect(serializeCellValue(prop, {})).toBe("false");
  });

  it("serializes date as ISO 8601", () => {
    const prop = makeProp({ id: "p1", type: "date" });
    expect(serializeCellValue(prop, { date: "2026-04-20" })).toBe("2026-04-20");
    expect(serializeCellValue(prop, { value: "2026-01-01T00:00:00Z" })).toBe(
      "2026-01-01T00:00:00Z",
    );
    expect(serializeCellValue(prop, {})).toBe("");
  });

  it("serializes url", () => {
    const prop = makeProp({ id: "p1", type: "url" });
    expect(serializeCellValue(prop, { url: "https://example.com" })).toBe(
      "https://example.com",
    );
    expect(serializeCellValue(prop, { value: "https://alt.com" })).toBe(
      "https://alt.com",
    );
  });

  it("serializes email", () => {
    const prop = makeProp({ id: "p1", type: "email" });
    expect(serializeCellValue(prop, { email: "a@b.com" })).toBe("a@b.com");
    expect(serializeCellValue(prop, { value: "c@d.com" })).toBe("c@d.com");
  });

  it("serializes phone", () => {
    const prop = makeProp({ id: "p1", type: "phone" });
    expect(serializeCellValue(prop, { phone: "+1234567890" })).toBe(
      "+1234567890",
    );
  });

  it("serializes person as display names", () => {
    const prop = makeProp({
      id: "p1",
      type: "person",
      config: {
        _members: [
          { id: "u-1", display_name: "Alice" },
          { id: "u-2", display_name: "Bob" },
        ],
      },
    });
    expect(serializeCellValue(prop, { user_ids: ["u-1", "u-2"] })).toBe(
      "Alice, Bob",
    );
    expect(serializeCellValue(prop, { user_ids: ["u-unknown"] })).toBe(
      "u-unknown",
    );
    expect(serializeCellValue(prop, { user_ids: [] })).toBe("");
  });

  it("serializes files as comma-separated URLs", () => {
    const prop = makeProp({ id: "p1", type: "files" });
    expect(
      serializeCellValue(prop, {
        files: [
          { name: "a.pdf", url: "https://cdn.example.com/a.pdf" },
          { name: "b.png", url: "https://cdn.example.com/b.png" },
        ],
      }),
    ).toBe("https://cdn.example.com/a.pdf, https://cdn.example.com/b.png");
    expect(serializeCellValue(prop, { files: [] })).toBe("");
  });

  it("serializes relation with resolved titles", () => {
    const prop = makeProp({ id: "p1", type: "relation" });
    expect(
      serializeCellValue(prop, {
        page_ids: ["pg-1", "pg-2"],
        _resolved_titles: { "pg-1": "Page One", "pg-2": "Page Two" },
      }),
    ).toBe("Page One, Page Two");
  });

  it("serializes relation without resolved titles as raw IDs", () => {
    const prop = makeProp({ id: "p1", type: "relation" });
    expect(
      serializeCellValue(prop, { page_ids: ["pg-1", "pg-2"] }),
    ).toBe("pg-1, pg-2");
  });

  it("serializes formula display value", () => {
    const prop = makeProp({ id: "p1", type: "formula" });
    expect(serializeCellValue(prop, { _display: "42" })).toBe("42");
    expect(serializeCellValue(prop, { _display: "", _error: "bad" })).toBe("");
  });

  it("serializes created_time", () => {
    const prop = makeProp({ id: "p1", type: "created_time" });
    expect(
      serializeCellValue(prop, { created_at: "2026-04-20T10:00:00Z" }),
    ).toBe("2026-04-20T10:00:00Z");
  });

  it("serializes updated_time", () => {
    const prop = makeProp({ id: "p1", type: "updated_time" });
    expect(
      serializeCellValue(prop, { updated_at: "2026-04-21T15:30:00Z" }),
    ).toBe("2026-04-21T15:30:00Z");
  });

  it("serializes created_by as display name", () => {
    const prop = makeProp({
      id: "p1",
      type: "created_by",
      config: {
        _members: [{ id: "user-1", display_name: "Alice" }],
      },
    });
    expect(serializeCellValue(prop, { created_by: "user-1" })).toBe("Alice");
  });

  it("serializes created_by as raw ID when member not found", () => {
    const prop = makeProp({ id: "p1", type: "created_by", config: {} });
    expect(serializeCellValue(prop, { created_by: "user-1" })).toBe("user-1");
  });
});

// ---------------------------------------------------------------------------
// serializeRowsToCSV
// ---------------------------------------------------------------------------

describe("serializeRowsToCSV", () => {
  const properties: DatabaseProperty[] = [
    makeProp({
      id: "p-status",
      type: "select",
      name: "Status",
      config: {
        options: [
          { id: "opt-1", name: "Done", color: "green" },
          { id: "opt-2", name: "Todo", color: "gray" },
        ],
      },
    }),
    makeProp({ id: "p-score", type: "number", name: "Score" }),
  ];

  it("produces header row with Title + property names", () => {
    const csv = serializeRowsToCSV([], properties);
    expect(csv).toBe("Title,Status,Score");
  });

  it("serializes rows with correct values", () => {
    const rows: DatabaseRow[] = [
      makeRow("r1", "Task A", {
        "p-status": { option_id: "opt-1" },
        "p-score": { number: 10 },
      }),
      makeRow("r2", "Task B", {
        "p-status": { option_id: "opt-2" },
        "p-score": { number: 20 },
      }),
    ];

    const csv = serializeRowsToCSV(rows, properties);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("Title,Status,Score");
    expect(lines[1]).toBe("Task A,Done,10");
    expect(lines[2]).toBe("Task B,Todo,20");
  });

  it("uses Untitled for rows without a title", () => {
    const rows: DatabaseRow[] = [makeRow("r1", "", { "p-score": { number: 5 } })];
    const csv = serializeRowsToCSV(rows, properties);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe("Untitled,,5");
  });

  it("escapes values containing commas", () => {
    const props: DatabaseProperty[] = [
      makeProp({ id: "p-text", type: "text", name: "Notes" }),
    ];
    const rows: DatabaseRow[] = [
      makeRow("r1", "Task", { "p-text": { text: "a, b, c" } }),
    ];
    const csv = serializeRowsToCSV(rows, props);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe('Task,"a, b, c"');
  });

  it("escapes values containing double quotes", () => {
    const props: DatabaseProperty[] = [
      makeProp({ id: "p-text", type: "text", name: "Notes" }),
    ];
    const rows: DatabaseRow[] = [
      makeRow("r1", "Task", { "p-text": { text: 'say "hi"' } }),
    ];
    const csv = serializeRowsToCSV(rows, props);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe('Task,"say ""hi"""');
  });

  it("handles multi_select with commas in option names", () => {
    const props: DatabaseProperty[] = [
      makeProp({
        id: "p-tags",
        type: "multi_select",
        name: "Tags",
        config: {
          options: [
            { id: "t1", name: "Option A", color: "blue" },
            { id: "t2", name: "Option B", color: "green" },
          ],
        },
      }),
    ];
    const rows: DatabaseRow[] = [
      makeRow("r1", "Task", { "p-tags": { option_ids: ["t1", "t2"] } }),
    ];
    const csv = serializeRowsToCSV(rows, props);
    const lines = csv.split("\r\n");
    // "Option A, Option B" contains a comma, so it gets quoted
    expect(lines[1]).toBe('Task,"Option A, Option B"');
  });

  it("injects resolved relation titles", () => {
    const props: DatabaseProperty[] = [
      makeProp({ id: "p-rel", type: "relation", name: "Related" }),
    ];
    const rows: DatabaseRow[] = [
      makeRow("r1", "Task", { "p-rel": { page_ids: ["pg-1", "pg-2"] } }),
    ];
    const csv = serializeRowsToCSV(rows, props, {
      resolvedRelationTitles: { "pg-1": "Page One", "pg-2": "Page Two" },
    });
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe('Task,"Page One, Page Two"');
  });

  it("handles computed types (created_time, updated_time)", () => {
    const props: DatabaseProperty[] = [
      makeProp({ id: "p-ct", type: "created_time", name: "Created" }),
      makeProp({ id: "p-ut", type: "updated_time", name: "Updated" }),
    ];
    const rows: DatabaseRow[] = [makeRow("r1", "Task", {})];
    const csv = serializeRowsToCSV(rows, props);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe("Task,2026-04-20T10:00:00Z,2026-04-21T15:30:00Z");
  });

  it("uses CRLF line endings per RFC 4180", () => {
    const rows: DatabaseRow[] = [makeRow("r1", "Task", {})];
    const csv = serializeRowsToCSV(rows, properties);
    expect(csv).toContain("\r\n");
    expect(csv.split("\r\n")).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// collectRelationPageIds
// ---------------------------------------------------------------------------

describe("collectRelationPageIds", () => {
  it("collects unique page IDs from relation properties", () => {
    const props: DatabaseProperty[] = [
      makeProp({ id: "p-rel", type: "relation", name: "Related" }),
      makeProp({ id: "p-text", type: "text", name: "Name" }),
    ];
    const rows: DatabaseRow[] = [
      makeRow("r1", "A", { "p-rel": { page_ids: ["pg-1", "pg-2"] } }),
      makeRow("r2", "B", { "p-rel": { page_ids: ["pg-2", "pg-3"] } }),
    ];
    const ids = collectRelationPageIds(rows, props);
    expect(ids.sort()).toEqual(["pg-1", "pg-2", "pg-3"]);
  });

  it("returns empty array when no relation properties exist", () => {
    const props: DatabaseProperty[] = [
      makeProp({ id: "p-text", type: "text", name: "Name" }),
    ];
    const rows: DatabaseRow[] = [makeRow("r1", "A", {})];
    expect(collectRelationPageIds(rows, props)).toEqual([]);
  });

  it("returns empty array for empty rows", () => {
    const props: DatabaseProperty[] = [
      makeProp({ id: "p-rel", type: "relation", name: "Related" }),
    ];
    expect(collectRelationPageIds([], props)).toEqual([]);
  });
});
