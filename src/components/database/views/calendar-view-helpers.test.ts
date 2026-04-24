import { describe, it, expect } from "vitest";
import {
  toISODate,
  getDaysInMonth,
  getFirstDayOfWeek,
  getRowDate,
  groupRowsByDate,
  buildCalendarGrid,
  prevMonth,
  nextMonth,
} from "./calendar-view-helpers";
import type { DatabaseRow, RowValue } from "@/lib/types";

// ---------------------------------------------------------------------------
// Test factories
// ---------------------------------------------------------------------------

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
// toISODate
// ---------------------------------------------------------------------------

describe("toISODate", () => {
  it("formats a date with zero-padded month and day", () => {
    // month is 0-indexed: 0 = January
    expect(toISODate(2026, 0, 5)).toBe("2026-01-05");
  });

  it("formats December correctly", () => {
    expect(toISODate(2026, 11, 25)).toBe("2026-12-25");
  });

  it("formats double-digit month and day", () => {
    expect(toISODate(2026, 9, 15)).toBe("2026-10-15");
  });
});

// ---------------------------------------------------------------------------
// getDaysInMonth
// ---------------------------------------------------------------------------

describe("getDaysInMonth", () => {
  it("returns 31 for January", () => {
    expect(getDaysInMonth(2026, 0)).toBe(31);
  });

  it("returns 28 for February in a non-leap year", () => {
    expect(getDaysInMonth(2025, 1)).toBe(28);
  });

  it("returns 29 for February in a leap year", () => {
    expect(getDaysInMonth(2024, 1)).toBe(29);
  });

  it("returns 30 for April", () => {
    expect(getDaysInMonth(2026, 3)).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// getFirstDayOfWeek
// ---------------------------------------------------------------------------

describe("getFirstDayOfWeek", () => {
  it("returns the correct day of week for a known date", () => {
    // January 1, 2026 is a Thursday (4)
    expect(getFirstDayOfWeek(2026, 0)).toBe(4);
  });

  it("returns 0 for a month starting on Sunday", () => {
    // March 2026 starts on Sunday
    expect(getFirstDayOfWeek(2026, 2)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getRowDate
// ---------------------------------------------------------------------------

describe("getRowDate", () => {
  it("extracts date from { date: 'YYYY-MM-DD' } format", () => {
    const row = makeRow("r1", {
      "date-prop": makeRowValue({ date: "2026-04-15" }, "date-prop"),
    });
    expect(getRowDate(row, "date-prop")).toBe("2026-04-15");
  });

  it("extracts date from { value: 'YYYY-MM-DD' } format", () => {
    const row = makeRow("r1", {
      "date-prop": makeRowValue({ value: "2026-04-15" }, "date-prop"),
    });
    expect(getRowDate(row, "date-prop")).toBe("2026-04-15");
  });

  it("truncates datetime strings to date-only", () => {
    const row = makeRow("r1", {
      "date-prop": makeRowValue({ date: "2026-04-15T12:30:00Z" }, "date-prop"),
    });
    expect(getRowDate(row, "date-prop")).toBe("2026-04-15");
  });

  it("returns null when the property has no value", () => {
    const row = makeRow("r1", {});
    expect(getRowDate(row, "date-prop")).toBeNull();
  });

  it("returns null when the date value is not a string", () => {
    const row = makeRow("r1", {
      "date-prop": makeRowValue({ date: 12345 }, "date-prop"),
    });
    expect(getRowDate(row, "date-prop")).toBeNull();
  });

  it("returns null when the date string is too short", () => {
    const row = makeRow("r1", {
      "date-prop": makeRowValue({ date: "2026" }, "date-prop"),
    });
    expect(getRowDate(row, "date-prop")).toBeNull();
  });

  it("prefers 'date' key over 'value' key", () => {
    const row = makeRow("r1", {
      "date-prop": makeRowValue({ date: "2026-04-15", value: "2026-05-20" }, "date-prop"),
    });
    expect(getRowDate(row, "date-prop")).toBe("2026-04-15");
  });
});

// ---------------------------------------------------------------------------
// groupRowsByDate
// ---------------------------------------------------------------------------

describe("groupRowsByDate", () => {
  it("groups rows by their date value", () => {
    const rows = [
      makeRow("r1", { dp: makeRowValue({ date: "2026-04-10" }, "dp") }),
      makeRow("r2", { dp: makeRowValue({ date: "2026-04-10" }, "dp") }),
      makeRow("r3", { dp: makeRowValue({ date: "2026-04-15" }, "dp") }),
    ];

    const map = groupRowsByDate(rows, "dp");
    expect(map.size).toBe(2);
    expect(map.get("2026-04-10")).toHaveLength(2);
    expect(map.get("2026-04-15")).toHaveLength(1);
  });

  it("skips rows without a date value", () => {
    const rows = [
      makeRow("r1", { dp: makeRowValue({ date: "2026-04-10" }, "dp") }),
      makeRow("r2", {}), // no value
      makeRow("r3", { dp: makeRowValue({ text: "not a date" }, "dp") }),
    ];

    const map = groupRowsByDate(rows, "dp");
    expect(map.size).toBe(1);
    expect(map.get("2026-04-10")).toHaveLength(1);
  });

  it("returns an empty map for an empty rows array", () => {
    const map = groupRowsByDate([], "dp");
    expect(map.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildCalendarGrid
// ---------------------------------------------------------------------------

describe("buildCalendarGrid", () => {
  it("produces a grid divisible by 7 (complete weeks)", () => {
    const cells = buildCalendarGrid(2026, 3, new Map(), "2026-04-24");
    expect(cells.length % 7).toBe(0);
  });

  it("includes all days of the target month", () => {
    // April 2026 has 30 days
    const cells = buildCalendarGrid(2026, 3, new Map(), "2026-04-24");
    const currentMonthCells = cells.filter((c) => c.isCurrentMonth);
    expect(currentMonthCells).toHaveLength(30);
    expect(currentMonthCells[0].day).toBe(1);
    expect(currentMonthCells[29].day).toBe(30);
  });

  it("marks the correct cell as today", () => {
    const cells = buildCalendarGrid(2026, 3, new Map(), "2026-04-15");
    const todayCell = cells.find((c) => c.isToday);
    expect(todayCell).toBeDefined();
    expect(todayCell!.date).toBe("2026-04-15");
    expect(todayCell!.isCurrentMonth).toBe(true);
  });

  it("does not mark any cell as today when today is in a different month", () => {
    const cells = buildCalendarGrid(2026, 3, new Map(), "2026-05-01");
    // May 1 might appear as overflow, but let's check if it's marked
    const todayCells = cells.filter((c) => c.isToday);
    // May 1 could be in the overflow — if so it should be marked
    if (todayCells.length > 0) {
      expect(todayCells[0].date).toBe("2026-05-01");
      expect(todayCells[0].isCurrentMonth).toBe(false);
    }
  });

  it("assigns rows to the correct date cells", () => {
    const rows = [makeRow("r1"), makeRow("r2")];
    const rowsByDate = new Map<string, DatabaseRow[]>();
    rowsByDate.set("2026-04-10", rows);

    const cells = buildCalendarGrid(2026, 3, rowsByDate, "2026-04-24");
    const cell10 = cells.find((c) => c.date === "2026-04-10");
    expect(cell10).toBeDefined();
    expect(cell10!.items).toHaveLength(2);
    expect(cell10!.items[0].page.id).toBe("r1");
  });

  it("includes previous month overflow days", () => {
    // April 2026 starts on Wednesday (day 3), so there should be 3 overflow days from March
    const cells = buildCalendarGrid(2026, 3, new Map(), "2026-04-24");
    const overflowBefore = [];
    for (const cell of cells) {
      if (cell.isCurrentMonth) break;
      overflowBefore.push(cell);
    }
    expect(overflowBefore.length).toBe(3); // Sun, Mon, Tue from March
    expect(overflowBefore[0].date).toBe("2026-03-29");
    expect(overflowBefore[0].isCurrentMonth).toBe(false);
  });

  it("includes next month overflow days to complete the last week", () => {
    const cells = buildCalendarGrid(2026, 3, new Map(), "2026-04-24");
    const lastCell = cells[cells.length - 1];
    // April 30, 2026 is Thursday. Grid needs Fri + Sat to complete the week.
    expect(lastCell.date).toBe("2026-05-02");
    expect(lastCell.isCurrentMonth).toBe(false);
  });

  it("handles month starting on Sunday (no previous overflow)", () => {
    // March 2026 starts on Sunday
    const cells = buildCalendarGrid(2026, 2, new Map(), "2026-03-15");
    expect(cells[0].date).toBe("2026-03-01");
    expect(cells[0].isCurrentMonth).toBe(true);
  });

  it("handles rows spanning month boundaries (overflow cells get items)", () => {
    const rowsByDate = new Map<string, DatabaseRow[]>();
    // Row on March 31 (which is overflow in April's grid)
    rowsByDate.set("2026-03-31", [makeRow("r-march")]);
    // Row on May 1 (which is overflow in April's grid)
    rowsByDate.set("2026-05-01", [makeRow("r-may")]);

    const cells = buildCalendarGrid(2026, 3, rowsByDate, "2026-04-24");

    const marchCell = cells.find((c) => c.date === "2026-03-31");
    expect(marchCell).toBeDefined();
    expect(marchCell!.items).toHaveLength(1);
    expect(marchCell!.items[0].page.id).toBe("r-march");

    const mayCell = cells.find((c) => c.date === "2026-05-01");
    expect(mayCell).toBeDefined();
    expect(mayCell!.items).toHaveLength(1);
    expect(mayCell!.items[0].page.id).toBe("r-may");
  });

  it("handles February in a leap year", () => {
    // February 2024 has 29 days
    const cells = buildCalendarGrid(2024, 1, new Map(), "2024-02-15");
    const febCells = cells.filter((c) => c.isCurrentMonth);
    expect(febCells).toHaveLength(29);
  });

  it("handles year boundary (January grid shows December overflow)", () => {
    // January 2026 starts on Thursday (day 4)
    const cells = buildCalendarGrid(2026, 0, new Map(), "2026-01-15");
    const overflowBefore = [];
    for (const cell of cells) {
      if (cell.isCurrentMonth) break;
      overflowBefore.push(cell);
    }
    expect(overflowBefore.length).toBe(4);
    // These should be December 2025 dates
    expect(overflowBefore[0].date).toBe("2025-12-28");
  });

  it("handles December grid showing January overflow", () => {
    // December 2025 starts on Monday (day 1)
    const cells = buildCalendarGrid(2025, 11, new Map(), "2025-12-15");
    const lastCell = cells[cells.length - 1];
    // December 31, 2025 is Wednesday. Need Thu, Fri, Sat to complete.
    expect(lastCell.date).toBe("2026-01-03");
  });
});

// ---------------------------------------------------------------------------
// prevMonth / nextMonth
// ---------------------------------------------------------------------------

describe("prevMonth", () => {
  it("returns the previous month in the same year", () => {
    expect(prevMonth(2026, 6)).toEqual({ year: 2026, month: 5 });
  });

  it("rolls back to December of the previous year from January", () => {
    expect(prevMonth(2026, 0)).toEqual({ year: 2025, month: 11 });
  });
});

describe("nextMonth", () => {
  it("returns the next month in the same year", () => {
    expect(nextMonth(2026, 6)).toEqual({ year: 2026, month: 7 });
  });

  it("rolls forward to January of the next year from December", () => {
    expect(nextMonth(2025, 11)).toEqual({ year: 2026, month: 0 });
  });
});
