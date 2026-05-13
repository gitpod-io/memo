"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DatabaseEmptyState } from "@/components/database/views/database-empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseViewConfig,
} from "@/lib/types";
import {
  buildCalendarGrid,
  groupRowsByDate,
  getDaysInMonth,
  toISODate,
  type CalendarCell,
} from "./calendar-view-helpers";
import { useCalendarKeyboardNavigation } from "./calendar-keyboard";

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
  /** Whether filters are currently active on the view */
  hasActiveFilters?: boolean;
  /** Callback to clear all active filters */
  onClearFilters?: () => void;
  /** Called when keyboard Enter navigates to an item. Receives the URL path. */
  onNavigate?: (path: string) => void;
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
  hasActiveFilters = false,
  onClearFilters,
  onNavigate,
}: CalendarViewProps) {
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDay = now.getDate();
  const [viewYear, setViewYear] = useState(todayYear);
  const [viewMonth, setViewMonth] = useState(todayMonth);
  const outerRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery("(max-width: 767px)");

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
    if (!datePropertyId) return new Map<string, DatabaseRow[]>();
    return groupRowsByDate(rows, datePropertyId);
  }, [rows, datePropertyId]);

  // Build the calendar grid (used for desktop month view)
  const cells = useMemo(
    () => buildCalendarGrid(viewYear, viewMonth, rowsByDate),
    [viewYear, viewMonth, rowsByDate],
  );

  // Build mobile day list — only days in the current month that have items, plus today
  const mobileDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const todayStr = toISODate(todayYear, todayMonth, todayDay);
    const result: CalendarCell[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = toISODate(viewYear, viewMonth, d);
      const items = rowsByDate.get(date) ?? [];
      const isToday = date === todayStr;
      if (items.length > 0 || isToday) {
        result.push({
          date,
          day: d,
          isCurrentMonth: true,
          isToday,
          items,
        });
      }
    }
    return result;
  }, [viewYear, viewMonth, rowsByDate, todayYear, todayMonth, todayDay]);

  // Navigation handlers
  const goToPrevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  function goToToday() {
    const d = new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  // Keyboard navigation for the calendar grid
  const {
    focus: calendarFocus,
    containerRef,
    handleKeyDown,
    handleCellFocus,
  } = useCalendarKeyboardNavigation({
    cells,
    workspaceSlug,
    onNavigate,
    onPrevMonth: goToPrevMonth,
    onNextMonth: goToNextMonth,
  });

  // Cell click handler — create a new row with the date pre-filled.
  // Interactive children (CalendarItem links, overflow button) already call
  // e.stopPropagation(), so clicks on them never reach this handler.
  function handleCellClick(date: string) {
    if (!onAddRow || !datePropertyId) return;
    onAddRow({ [datePropertyId]: { date } });
  }

  if (loading) {
    return <CalendarSkeleton />;
  }

  // Filter-aware empty state — show when filters are active and no rows match
  if (rows.length === 0 && hasActiveFilters) {
    return (
      <DatabaseEmptyState
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
      />
    );
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
    <div ref={outerRef} className="outline-none">
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

      {isMobile ? (
        /* Mobile: compact day list */
        <CalendarMobileList
          days={mobileDays}
          workspaceSlug={workspaceSlug}
          onClick={onAddRow ? handleCellClick : undefined}
        />
      ) : (
        <div
          ref={containerRef}
          role="grid"
          aria-label={`${FULL_MONTHS[viewMonth]} ${viewYear} calendar`}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
        >
          {/* Day headers */}
          <div className="grid grid-cols-7" role="row">
            {DAY_HEADERS.map((day) => (
              <div
                key={day}
                role="columnheader"
                className="border border-overlay-border p-1 text-center text-xs uppercase tracking-widest text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Week rows — group cells into rows of 7 */}
          {Array.from(
            { length: Math.ceil(cells.length / 7) },
            (_, weekIndex) => {
              const weekCells = cells.slice(
                weekIndex * 7,
                weekIndex * 7 + 7,
              );
              return (
                <div
                  key={weekIndex}
                  className="grid grid-cols-7"
                  role="row"
                >
                  {weekCells.map((cell, cellInWeek) => {
                    const index = weekIndex * 7 + cellInWeek;
                    return (
                      <CalendarDayCell
                        key={cell.date}
                        cell={cell}
                        cellIndex={index}
                        workspaceSlug={workspaceSlug}
                        isFocused={calendarFocus?.cellIndex === index}
                        focusedItemIndex={
                          calendarFocus?.cellIndex === index
                            ? calendarFocus.itemIndex
                            : null
                        }
                        onCellFocus={handleCellFocus}
                        onClick={onAddRow ? handleCellClick : undefined}
                      />
                    );
                  })}
                </div>
              );
            },
          )}
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// CalendarDayCell
// ---------------------------------------------------------------------------

interface CalendarDayCellProps {
  cell: CalendarCell;
  cellIndex: number;
  workspaceSlug: string;
  isFocused: boolean;
  focusedItemIndex: number | null;
  onCellFocus: (cellIndex: number) => void;
  onClick?: (date: string) => void;
}

function CalendarDayCell({
  cell,
  cellIndex,
  workspaceSlug,
  isFocused,
  focusedItemIndex,
  onCellFocus,
  onClick,
}: CalendarDayCellProps) {
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
      role="gridcell"
      aria-label={cell.date}
      tabIndex={isFocused ? 0 : -1}
      data-calendar-index={cellIndex}
      data-testid={`cal-day-${cell.date}`}
      className={cn(
        "relative min-h-24 border border-overlay-border p-1 outline-none",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        cell.isToday && "bg-accent/10",
        onClick && "cursor-pointer",
        isFocused &&
          focusedItemIndex === null &&
          "ring-2 ring-ring ring-offset-2",
      )}
      onClick={onClick ? () => onClick(cell.date) : undefined}
      onFocus={(e) => {
        // Only track cell focus when the cell itself is focused, not when
        // focus bubbles up from a child item element.
        if (e.target === e.currentTarget) {
          onCellFocus(cellIndex);
        }
      }}
    >
      {/* Day number */}
      <span
        className={cn(
          "text-xs",
          !cell.isCurrentMonth && "text-muted-foreground",
        )}
      >
        {cell.day}
      </span>

      {/* Items */}
      <div className="mt-0.5">
        {visibleItems.map((row, itemIdx) => (
          <CalendarItem
            key={row.page.id}
            row={row}
            itemIndex={itemIdx}
            workspaceSlug={workspaceSlug}
            isFocused={isFocused && focusedItemIndex === itemIdx}
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
              aria-label={`Show ${overflowCount} more items for ${cell.date}`}
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
// CalendarMobileList — compact day list for mobile viewports
// ---------------------------------------------------------------------------

const MOBILE_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarMobileListProps {
  days: CalendarCell[];
  workspaceSlug: string;
  onClick?: (date: string) => void;
}

function CalendarMobileList({ days, workspaceSlug, onClick }: CalendarMobileListProps) {
  if (days.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No items this month
      </div>
    );
  }

  return (
    <div
      className="divide-y divide-overlay-border"
      role="list"
      aria-label="Calendar days"
      data-testid="db-calendar-mobile-list"
    >
      {days.map((day) => {
        const dateObj = new Date(day.date + "T00:00:00");
        const dayName = MOBILE_DAY_NAMES[dateObj.getDay()];

        return (
          <div
            key={day.date}
            role="listitem"
            className={cn(
              "py-2",
              day.isToday && "bg-accent/10",
              onClick && "cursor-pointer",
            )}
            onClick={onClick ? () => onClick(day.date) : undefined}
          >
            {/* Day header */}
            <div className="mb-1 flex items-center gap-2 px-1">
              <span className="text-lg font-medium tabular-nums">{day.day}</span>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {dayName}
              </span>
              {day.isToday && (
                <span className="text-xs text-accent">Today</span>
              )}
            </div>

            {/* Items */}
            {day.items.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {day.items.map((row) => (
                  <CalendarItem
                    key={row.page.id}
                    row={row}
                    workspaceSlug={workspaceSlug}
                  />
                ))}
              </div>
            ) : (
              <div className="px-1 text-xs text-muted-foreground/50">
                No items
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CalendarItem
// ---------------------------------------------------------------------------

interface CalendarItemProps {
  row: DatabaseRow;
  itemIndex?: number;
  workspaceSlug: string;
  isFocused?: boolean;
}

function CalendarItem({
  row,
  itemIndex,
  workspaceSlug,
  isFocused = false,
}: CalendarItemProps) {
  const title = row.page.title || "Untitled";

  return (
    <Link
      href={`/${workspaceSlug}/${row.page.id}`}
      onClick={(e) => e.stopPropagation()}
      tabIndex={isFocused ? 0 : -1}
      data-calendar-item={itemIndex}
      className={cn(
        "mb-0.5 block truncate bg-muted px-1 py-0.5 text-xs outline-none hover:bg-overlay-active",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        isFocused && "ring-2 ring-ring ring-offset-2",
      )}
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
