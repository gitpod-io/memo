import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRowSelection } from "./use-row-selection";

const rowIds = ["row-1", "row-2", "row-3", "row-4", "row-5"];

describe("useRowSelection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with empty selection", () => {
    const { result } = renderHook(() =>
      useRowSelection({ rowIds }),
    );
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.isIndeterminate).toBe(false);
  });

  it("toggles a single row", () => {
    const { result } = renderHook(() =>
      useRowSelection({ rowIds }),
    );

    act(() => result.current.toggle("row-2"));
    expect(result.current.isSelected("row-2")).toBe(true);
    expect(result.current.selectedIds.size).toBe(1);
    expect(result.current.isIndeterminate).toBe(true);

    // Toggle off
    act(() => result.current.toggle("row-2"));
    expect(result.current.isSelected("row-2")).toBe(false);
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("toggleAll selects all, then deselects all", () => {
    const { result } = renderHook(() =>
      useRowSelection({ rowIds }),
    );

    act(() => result.current.toggleAll());
    expect(result.current.isAllSelected).toBe(true);
    expect(result.current.selectedIds.size).toBe(5);

    act(() => result.current.toggleAll());
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("shift+click selects a range", () => {
    const { result } = renderHook(() =>
      useRowSelection({ rowIds }),
    );

    // First click on row-1 (no shift)
    act(() => result.current.toggle("row-1"));
    expect(result.current.selectedIds.size).toBe(1);

    // Shift+click on row-4 — should select row-1 through row-4
    act(() => result.current.toggle("row-4", true));
    expect(result.current.selectedIds.size).toBe(4);
    expect(result.current.isSelected("row-1")).toBe(true);
    expect(result.current.isSelected("row-2")).toBe(true);
    expect(result.current.isSelected("row-3")).toBe(true);
    expect(result.current.isSelected("row-4")).toBe(true);
    expect(result.current.isSelected("row-5")).toBe(false);
  });

  it("clear empties the selection", () => {
    const { result } = renderHook(() =>
      useRowSelection({ rowIds }),
    );

    act(() => result.current.toggleAll());
    expect(result.current.selectedIds.size).toBe(5);

    act(() => result.current.clear());
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("resets selection when resetKey changes", () => {
    const { result, rerender } = renderHook(
      ({ resetKey }: { resetKey: string }) =>
        useRowSelection({ rowIds, resetKey }),
      { initialProps: { resetKey: "view-1" } },
    );

    act(() => result.current.toggleAll());
    expect(result.current.selectedIds.size).toBe(5);

    rerender({ resetKey: "view-2" });
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("prunes selection when rowIds change (filtering)", () => {
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) =>
        useRowSelection({ rowIds: ids }),
      { initialProps: { ids: rowIds } },
    );

    act(() => result.current.toggleAll());
    expect(result.current.selectedIds.size).toBe(5);

    // Simulate filter removing row-3 and row-5
    rerender({ ids: ["row-1", "row-2", "row-4"] });
    expect(result.current.selectedIds.size).toBe(3);
    expect(result.current.isSelected("row-3")).toBe(false);
    expect(result.current.isSelected("row-5")).toBe(false);
  });

  it("Escape key clears selection", () => {
    const { result } = renderHook(() =>
      useRowSelection({ rowIds }),
    );

    act(() => result.current.toggle("row-1"));
    expect(result.current.selectedIds.size).toBe(1);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("isIndeterminate is true when some but not all rows selected", () => {
    const { result } = renderHook(() =>
      useRowSelection({ rowIds }),
    );

    act(() => result.current.toggle("row-1"));
    act(() => result.current.toggle("row-3"));
    expect(result.current.isIndeterminate).toBe(true);
    expect(result.current.isAllSelected).toBe(false);
  });

  it("handles empty rowIds", () => {
    const { result } = renderHook(() =>
      useRowSelection({ rowIds: [] }),
    );
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.isIndeterminate).toBe(false);
  });
});
