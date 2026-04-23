"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RendererProps, EditorProps } from "./index";

// ---------------------------------------------------------------------------
// Date formatting helpers
// ---------------------------------------------------------------------------

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

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

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export function DateRenderer({ value }: RendererProps) {
  const start = typeof value.date === "string" ? value.date : null;
  const end = typeof value.end_date === "string" ? value.end_date : null;

  if (!start) return null;

  const formatted = formatDate(start);
  if (!formatted) return null;

  if (end) {
    const endFormatted = formatDate(end);
    if (endFormatted) {
      return (
        <span className="truncate text-sm">
          {formatted} → {endFormatted}
        </span>
      );
    }
  }

  return <span className="truncate text-sm">{formatted}</span>;
}

// ---------------------------------------------------------------------------
// Date Picker
// ---------------------------------------------------------------------------

function DatePicker({
  selectedDate,
  onSelect,
  onClose,
}: {
  selectedDate: string | null;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const today = new Date();
  const initial = selectedDate ? new Date(selectedDate) : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target;
      if (
        containerRef.current &&
        target instanceof Node &&
        !containerRef.current.contains(target)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }, [viewMonth]);

  const selectedISO = selectedDate
    ? selectedDate.slice(0, 10)
    : null;
  const todayISO = toISODate(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div
      ref={containerRef}
      className="w-64 rounded-sm border border-border bg-background p-3 shadow-md"
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={prevMonth}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium">
          {FULL_MONTHS[viewMonth]} {viewYear}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={nextMonth}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <span
            key={d}
            className="text-xs font-medium text-muted-foreground"
          >
            {d}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) {
            return <span key={`empty-${i}`} />;
          }
          const iso = toISODate(viewYear, viewMonth, day);
          const isSelected = iso === selectedISO;
          const isToday = iso === todayISO;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => {
                onSelect(iso);
                onClose();
              }}
              className={cn(
                "flex size-8 items-center justify-center text-xs",
                "hover:bg-overlay-hover",
                isSelected && "bg-accent text-background font-medium",
                isToday && !isSelected && "text-accent font-medium",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Today button */}
      <div className="mt-2 border-t border-border pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => {
            onSelect(todayISO);
            onClose();
          }}
        >
          Today
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export function DateEditor({ value, onChange, onBlur }: EditorProps) {
  const currentDate =
    typeof value.date === "string" ? value.date : null;

  return (
    <div className="w-full">
      <DatePicker
        selectedDate={currentDate}
        onSelect={(iso) => onChange({ ...value, date: iso })}
        onClose={onBlur}
      />
    </div>
  );
}
