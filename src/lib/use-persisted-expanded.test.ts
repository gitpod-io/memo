import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePersistedExpanded } from "./use-persisted-expanded";

const STORAGE_KEY = "memo:tree-expanded:ws-1";

describe("usePersistedExpanded", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty set when workspaceId is null", () => {
    const { result } = renderHook(() => usePersistedExpanded(null));
    expect(result.current.expanded.size).toBe(0);
  });

  it("initializes from localStorage on mount", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["a", "b"]));
    const { result } = renderHook(() => usePersistedExpanded("ws-1"));
    expect(result.current.expanded).toEqual(new Set(["a", "b"]));
  });

  it("persists expanded state to localStorage after debounce", async () => {
    const { result } = renderHook(() => usePersistedExpanded("ws-1"));

    act(() => {
      result.current.setExpanded(new Set(["x", "y"]));
    });

    // Not yet persisted (debounce)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(350);
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(new Set(stored)).toEqual(new Set(["x", "y"]));
  });

  it("supports updater function for setExpanded", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["a"]));
    const { result } = renderHook(() => usePersistedExpanded("ws-1"));

    act(() => {
      result.current.setExpanded((prev) => {
        const next = new Set(prev);
        next.add("b");
        return next;
      });
    });

    expect(result.current.expanded).toEqual(new Set(["a", "b"]));
  });

  it("removeFromPersisted removes deleted IDs", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["a", "b", "c"]));
    const { result } = renderHook(() => usePersistedExpanded("ws-1"));

    act(() => {
      result.current.removeFromPersisted(new Set(["a", "c"]));
    });

    expect(result.current.expanded).toEqual(new Set(["b"]));

    // Flush debounce
    act(() => {
      vi.advanceTimersByTime(350);
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual(["b"]);
  });

  it("reloads state when workspaceId changes", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["a"]));
    localStorage.setItem(
      "memo:tree-expanded:ws-2",
      JSON.stringify(["x", "y"]),
    );

    const { result, rerender } = renderHook(
      ({ wsId }: { wsId: string | null }) => usePersistedExpanded(wsId),
      { initialProps: { wsId: "ws-1" as string | null } },
    );

    expect(result.current.expanded).toEqual(new Set(["a"]));

    rerender({ wsId: "ws-2" });
    expect(result.current.expanded).toEqual(new Set(["x", "y"]));
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem(STORAGE_KEY, "not-json{{{");
    const { result } = renderHook(() => usePersistedExpanded("ws-1"));
    expect(result.current.expanded.size).toBe(0);
  });

  it("filters non-string values from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["a", 123, null, "b"]));
    const { result } = renderHook(() => usePersistedExpanded("ws-1"));
    expect(result.current.expanded).toEqual(new Set(["a", "b"]));
  });

  it("removeFromPersisted is a no-op when IDs are not present", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["a"]));
    const { result } = renderHook(() => usePersistedExpanded("ws-1"));

    const before = result.current.expanded;
    act(() => {
      result.current.removeFromPersisted(new Set(["z"]));
    });

    // Same reference — no unnecessary re-render
    expect(result.current.expanded).toBe(before);
  });
});
