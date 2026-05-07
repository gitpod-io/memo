import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useCalendarKeyboardNavigation } from "./calendar-keyboard";
import type { CalendarCell } from "./calendar-view-helpers";
import type { DatabaseRow } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createKeyboardEvent(key: string): React.KeyboardEvent {
  const prevented = { current: false };
  return {
    key,
    preventDefault: () => {
      prevented.current = true;
    },
  } as unknown as React.KeyboardEvent;
}

function makeRow(id: string, title: string): DatabaseRow {
  return {
    page: {
      id,
      title,
      icon: null,
      cover_url: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      created_by: "user-1",
    },
    values: {},
  };
}

function makeCell(
  date: string,
  day: number,
  items: DatabaseRow[] = [],
  isCurrentMonth = true,
): CalendarCell {
  return {
    date,
    day,
    isCurrentMonth,
    isToday: false,
    items,
  };
}

// Build a 2-week (14-cell) grid for testing. Cells 4 and 9 have items.
function buildTestCells(): CalendarCell[] {
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 14; i++) {
    const day = i + 1;
    const date = `2026-01-${String(day).padStart(2, "0")}`;
    const items =
      i === 4
        ? [makeRow("row-a", "Item A"), makeRow("row-b", "Item B")]
        : i === 9
          ? [makeRow("row-c", "Item C")]
          : [];
    cells.push(makeCell(date, day, items));
  }
  return cells;
}

const defaultParams = {
  cells: buildTestCells(),
  workspaceSlug: "test-ws",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useCalendarKeyboardNavigation", () => {
  it("initializes with null focus", () => {
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation(defaultParams),
    );
    expect(result.current.focus).toBeNull();
  });

  it("handleCellFocus sets focus to the given cell", () => {
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.handleCellFocus(3);
    });

    expect(result.current.focus).toEqual({ cellIndex: 3, itemIndex: null });
  });

  // --- Arrow key cell navigation ---

  it("ArrowRight moves focus to the next cell", () => {
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.handleCellFocus(2);
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowRight"));
    });

    expect(result.current.focus).toEqual({ cellIndex: 3, itemIndex: null });
  });

  it("ArrowLeft moves focus to the previous cell", () => {
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.handleCellFocus(5);
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowLeft"));
    });

    expect(result.current.focus).toEqual({ cellIndex: 4, itemIndex: null });
  });

  it("ArrowDown moves focus down one week (7 cells)", () => {
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.handleCellFocus(2);
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
    });

    expect(result.current.focus).toEqual({ cellIndex: 9, itemIndex: null });
  });

  it("ArrowUp moves focus up one week (7 cells)", () => {
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.handleCellFocus(10);
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowUp"));
    });

    expect(result.current.focus).toEqual({ cellIndex: 3, itemIndex: null });
  });

  // --- Home / End ---

  it("Home moves to the first day of the current week", () => {
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.handleCellFocus(5); // 6th cell in first row (0-indexed)
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("Home"));
    });

    expect(result.current.focus).toEqual({ cellIndex: 0, itemIndex: null });
  });

  it("End moves to the last day of the current week", () => {
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.handleCellFocus(1); // 2nd cell in first row
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("End"));
    });

    expect(result.current.focus).toEqual({ cellIndex: 6, itemIndex: null });
  });

  it("End clamps to the last cell when the row extends past the grid", () => {
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation(defaultParams),
    );

    // Focus cell 8 (second row, index 8). End of that row is index 13.
    act(() => {
      result.current.handleCellFocus(8);
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("End"));
    });

    expect(result.current.focus).toEqual({ cellIndex: 13, itemIndex: null });
  });

  // --- Enter on cell with items ---

  it("Enter on a cell with items focuses the first item", () => {
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation(defaultParams),
    );

    // Cell 4 has 2 items
    act(() => {
      result.current.handleCellFocus(4);
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("Enter"));
    });

    expect(result.current.focus).toEqual({ cellIndex: 4, itemIndex: 0 });
  });

  it("Enter on a cell without items does nothing", () => {
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation(defaultParams),
    );

    // Cell 0 has no items
    act(() => {
      result.current.handleCellFocus(0);
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("Enter"));
    });

    expect(result.current.focus).toEqual({ cellIndex: 0, itemIndex: null });
  });

  // --- Item-level navigation ---

  it("ArrowDown within items moves to the next item", () => {
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation(defaultParams),
    );

    // Focus cell 4, item 0
    act(() => {
      result.current.handleCellFocus(4);
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("Enter"));
    });
    expect(result.current.focus).toEqual({ cellIndex: 4, itemIndex: 0 });

    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
    });

    expect(result.current.focus).toEqual({ cellIndex: 4, itemIndex: 1 });
  });

  it("ArrowDown at the last item stays on the last item", () => {
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation(defaultParams),
    );

    // Cell 4 has 2 items (index 0, 1)
    act(() => {
      result.current.setFocus({ cellIndex: 4, itemIndex: 1 });
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
    });

    expect(result.current.focus).toEqual({ cellIndex: 4, itemIndex: 1 });
  });

  it("ArrowUp from the first item returns focus to the cell", () => {
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.setFocus({ cellIndex: 4, itemIndex: 0 });
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowUp"));
    });

    expect(result.current.focus).toEqual({ cellIndex: 4, itemIndex: null });
  });

  it("ArrowUp from a non-first item moves to the previous item", () => {
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.setFocus({ cellIndex: 4, itemIndex: 1 });
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowUp"));
    });

    expect(result.current.focus).toEqual({ cellIndex: 4, itemIndex: 0 });
  });

  it("Enter on a focused item calls onNavigate with the correct path", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation({ ...defaultParams, onNavigate }),
    );

    // Cell 4, item 0 is "row-a"
    act(() => {
      result.current.setFocus({ cellIndex: 4, itemIndex: 0 });
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("Enter"));
    });

    expect(onNavigate).toHaveBeenCalledWith("/test-ws/row-a");
  });

  it("Enter on the second item navigates to the correct page", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation({ ...defaultParams, onNavigate }),
    );

    // Cell 4, item 1 is "row-b"
    act(() => {
      result.current.setFocus({ cellIndex: 4, itemIndex: 1 });
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("Enter"));
    });

    expect(onNavigate).toHaveBeenCalledWith("/test-ws/row-b");
  });

  it("Escape from an item returns focus to the day cell", () => {
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.setFocus({ cellIndex: 4, itemIndex: 0 });
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("Escape"));
    });

    expect(result.current.focus).toEqual({ cellIndex: 4, itemIndex: null });
  });

  // --- Escape from cell ---

  it("Escape from a cell clears focus entirely", () => {
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.handleCellFocus(3);
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("Escape"));
    });

    expect(result.current.focus).toBeNull();
  });

  // --- Boundary wrapping ---

  it("ArrowLeft at the first cell calls onPrevMonth", () => {
    const onPrevMonth = vi.fn();
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation({ ...defaultParams, onPrevMonth }),
    );

    act(() => {
      result.current.handleCellFocus(0);
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowLeft"));
    });

    expect(onPrevMonth).toHaveBeenCalled();
  });

  it("ArrowRight at the last cell calls onNextMonth", () => {
    const onNextMonth = vi.fn();
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation({ ...defaultParams, onNextMonth }),
    );

    act(() => {
      result.current.handleCellFocus(13); // last cell in 14-cell grid
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowRight"));
    });

    expect(onNextMonth).toHaveBeenCalled();
  });

  it("ArrowUp at the first row calls onPrevMonth", () => {
    const onPrevMonth = vi.fn();
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation({ ...defaultParams, onPrevMonth }),
    );

    act(() => {
      result.current.handleCellFocus(3); // first row, no row above
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowUp"));
    });

    expect(onPrevMonth).toHaveBeenCalled();
  });

  it("ArrowDown past the last row calls onNextMonth", () => {
    const onNextMonth = vi.fn();
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation({ ...defaultParams, onNextMonth }),
    );

    act(() => {
      result.current.handleCellFocus(10); // second row, ArrowDown would go to 17 which is out of bounds
    });
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
    });

    expect(onNextMonth).toHaveBeenCalled();
  });

  // --- No-op when no focus ---

  it("ignores key events when no cell is focused", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation({ ...defaultParams, onNavigate }),
    );

    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
    });

    expect(result.current.focus).toBeNull();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  // --- Empty grid ---

  it("handles empty cells array gracefully", () => {
    const { result } = renderHook(() =>
      useCalendarKeyboardNavigation({
        cells: [],
        workspaceSlug: "test-ws",
      }),
    );

    act(() => {
      result.current.handleCellFocus(0);
    });

    // Should not crash
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowRight"));
    });

    expect(result.current.focus).toEqual({ cellIndex: 0, itemIndex: null });
  });
});
