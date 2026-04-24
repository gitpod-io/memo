// Pure functions for calendar-view date computation and grid building.
// No React dependencies — all computation is side-effect-free.

import type { DatabaseRow } from "@/lib/types";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function toISODate(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${m}-${dd}`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/** Extract the date string (YYYY-MM-DD) from a row's date property value. */
export function getRowDate(row: DatabaseRow, propertyId: string): string | null {
  const rv = row.values[propertyId];
  if (!rv) return null;
  // Date values store { date: "YYYY-MM-DD" } or { value: "YYYY-MM-DD" }
  const dateVal = rv.value?.date ?? rv.value?.value;
  if (typeof dateVal === "string" && dateVal.length >= 10) {
    return dateVal.slice(0, 10);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Row grouping by date
// ---------------------------------------------------------------------------

/** Group rows by their date value for a given property. */
export function groupRowsByDate(
  rows: DatabaseRow[],
  datePropertyId: string,
): Map<string, DatabaseRow[]> {
  const map = new Map<string, DatabaseRow[]>();

  for (const row of rows) {
    const date = getRowDate(row, datePropertyId);
    if (!date) continue;
    const existing = map.get(date);
    if (existing) {
      existing.push(row);
    } else {
      map.set(date, [row]);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Calendar cell data
// ---------------------------------------------------------------------------

export interface CalendarCell {
  date: string; // ISO date YYYY-MM-DD
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  items: DatabaseRow[];
}

/**
 * Build a calendar grid for a given month. The grid always starts on Sunday
 * and fills previous/next month overflow days to complete full weeks.
 *
 * @param todayISO - The current date as "YYYY-MM-DD", injected for testability.
 */
export function buildCalendarGrid(
  year: number,
  month: number,
  rowsByDate: Map<string, DatabaseRow[]>,
  todayISO?: string,
): CalendarCell[] {
  const today = todayISO ?? _todayISO();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const cells: CalendarCell[] = [];

  // Previous month overflow
  if (firstDay > 0) {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const prevDays = getDaysInMonth(prevYear, prevMonth);
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = prevDays - i;
      const date = toISODate(prevYear, prevMonth, day);
      cells.push({
        date,
        day,
        isCurrentMonth: false,
        isToday: date === today,
        items: rowsByDate.get(date) ?? [],
      });
    }
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const date = toISODate(year, month, d);
    cells.push({
      date,
      day: d,
      isCurrentMonth: true,
      isToday: date === today,
      items: rowsByDate.get(date) ?? [],
    });
  }

  // Next month overflow to fill the grid (always complete the last week)
  const remainder = cells.length % 7;
  if (remainder > 0) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const fill = 7 - remainder;
    for (let d = 1; d <= fill; d++) {
      const date = toISODate(nextYear, nextMonth, d);
      cells.push({
        date,
        day: d,
        isCurrentMonth: false,
        isToday: date === today,
        items: rowsByDate.get(date) ?? [],
      });
    }
  }

  return cells;
}

// ---------------------------------------------------------------------------
// Month navigation
// ---------------------------------------------------------------------------

export interface MonthYear {
  year: number;
  month: number; // 0-indexed (0 = January, 11 = December)
}

/** Compute the previous month, handling year rollover. */
export function prevMonth(year: number, month: number): MonthYear {
  if (month === 0) {
    return { year: year - 1, month: 11 };
  }
  return { year, month: month - 1 };
}

/** Compute the next month, handling year rollover. */
export function nextMonth(year: number, month: number): MonthYear {
  if (month === 11) {
    return { year: year + 1, month: 0 };
  }
  return { year, month: month + 1 };
}

// ---------------------------------------------------------------------------
// Internal — default "today" for production use
// ---------------------------------------------------------------------------

function _todayISO(): string {
  const d = new Date();
  return toISODate(d.getFullYear(), d.getMonth(), d.getDate());
}
