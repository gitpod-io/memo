"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CalendarCell } from "./calendar-view-helpers";

// ---------------------------------------------------------------------------
// useCalendarKeyboardNavigation — manages focused cell/item state and
// keyboard navigation for the calendar view.
//
// The calendar grid is always 7 columns (Sun–Sat). Arrow keys navigate
// between day cells: Left/Right move between days, Up/Down move between
// weeks. Home/End move to the first/last day of the current week.
//
// Enter on a focused day cell with items focuses the first item. Enter on
// a focused item navigates to the row page. Escape returns focus from an
// item back to the day cell.
//
// Navigation wraps at month boundaries — arrowing past the last cell
// moves to the first cell of the next month (and vice versa), delegated
// via onMonthChange callbacks.
//
// Follows the same container-level `onKeyDown` pattern as the gallery and
// list keyboard hooks — no global `document.addEventListener`.
//
// Navigation is delegated to an `onNavigate` callback so the hook stays
// framework-agnostic and works in Storybook (no Next.js router required).
// ---------------------------------------------------------------------------

interface UseCalendarKeyboardNavigationParams {
  /** The flat array of calendar cells from buildCalendarGrid. */
  cells: CalendarCell[];
  workspaceSlug: string;
  /** Called when Enter is pressed on a focused item. Receives the target URL path. */
  onNavigate?: (path: string) => void;
  /** Called when navigation wraps past the start of the grid (go to previous month). */
  onPrevMonth?: () => void;
  /** Called when navigation wraps past the end of the grid (go to next month). */
  onNextMonth?: () => void;
}

export interface CalendarFocusState {
  /** Index into the cells array for the focused day cell. */
  cellIndex: number;
  /** Index of the focused item within the cell, or null if the cell itself is focused. */
  itemIndex: number | null;
}

export function useCalendarKeyboardNavigation({
  cells,
  workspaceSlug,
  onNavigate,
  onPrevMonth,
  onNextMonth,
}: UseCalendarKeyboardNavigationParams) {
  const [focus, setFocus] = useState<CalendarFocusState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const COLS = 7;

  // Focus the DOM element for the given cell index.
  const focusCellElement = useCallback((cellIndex: number) => {
    if (!containerRef.current) return;
    const selector = `[data-calendar-index="${cellIndex}"]`;
    const el = containerRef.current.querySelector<HTMLElement>(selector);
    if (el) {
      el.focus();
    }
  }, []);

  // Focus a specific item within a cell.
  const focusItemElement = useCallback(
    (cellIndex: number, itemIndex: number) => {
      if (!containerRef.current) return;
      const selector = `[data-calendar-index="${cellIndex}"] [data-calendar-item="${itemIndex}"]`;
      const el = containerRef.current.querySelector<HTMLElement>(selector);
      if (el) {
        el.focus();
      }
    },
    [],
  );

  // Handle keyboard events on the calendar container.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!focus) return;

      const { cellIndex, itemIndex } = focus;
      const cell = cells[cellIndex];
      if (!cell) return;

      // When an item within a cell is focused
      if (itemIndex !== null) {
        switch (e.key) {
          case "ArrowDown": {
            e.preventDefault();
            // Move to next item in the cell
            if (itemIndex < cell.items.length - 1) {
              setFocus({ cellIndex, itemIndex: itemIndex + 1 });
            }
            break;
          }
          case "ArrowUp": {
            e.preventDefault();
            // Move to previous item, or back to cell if at first item
            if (itemIndex > 0) {
              setFocus({ cellIndex, itemIndex: itemIndex - 1 });
            } else {
              setFocus({ cellIndex, itemIndex: null });
            }
            break;
          }
          case "Enter": {
            e.preventDefault();
            const row = cell.items[itemIndex];
            if (row) {
              onNavigate?.(`/${workspaceSlug}/${row.page.id}`);
            }
            break;
          }
          case "Escape": {
            e.preventDefault();
            // Return focus to the day cell
            setFocus({ cellIndex, itemIndex: null });
            break;
          }
          default:
            break;
        }
        return;
      }

      // Cell-level navigation
      switch (e.key) {
        case "ArrowLeft": {
          e.preventDefault();
          if (cellIndex > 0) {
            setFocus({ cellIndex: cellIndex - 1, itemIndex: null });
          } else {
            onPrevMonth?.();
          }
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (cellIndex < cells.length - 1) {
            setFocus({ cellIndex: cellIndex + 1, itemIndex: null });
          } else {
            onNextMonth?.();
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const targetUp = cellIndex - COLS;
          if (targetUp >= 0) {
            setFocus({ cellIndex: targetUp, itemIndex: null });
          } else {
            onPrevMonth?.();
          }
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          const targetDown = cellIndex + COLS;
          if (targetDown < cells.length) {
            setFocus({ cellIndex: targetDown, itemIndex: null });
          } else {
            onNextMonth?.();
          }
          break;
        }
        case "Home": {
          e.preventDefault();
          // First day of the current week (row)
          const rowStart = cellIndex - (cellIndex % COLS);
          setFocus({ cellIndex: rowStart, itemIndex: null });
          break;
        }
        case "End": {
          e.preventDefault();
          // Last day of the current week (row)
          const rowEnd = cellIndex - (cellIndex % COLS) + (COLS - 1);
          const clamped = Math.min(rowEnd, cells.length - 1);
          setFocus({ cellIndex: clamped, itemIndex: null });
          break;
        }
        case "Enter": {
          e.preventDefault();
          // If the cell has items, focus the first item
          if (cell.items.length > 0) {
            setFocus({ cellIndex, itemIndex: 0 });
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          setFocus(null);
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          break;
        }
        default:
          break;
      }
    },
    [focus, cells, workspaceSlug, onNavigate, onPrevMonth, onNextMonth],
  );

  // When a cell is clicked/focused via mouse, track it.
  const handleCellFocus = useCallback((cellIndex: number) => {
    setFocus({ cellIndex, itemIndex: null });
  }, []);

  // Sync DOM focus when focus state changes.
  useEffect(() => {
    if (!focus) return;
    if (focus.itemIndex !== null) {
      focusItemElement(focus.cellIndex, focus.itemIndex);
    } else {
      focusCellElement(focus.cellIndex);
    }
  }, [focus, focusCellElement, focusItemElement]);

  return {
    focus,
    setFocus,
    containerRef,
    handleKeyDown,
    handleCellFocus,
  };
}
