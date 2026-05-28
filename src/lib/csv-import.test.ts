import { describe, it, expect } from "vitest";
import {
  parseCSV,
  buildColumnMappings,
  coerceValue,
  inferPropertyType,
  processCSVRows,
} from "./csv-import";
import type { DatabaseProperty } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProp(
  overrides: Partial<DatabaseProperty> & {
    id: string;
    type: DatabaseProperty["type"];
  },
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

// ---------------------------------------------------------------------------
// parseCSV
// ---------------------------------------------------------------------------

describe("parseCSV", () => {
  it("parses simple CSV with headers and rows", () => {
    const result = parseCSV("Title,Status,Score\nTask A,Done,10\nTask B,Todo,20");
    expect(result.headers).toEqual(["Title", "Status", "Score"]);
    expect(result.rows).toEqual([
      ["Task A", "Done", "10"],
      ["Task B", "Todo", "20"],
    ]);
  });

  it("handles CRLF line endings", () => {
    const result = parseCSV("Title,Score\r\nTask A,10\r\nTask B,20\r\n");
    expect(result.headers).toEqual(["Title", "Score"]);
    expect(result.rows).toEqual([
      ["Task A", "10"],
      ["Task B", "20"],
    ]);
  });

  it("handles quoted fields with commas", () => {
    const result = parseCSV('Title,Notes\nTask,"a, b, c"');
    expect(result.rows[0]).toEqual(["Task", "a, b, c"]);
  });

  it("handles escaped double quotes inside quoted fields", () => {
    const result = parseCSV('Title,Notes\nTask,"say ""hi"""');
    expect(result.rows[0]).toEqual(["Task", 'say "hi"']);
  });

  it("handles newlines inside quoted fields", () => {
    const result = parseCSV('Title,Notes\nTask,"line1\nline2"');
    expect(result.rows[0]).toEqual(["Task", "line1\nline2"]);
  });

  it("returns empty result for empty input", () => {
    const result = parseCSV("");
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it("returns headers only when no data rows", () => {
    const result = parseCSV("Title,Status");
    expect(result.headers).toEqual(["Title", "Status"]);
    expect(result.rows).toEqual([]);
  });

  it("handles trailing empty rows", () => {
    const result = parseCSV("Title\nTask A\n\n\n");
    expect(result.rows).toEqual([["Task A"]]);
  });

  it("handles rows with fewer columns than headers", () => {
    const result = parseCSV("Title,Status,Score\nTask A,Done");
    expect(result.rows[0]).toEqual(["Task A", "Done"]);
  });

  it("handles rows with more columns than headers", () => {
    const result = parseCSV("Title,Status\nTask A,Done,Extra");
    expect(result.rows[0]).toEqual(["Task A", "Done", "Extra"]);
  });
});

// ---------------------------------------------------------------------------
// buildColumnMappings
// ---------------------------------------------------------------------------

describe("buildColumnMappings", () => {
  const properties: DatabaseProperty[] = [
    makeProp({ id: "p-status", type: "select", name: "Status" }),
    makeProp({ id: "p-score", type: "number", name: "Score" }),
  ];

  it("matches CSV headers to properties case-insensitively", () => {
    const { titleIndex, mappings } = buildColumnMappings(
      ["Title", "status", "SCORE"],
      properties,
    );
    expect(titleIndex).toBe(0);
    expect(mappings).toHaveLength(2);
    expect(mappings[0].property?.id).toBe("p-status");
    expect(mappings[1].property?.id).toBe("p-score");
  });

  it("marks unmatched columns for creation", () => {
    const { mappings } = buildColumnMappings(
      ["Title", "Status", "NewColumn"],
      properties,
    );
    expect(mappings).toHaveLength(2);
    const newCol = mappings.find((m) => m.csvHeader === "NewColumn");
    expect(newCol?.property).toBeNull();
    expect(newCol?.createAsNew).toBe(true);
  });

  it("handles missing Title column", () => {
    const { titleIndex } = buildColumnMappings(
      ["Status", "Score"],
      properties,
    );
    expect(titleIndex).toBe(-1);
  });

  it("skips empty headers", () => {
    const { mappings } = buildColumnMappings(
      ["Title", "", "Status"],
      properties,
    );
    expect(mappings).toHaveLength(1);
    expect(mappings[0].csvHeader).toBe("Status");
  });
});

// ---------------------------------------------------------------------------
// coerceValue
// ---------------------------------------------------------------------------

describe("coerceValue", () => {
  it("coerces text", () => {
    expect(coerceValue("hello", "text")).toEqual({ value: { text: "hello" } });
  });

  it("coerces empty string to empty value", () => {
    expect(coerceValue("", "text")).toEqual({ value: { text: "" } });
    expect(coerceValue("", "number")).toEqual({ value: {} });
  });

  it("coerces valid number", () => {
    expect(coerceValue("42", "number")).toEqual({ value: { number: 42 } });
    expect(coerceValue("3.14", "number")).toEqual({ value: { number: 3.14 } });
  });

  it("returns error for invalid number", () => {
    const result = coerceValue("abc", "number");
    expect(result.error).toBeDefined();
    expect(result.value).toEqual({});
  });

  it("coerces checkbox true values", () => {
    expect(coerceValue("true", "checkbox")).toEqual({
      value: { checked: true },
    });
    expect(coerceValue("yes", "checkbox")).toEqual({
      value: { checked: true },
    });
    expect(coerceValue("1", "checkbox")).toEqual({
      value: { checked: true },
    });
  });

  it("coerces checkbox false values", () => {
    expect(coerceValue("false", "checkbox")).toEqual({
      value: { checked: false },
    });
    expect(coerceValue("no", "checkbox")).toEqual({
      value: { checked: false },
    });
    expect(coerceValue("0", "checkbox")).toEqual({
      value: { checked: false },
    });
  });

  it("returns error for invalid checkbox value", () => {
    const result = coerceValue("maybe", "checkbox");
    expect(result.error).toBeDefined();
  });

  it("coerces ISO date", () => {
    const result = coerceValue("2026-04-20", "date");
    expect(result.value).toEqual({ date: "2026-04-20" });
  });

  it("coerces ISO datetime", () => {
    const result = coerceValue("2026-04-20T10:00:00Z", "date");
    expect(result.value).toEqual({ date: "2026-04-20T10:00:00.000Z" });
  });

  it("returns error for invalid date", () => {
    const result = coerceValue("not-a-date", "date");
    expect(result.error).toBeDefined();
  });

  it("coerces url", () => {
    expect(coerceValue("https://example.com", "url")).toEqual({
      value: { url: "https://example.com" },
    });
  });

  it("coerces email", () => {
    expect(coerceValue("a@b.com", "email")).toEqual({
      value: { email: "a@b.com" },
    });
  });

  it("coerces phone", () => {
    expect(coerceValue("+1234567890", "phone")).toEqual({
      value: { phone: "+1234567890" },
    });
  });

  it("coerces select with matching option", () => {
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
    expect(coerceValue("Done", "select", prop)).toEqual({
      value: { option_id: "opt-1" },
    });
    expect(coerceValue("done", "select", prop)).toEqual({
      value: { option_id: "opt-1" },
    });
  });

  it("returns error for unknown select option", () => {
    const prop = makeProp({
      id: "p1",
      type: "select",
      config: {
        options: [{ id: "opt-1", name: "Done", color: "green" }],
      },
    });
    const result = coerceValue("Unknown", "select", prop);
    expect(result.error).toBeDefined();
  });

  it("coerces multi_select", () => {
    const prop = makeProp({
      id: "p1",
      type: "multi_select",
      config: {
        options: [
          { id: "ms-1", name: "Frontend", color: "blue" },
          { id: "ms-2", name: "Backend", color: "green" },
        ],
      },
    });
    expect(coerceValue("Frontend, Backend", "multi_select", prop)).toEqual({
      value: { option_ids: ["ms-1", "ms-2"] },
    });
  });

  it("returns error for non-importable types", () => {
    expect(coerceValue("value", "person").error).toBeDefined();
    expect(coerceValue("value", "formula").error).toBeDefined();
    expect(coerceValue("value", "created_time").error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// inferPropertyType
// ---------------------------------------------------------------------------

describe("inferPropertyType", () => {
  it("infers checkbox from boolean values", () => {
    expect(inferPropertyType(["true", "false", "yes"])).toBe("checkbox");
  });

  it("infers number from numeric values", () => {
    expect(inferPropertyType(["1", "2.5", "100"])).toBe("number");
  });

  it("infers date from date values", () => {
    expect(inferPropertyType(["2026-01-01", "2026-02-15"])).toBe("date");
  });

  it("defaults to text for mixed values", () => {
    expect(inferPropertyType(["hello", "42", "true"])).toBe("text");
  });

  it("defaults to text for empty values", () => {
    expect(inferPropertyType(["", "", ""])).toBe("text");
  });
});

// ---------------------------------------------------------------------------
// processCSVRows
// ---------------------------------------------------------------------------

describe("processCSVRows", () => {
  it("processes rows with matched properties", () => {
    const properties: DatabaseProperty[] = [
      makeProp({ id: "p-score", type: "number", name: "Score" }),
    ];
    const { titleIndex, mappings } = buildColumnMappings(
      ["Title", "Score"],
      properties,
    );
    const parsed = { headers: ["Title", "Score"], rows: [["Task A", "10"]] };
    const results = processCSVRows(parsed, titleIndex, mappings);

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Task A");
    expect(results[0].values["p-score"]).toEqual({ number: 10 });
    expect(results[0].errors).toHaveLength(0);
  });

  it("tracks errors for invalid values", () => {
    const properties: DatabaseProperty[] = [
      makeProp({ id: "p-score", type: "number", name: "Score" }),
    ];
    const { titleIndex, mappings } = buildColumnMappings(
      ["Title", "Score"],
      properties,
    );
    const parsed = { headers: ["Title", "Score"], rows: [["Task A", "abc"]] };
    const results = processCSVRows(parsed, titleIndex, mappings);

    expect(results[0].errors).toHaveLength(1);
    expect(results[0].errors[0].column).toBe("Score");
  });

  it("handles missing title column", () => {
    const properties: DatabaseProperty[] = [
      makeProp({ id: "p-text", type: "text", name: "Notes" }),
    ];
    const { titleIndex, mappings } = buildColumnMappings(
      ["Notes"],
      properties,
    );
    const parsed = { headers: ["Notes"], rows: [["hello"]] };
    const results = processCSVRows(parsed, titleIndex, mappings);

    expect(results[0].title).toBe("");
    expect(results[0].values["p-text"]).toEqual({ text: "hello" });
  });
});
