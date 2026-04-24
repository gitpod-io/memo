"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseViewConfig,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_VISIBLE_ITEMS = 3;

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function toISODate(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${m}-${dd}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function todayISO(): string {
  const d = new Date();
  return toISODate(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Extract the date string from a row's date property value. */
function getRowDate(row: DatabaseRow, propertyId: string): string | null {
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
// Calendar cell data
// ---------------------------------------------------------------------------

interface CalendarCell {
  date: string; // ISO date YYYY-MM-DD
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  items: DatabaseRow[];
}

function buildCalendarGrid(
  year: number,
  month: number,
  rowsByDate: Map<string, DatabaseRow[]>,
): CalendarCell[] {
  const today = todayISO();
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
// Props
// ---------------------------------------------------------------------------

export interface CalendarViewProps {
  rows: DatabaseRow[];
  properties: DatabaseProperty[];
  viewConfig: DatabaseViewConfig;
  workspaceSlug: string;
  /** Called when a new row should be added with a pre-filled date value. */
  onAddRow?: (initialValues?: Record<string, Record<string, unknown>>) => void;
  /** Loading state — shows skeleton. */
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// CalendarView
// ---------------------------------------------------------------------------

export const CalendarView = memo(function CalendarView({
  rows,
  properties,
  viewConfig,
  workspaceSlug,
  onAddRow,
  loading = false,
}: CalendarViewProps) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve the date property
  const datePropertyId = viewConfig.date_property ?? null;
  const dateProperty = useMemo(
    () => properties.find((p) => p.id === datePropertyId) ?? null,
    [properties, datePropertyId],
  );

  // Find all date-type properties for the configuration prompt
  const dateProperties = useMemo(
    () => properties.filter((p) => p.type === "date"),
    [properties],
  );

  // Group rows by date
  const rowsByDate = useMemo(() => {
    const map = new Map<string, DatabaseRow[]>();
    if (!datePropertyId) return map;

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
  }, [rows, datePropertyId]);

  // Build the calendar grid
  const cells = useMemo(
    () => buildCalendarGrid(viewYear, viewMonth, rowsByDate),
    [viewYear, viewMonth, rowsByDate],
  );

  // Navigation handlers
  function goToPrevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function goToNextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  function goToToday() {
    const d = new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  // Keyboard navigation — uses state updater functions so the effect
  // doesn't depend on the navigation handlers or current state values.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        !containerRef.current ||
        !containerRef.current.contains(document.activeElement)
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setViewMonth((m) => {
          if (m === 0) {
            setViewYear((y) => y - 1);
            return 11;
          }
          return m - 1;
        });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setViewMonth((m) => {
          if (m === 11) {
            setViewYear((y) => y + 1);
            return 0;
          }
          return m + 1;
        });
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Cell click handler — create a new row with the date pre-filled
  function handleCellClick(date: string, e: React.MouseEvent) {
    // Only trigger on clicks directly on the cell background, not on items
    if (e.target !== e.currentTarget) return;
    if (!onAddRow || !datePropertyId) return;
    onAddRow({ [datePropertyId]: { date } });
  }

  if (loading) {
    return <CalendarSkeleton />;
  }

  // No date property configured — show prompt
  if (!dateProperty) {
    if (dateProperties.length === 0) {
      return (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Add a date property to use calendar view
        </div>
      );
    }

    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Select a date property to position items on the calendar
      </div>
    );
  }

  return (
    <div ref={containerRef} tabIndex={-1} className="outline-none">
      {/* Header: month/year + navigation */}
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-medium">
          {FULL_MONTHS[viewMonth]} {viewYear}
        </h2>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={goToPrevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={goToNextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={goToToday}
        >
          Today
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7">
        {DAY_HEADERS.map((day) => (
          <div
            key={day}
            className="border border-overlay-border p-1 text-center text-xs uppercase tracking-widest text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell) => (
          <CalendarDayCell
            key={cell.date}
            cell={cell}
            workspaceSlug={workspaceSlug}
            onClick={onAddRow ? handleCellClick : undefined}
          />
        ))}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// CalendarDayCell
// ---------------------------------------------------------------------------

interface CalendarDayCellProps {
  cell: CalendarCell;
  workspaceSlug: string;
  onClick?: (date: string, e: React.MouseEvent) => void;
}

function CalendarDayCell({ cell, workspaceSlug, onClick }: CalendarDayCellProps) {
  const [showAll, setShowAll] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const visibleItems = cell.items.slice(0, MAX_VISIBLE_ITEMS);
  const overflowCount = cell.items.length - MAX_VISIBLE_ITEMS;
  const hasOverflow = overflowCount > 0;

  // Close popover on outside click
  useEffect(() => {
    if (!showAll) return;

    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        e.target instanceof Node &&
        !popoverRef.current.contains(e.target)
      ) {
        setShowAll(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showAll]);

  // Close popover on Escape
  useEffect(() => {
    if (!showAll) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowAll(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showAll]);

  return (
    <div
      className={cn(
        "relative min-h-24 border border-overlay-border p-1",
        cell.isToday && "bg-accent/10",
        onClick && "cursor-pointer",
      )}
      onClick={onClick ? (e) => onClick(cell.date, e) : undefined}
    >
      {/* Day number */}
      <span
        className={cn(
          "text-xs",
          !cell.isCurrentMonth && "text-muted-foreground/50",
        )}
      >
        {cell.day}
      </span>

      {/* Items */}
      <div className="mt-0.5">
        {visibleItems.map((row) => (
          <CalendarItem
            key={row.page.id}
            row={row}
            workspaceSlug={workspaceSlug}
          />
        ))}

        {/* Overflow indicator */}
        {hasOverflow && (
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAll(true);
              }}
              className="w-full px-1 py-0.5 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              +{overflowCount} more
            </button>

            {/* Overflow popover */}
            {showAll && (
              <div
                ref={popoverRef}
                className="absolute left-0 top-full z-50 w-56 rounded-sm border border-border bg-background p-2 shadow-md"
              >
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  {cell.date}
                </div>
                {cell.items.map((row) => (
                  <CalendarItem
                    key={row.page.id}
                    row={row}
                    workspaceSlug={workspaceSlug}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CalendarItem
// ---------------------------------------------------------------------------

interface CalendarItemProps {
  row: DatabaseRow;
  workspaceSlug: string;
}

function CalendarItem({ row, workspaceSlug }: CalendarItemProps) {
  const title = row.page.title || "Untitled";

  return (
    <Link
      href={`/${workspaceSlug}/${row.page.id}`}
      onClick={(e) => e.stopPropagation()}
      className="mb-0.5 block truncate bg-muted px-1 py-0.5 text-xs hover:bg-overlay-active"
    >
      {row.page.icon && <span className="mr-1">{row.page.icon}</span>}
      {title}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// CalendarSkeleton
// ---------------------------------------------------------------------------

function CalendarSkeleton() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="mb-3 flex items-center gap-2">
        <div className="h-6 w-40 animate-pulse bg-overlay-border" />
        <div className="h-7 w-7 animate-pulse bg-overlay-border" />
        <div className="h-7 w-7 animate-pulse bg-overlay-border" />
        <div className="h-7 w-14 animate-pulse bg-overlay-border" />
      </div>

      {/* Day headers skeleton */}
      <div className="grid grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="border border-overlay-border p-1 text-center"
          >
            <div className="mx-auto h-3 w-8 animate-pulse bg-overlay-border" />
          </div>
        ))}
      </div>

      {/* Grid skeleton — 5 rows */}
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className="min-h-24 border border-overlay-border p-1"
          >
            <div className="h-3 w-4 animate-pulse bg-overlay-border" />
            {i % 5 === 0 && (
              <div className="mt-1 h-4 w-3/4 animate-pulse bg-overlay-border" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
