import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRef } from "react";
import { useRovingTabindex } from "./use-roving-tabindex";

describe("useRovingTabindex", () => {
  const ids = ["a", "b", "c"];
  const onActivate = vi.fn();

  function setup(itemIds = ids) {
    return renderHook(() => {
      const containerRef = useRef<HTMLDivElement>(null);
      return useRovingTabindex({ itemIds, onActivate, containerRef });
    });
  }

  it("tabbableId defaults to the first item when no focus", () => {
    const { result } = setup();
    expect(result.current.tabbableId).toBe("a");
    expect(result.current.focusedId).toBeNull();
  });

  it("tabbableId is null when itemIds is empty", () => {
    const { result } = setup([]);
    expect(result.current.tabbableId).toBeNull();
  });

  it("handleFocus sets focusedId from data-item-id", () => {
    const { result } = setup();
    const fakeTarget = document.createElement("button");
    fakeTarget.setAttribute("data-item-id", "b");

    act(() => {
      result.current.handleFocus({
        target: fakeTarget,
      } as unknown as React.FocusEvent);
    });

    expect(result.current.focusedId).toBe("b");
    expect(result.current.tabbableId).toBe("b");
  });

  it("handleFocus ignores elements without data-item-id", () => {
    const { result } = setup();
    const fakeTarget = document.createElement("div");

    act(() => {
      result.current.handleFocus({
        target: fakeTarget,
      } as unknown as React.FocusEvent);
    });

    expect(result.current.focusedId).toBeNull();
  });

  it("ArrowDown moves focusedId to next item", () => {
    const { result } = setup();
    const fakeTarget = document.createElement("button");
    fakeTarget.setAttribute("data-item-id", "a");

    // Set initial focus
    act(() => {
      result.current.handleFocus({
        target: fakeTarget,
      } as unknown as React.FocusEvent);
    });

    const preventDefault = vi.fn();
    act(() => {
      result.current.handleKeyDown({
        key: "ArrowDown",
        preventDefault,
      } as unknown as React.KeyboardEvent);
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(result.current.focusedId).toBe("b");
  });

  it("ArrowDown wraps from last to first", () => {
    const { result } = setup();
    const fakeTarget = document.createElement("button");
    fakeTarget.setAttribute("data-item-id", "c");

    act(() => {
      result.current.handleFocus({
        target: fakeTarget,
      } as unknown as React.FocusEvent);
    });

    act(() => {
      result.current.handleKeyDown({
        key: "ArrowDown",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(result.current.focusedId).toBe("a");
  });

  it("ArrowUp moves focusedId to previous item", () => {
    const { result } = setup();
    const fakeTarget = document.createElement("button");
    fakeTarget.setAttribute("data-item-id", "b");

    act(() => {
      result.current.handleFocus({
        target: fakeTarget,
      } as unknown as React.FocusEvent);
    });

    act(() => {
      result.current.handleKeyDown({
        key: "ArrowUp",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(result.current.focusedId).toBe("a");
  });

  it("ArrowUp wraps from first to last", () => {
    const { result } = setup();
    const fakeTarget = document.createElement("button");
    fakeTarget.setAttribute("data-item-id", "a");

    act(() => {
      result.current.handleFocus({
        target: fakeTarget,
      } as unknown as React.FocusEvent);
    });

    act(() => {
      result.current.handleKeyDown({
        key: "ArrowUp",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(result.current.focusedId).toBe("c");
  });

  it("Home moves focusedId to first item", () => {
    const { result } = setup();
    const fakeTarget = document.createElement("button");
    fakeTarget.setAttribute("data-item-id", "c");

    act(() => {
      result.current.handleFocus({
        target: fakeTarget,
      } as unknown as React.FocusEvent);
    });

    act(() => {
      result.current.handleKeyDown({
        key: "Home",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(result.current.focusedId).toBe("a");
  });

  it("End moves focusedId to last item", () => {
    const { result } = setup();
    const fakeTarget = document.createElement("button");
    fakeTarget.setAttribute("data-item-id", "a");

    act(() => {
      result.current.handleFocus({
        target: fakeTarget,
      } as unknown as React.FocusEvent);
    });

    act(() => {
      result.current.handleKeyDown({
        key: "End",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(result.current.focusedId).toBe("c");
  });

  it("Enter calls onActivate with the focused item id", () => {
    const { result } = setup();
    const fakeTarget = document.createElement("button");
    fakeTarget.setAttribute("data-item-id", "b");

    act(() => {
      result.current.handleFocus({
        target: fakeTarget,
      } as unknown as React.FocusEvent);
    });

    act(() => {
      result.current.handleKeyDown({
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });

    expect(onActivate).toHaveBeenCalledWith("b");
  });

  it("unhandled keys do not call preventDefault", () => {
    const { result } = setup();
    const preventDefault = vi.fn();

    act(() => {
      result.current.handleKeyDown({
        key: "Tab",
        preventDefault,
      } as unknown as React.KeyboardEvent);
    });

    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("tabbableId falls back to first item when focusedId is stale", () => {
    const { result, rerender } = renderHook(
      ({ itemIds }) => {
        const containerRef = useRef<HTMLDivElement>(null);
        return useRovingTabindex({ itemIds, onActivate, containerRef });
      },
      { initialProps: { itemIds: ["a", "b", "c"] } },
    );

    // Focus on "b"
    const fakeTarget = document.createElement("button");
    fakeTarget.setAttribute("data-item-id", "b");
    act(() => {
      result.current.handleFocus({
        target: fakeTarget,
      } as unknown as React.FocusEvent);
    });
    expect(result.current.tabbableId).toBe("b");

    // Remove "b" from the list (e.g., filter changed)
    rerender({ itemIds: ["a", "c"] });
    expect(result.current.tabbableId).toBe("a");
  });
});
