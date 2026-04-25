import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useListKeyboardNavigation } from "./list-keyboard";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createKeyboardEvent(
  key: string,
): React.KeyboardEvent {
  const prevented = { current: false };
  return {
    key,
    preventDefault: () => {
      prevented.current = true;
    },
  } as unknown as React.KeyboardEvent;
}

const defaultParams = {
  rowCount: 5,
  workspaceSlug: "test-ws",
  pageIds: ["page-0", "page-1", "page-2", "page-3", "page-4"],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useListKeyboardNavigation", () => {
  it("initializes with null focusedIndex", () => {
    const { result } = renderHook(() =>
      useListKeyboardNavigation(defaultParams),
    );
    expect(result.current.focusedIndex).toBeNull();
  });

  it("handleRowFocus sets focusedIndex", () => {
    const { result } = renderHook(() =>
      useListKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.handleRowFocus(2);
    });

    expect(result.current.focusedIndex).toBe(2);
  });

  it("ArrowDown moves focus to the next row", () => {
    const { result } = renderHook(() =>
      useListKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.handleRowFocus(0);
    });

    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
    });

    expect(result.current.focusedIndex).toBe(1);
  });

  it("ArrowUp moves focus to the previous row", () => {
    const { result } = renderHook(() =>
      useListKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.handleRowFocus(3);
    });

    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowUp"));
    });

    expect(result.current.focusedIndex).toBe(2);
  });

  it("ArrowDown clamps at the last row", () => {
    const { result } = renderHook(() =>
      useListKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.handleRowFocus(4);
    });

    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
    });

    expect(result.current.focusedIndex).toBe(4);
  });

  it("ArrowUp clamps at the first row", () => {
    const { result } = renderHook(() =>
      useListKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.handleRowFocus(0);
    });

    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowUp"));
    });

    expect(result.current.focusedIndex).toBe(0);
  });

  it("Home jumps to the first row", () => {
    const { result } = renderHook(() =>
      useListKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.handleRowFocus(3);
    });

    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("Home"));
    });

    expect(result.current.focusedIndex).toBe(0);
  });

  it("End jumps to the last row", () => {
    const { result } = renderHook(() =>
      useListKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.handleRowFocus(1);
    });

    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("End"));
    });

    expect(result.current.focusedIndex).toBe(4);
  });

  it("Enter calls onNavigate with the correct path", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() =>
      useListKeyboardNavigation({ ...defaultParams, onNavigate }),
    );

    act(() => {
      result.current.handleRowFocus(2);
    });

    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("Enter"));
    });

    expect(onNavigate).toHaveBeenCalledWith("/test-ws/page-2");
  });

  it("Enter does nothing when onNavigate is not provided", () => {
    const { result } = renderHook(() =>
      useListKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.handleRowFocus(0);
    });

    // Should not throw
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("Enter"));
    });

    expect(result.current.focusedIndex).toBe(0);
  });

  it("Escape clears focusedIndex", () => {
    const { result } = renderHook(() =>
      useListKeyboardNavigation(defaultParams),
    );

    act(() => {
      result.current.handleRowFocus(2);
    });

    expect(result.current.focusedIndex).toBe(2);

    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("Escape"));
    });

    expect(result.current.focusedIndex).toBeNull();
  });

  it("ignores key events when no row is focused", () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() =>
      useListKeyboardNavigation({ ...defaultParams, onNavigate }),
    );

    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
    });

    expect(result.current.focusedIndex).toBeNull();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("handles rowCount of 0 gracefully", () => {
    const { result } = renderHook(() =>
      useListKeyboardNavigation({
        ...defaultParams,
        rowCount: 0,
        pageIds: [],
      }),
    );

    // handleRowFocus with invalid index should not crash
    act(() => {
      result.current.handleRowFocus(0);
    });

    // End with 0 rows should not crash
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("End"));
    });

    expect(result.current.focusedIndex).toBe(0);
  });

  it("sequential ArrowDown navigates through all rows", () => {
    const { result } = renderHook(() =>
      useListKeyboardNavigation({ ...defaultParams, rowCount: 3, pageIds: ["a", "b", "c"] }),
    );

    act(() => {
      result.current.handleRowFocus(0);
    });

    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
    });
    expect(result.current.focusedIndex).toBe(1);

    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
    });
    expect(result.current.focusedIndex).toBe(2);

    // Clamp at end
    act(() => {
      result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
    });
    expect(result.current.focusedIndex).toBe(2);
  });
});
