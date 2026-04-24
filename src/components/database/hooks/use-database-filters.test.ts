import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const updateViewMock = vi.fn();
const toastErrorMock = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock needs flexible arity
const sortRowsMock = vi.fn((...args: any[]) => args[0]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock needs flexible arity
const filterRowsMock = vi.fn((...args: any[]) => args[0]);

vi.mock("@/lib/database", () => ({
  updateView: (...args: unknown[]) => updateViewMock(...args),
}));

vi.mock("@/lib/database-filters", () => ({
  sortRows: (rows: unknown[], sorts: unknown[], props: unknown[]) =>
    sortRowsMock(rows, sorts, props),
  filterRows: (rows: unknown[], filters: unknown[], props: unknown[]) =>
    filterRowsMock(rows, filters, props),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  useDatabaseFilters,
  type UseDatabaseFiltersParams,
} from "./use-database-filters";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseView,
} from "@/lib/types";
import type { SortRule, FilterRule } from "@/lib/database-filters";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProp(
  id: string,
  name: string,
  type: DatabaseProperty["type"] = "text",
): DatabaseProperty {
  return {
    id,
    database_id: "db-1",
    name,
    type,
    config: {},
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

function makeView(
  id: string,
  config: DatabaseView["config"] = {},
): DatabaseView {
  return {
    id,
    database_id: "db-1",
    name: "Table view",
    type: "table",
    config,
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

function makeRow(id: string): DatabaseRow {
  return {
    page: {
      id,
      title: `Row ${id}`,
      icon: null,
      cover_url: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      created_by: "user-1",
    },
    values: {},
  };
}

function setup(overrides?: Partial<UseDatabaseFiltersParams>) {
  const activeView = overrides?.activeView ?? makeView("view-1");
  const rows = overrides?.rows ?? [makeRow("row-1"), makeRow("row-2")];
  const properties = overrides?.properties ?? [makeProp("p1", "Title")];

  const setViews = vi.fn((updater) => {
    if (typeof updater === "function") {
      return updater([activeView]);
    }
    return updater;
  });

  const initialProps: UseDatabaseFiltersParams = {
    pageId: "db-1",
    activeView,
    rows,
    properties,
    setViews,
    ...overrides,
    // Ensure setViews from overrides or our default is used
  };
  // Override setViews if not provided
  if (!overrides?.setViews) {
    initialProps.setViews = setViews;
  }

  const hookResult = renderHook(
    (props: UseDatabaseFiltersParams) => useDatabaseFilters(props),
    { initialProps },
  );

  return { ...hookResult, setViews: initialProps.setViews as ReturnType<typeof vi.fn> };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useDatabaseFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset sort/filter mocks to pass-through
    sortRowsMock.mockImplementation((rows: unknown[]) => rows);
    filterRowsMock.mockImplementation((rows: unknown[]) => rows);
  });

  // -------------------------------------------------------------------------
  // activeSorts / activeFilters
  // -------------------------------------------------------------------------

  describe("activeSorts and activeFilters", () => {
    it("extracts sorts from active view config", () => {
      const sorts: SortRule[] = [
        { property_id: "p1", direction: "asc" },
      ];
      const { result } = setup({
        activeView: makeView("view-1", { sorts }),
      });

      expect(result.current.activeSorts).toEqual(sorts);
    });

    it("extracts filters from active view config", () => {
      const filters: FilterRule[] = [
        { property_id: "p1", operator: "is_not_empty", value: null },
      ];
      const { result } = setup({
        activeView: makeView("view-1", {
          filters: filters as DatabaseView["config"]["filters"],
        }),
      });

      expect(result.current.activeFilters).toEqual(filters);
    });

    it("defaults to empty arrays when no sorts/filters in config", () => {
      const { result } = setup({
        activeView: makeView("view-1", {}),
      });

      expect(result.current.activeSorts).toEqual([]);
      expect(result.current.activeFilters).toEqual([]);
    });

    it("defaults to empty arrays when activeView is undefined", () => {
      const { result } = setup({ activeView: undefined });

      expect(result.current.activeSorts).toEqual([]);
      expect(result.current.activeFilters).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // displayedRows
  // -------------------------------------------------------------------------

  describe("displayedRows", () => {
    it("returns rows unchanged when no sorts or filters", () => {
      const rows = [makeRow("r1"), makeRow("r2")];
      const { result } = setup({ rows });

      expect(result.current.displayedRows).toEqual(rows);
      expect(sortRowsMock).not.toHaveBeenCalled();
      expect(filterRowsMock).not.toHaveBeenCalled();
    });

    it("applies filters when present", () => {
      const rows = [makeRow("r1"), makeRow("r2")];
      const filtered = [makeRow("r1")];
      filterRowsMock.mockReturnValue(filtered);

      const filters: FilterRule[] = [
        { property_id: "p1", operator: "is_not_empty", value: null },
      ];
      const properties = [makeProp("p1", "Title")];
      const { result } = setup({
        rows,
        properties,
        activeView: makeView("view-1", {
          filters: filters as DatabaseView["config"]["filters"],
        }),
      });

      expect(result.current.displayedRows).toEqual(filtered);
      expect(filterRowsMock).toHaveBeenCalledWith(rows, filters, properties);
    });

    it("applies sorts when present", () => {
      const rows = [makeRow("r1"), makeRow("r2")];
      const sorted = [makeRow("r2"), makeRow("r1")];
      sortRowsMock.mockReturnValue(sorted);

      const sorts: SortRule[] = [
        { property_id: "p1", direction: "desc" },
      ];
      const properties = [makeProp("p1", "Title")];
      const { result } = setup({
        rows,
        properties,
        activeView: makeView("view-1", { sorts }),
      });

      expect(result.current.displayedRows).toEqual(sorted);
      expect(sortRowsMock).toHaveBeenCalledWith(rows, sorts, properties);
    });

    it("applies filters then sorts when both present", () => {
      const rows = [makeRow("r1"), makeRow("r2"), makeRow("r3")];
      const filtered = [makeRow("r1"), makeRow("r3")];
      const sorted = [makeRow("r3"), makeRow("r1")];
      filterRowsMock.mockReturnValue(filtered);
      sortRowsMock.mockReturnValue(sorted);

      const sorts: SortRule[] = [
        { property_id: "p1", direction: "desc" },
      ];
      const filters: FilterRule[] = [
        { property_id: "p1", operator: "is_not_empty", value: null },
      ];
      const { result } = setup({
        rows,
        activeView: makeView("view-1", {
          sorts,
          filters: filters as DatabaseView["config"]["filters"],
        }),
      });

      expect(result.current.displayedRows).toEqual(sorted);
      // filterRows is called with original rows
      expect(filterRowsMock).toHaveBeenCalled();
      // sortRows is called with filtered result
      expect(sortRowsMock).toHaveBeenCalledWith(
        filtered,
        sorts,
        expect.any(Array),
      );
    });
  });

  // -------------------------------------------------------------------------
  // handleSortsChange
  // -------------------------------------------------------------------------

  describe("handleSortsChange", () => {
    it("persists new sorts to view config", async () => {
      updateViewMock.mockResolvedValue({ data: null, error: null });

      const { result, setViews } = setup();

      const newSorts: SortRule[] = [
        { property_id: "p1", direction: "asc" },
      ];

      await act(async () => {
        await result.current.handleSortsChange(newSorts);
      });

      // Optimistic update
      const updater = setViews.mock.calls[0][0];
      const updated = updater([makeView("view-1")]);
      expect(updated[0].config.sorts).toEqual(newSorts);

      expect(updateViewMock).toHaveBeenCalledWith(
        "view-1",
        { config: { sorts: newSorts } },
        "db-1",
      );
    });

    it("shows toast on failure", async () => {
      updateViewMock.mockResolvedValue({
        data: null,
        error: new Error("failed"),
      });

      const { result } = setup();

      await act(async () => {
        await result.current.handleSortsChange([
          { property_id: "p1", direction: "asc" },
        ]);
      });

      expect(toastErrorMock).toHaveBeenCalledWith("Failed to update sort", {
        duration: 8000,
      });
    });

    it("does nothing when no active view", async () => {
      const { result } = setup({ activeView: undefined });

      await act(async () => {
        await result.current.handleSortsChange([
          { property_id: "p1", direction: "asc" },
        ]);
      });

      expect(updateViewMock).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // handleFiltersChange
  // -------------------------------------------------------------------------

  describe("handleFiltersChange", () => {
    it("persists new filters to view config", async () => {
      updateViewMock.mockResolvedValue({ data: null, error: null });

      const { result, setViews } = setup();

      const newFilters: FilterRule[] = [
        { property_id: "p1", operator: "is_not_empty", value: null },
      ];

      await act(async () => {
        await result.current.handleFiltersChange(newFilters);
      });

      // Optimistic update
      const updater = setViews.mock.calls[0][0];
      const updated = updater([makeView("view-1")]);
      expect(updated[0].config.filters).toEqual(newFilters);

      expect(updateViewMock).toHaveBeenCalledWith(
        "view-1",
        { config: { filters: newFilters } },
        "db-1",
      );
    });

    it("shows toast on failure", async () => {
      updateViewMock.mockResolvedValue({
        data: null,
        error: new Error("failed"),
      });

      const { result } = setup();

      await act(async () => {
        await result.current.handleFiltersChange([
          { property_id: "p1", operator: "is_not_empty", value: null },
        ]);
      });

      expect(toastErrorMock).toHaveBeenCalledWith(
        "Failed to update filter",
        { duration: 8000 },
      );
    });

    it("does nothing when no active view", async () => {
      const { result } = setup({ activeView: undefined });

      await act(async () => {
        await result.current.handleFiltersChange([
          { property_id: "p1", operator: "is_not_empty", value: null },
        ]);
      });

      expect(updateViewMock).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // handleSortToggle
  // -------------------------------------------------------------------------

  describe("handleSortToggle", () => {
    it("adds asc sort for unsorted property", () => {
      updateViewMock.mockResolvedValue({ data: null, error: null });

      const { result, setViews } = setup({
        activeView: makeView("view-1", { sorts: [] }),
      });

      act(() => {
        result.current.handleSortToggle("p1");
      });

      // Optimistic update should add asc sort
      const updater = setViews.mock.calls[0][0];
      const updated = updater([makeView("view-1", { sorts: [] })]);
      expect(updated[0].config.sorts).toEqual([
        { property_id: "p1", direction: "asc" },
      ]);
    });

    it("toggles asc to desc", () => {
      updateViewMock.mockResolvedValue({ data: null, error: null });

      const sorts: SortRule[] = [
        { property_id: "p1", direction: "asc" },
      ];
      const { result, setViews } = setup({
        activeView: makeView("view-1", { sorts }),
      });

      act(() => {
        result.current.handleSortToggle("p1");
      });

      const updater = setViews.mock.calls[0][0];
      const updated = updater([makeView("view-1", { sorts })]);
      expect(updated[0].config.sorts).toEqual([
        { property_id: "p1", direction: "desc" },
      ]);
    });

    it("removes sort when already desc", () => {
      updateViewMock.mockResolvedValue({ data: null, error: null });

      const sorts: SortRule[] = [
        { property_id: "p1", direction: "desc" },
      ];
      const { result, setViews } = setup({
        activeView: makeView("view-1", { sorts }),
      });

      act(() => {
        result.current.handleSortToggle("p1");
      });

      const updater = setViews.mock.calls[0][0];
      const updated = updater([makeView("view-1", { sorts })]);
      expect(updated[0].config.sorts).toEqual([]);
    });

    it("preserves other sorts when toggling", () => {
      updateViewMock.mockResolvedValue({ data: null, error: null });

      const sorts: SortRule[] = [
        { property_id: "p1", direction: "asc" },
        { property_id: "p2", direction: "desc" },
      ];
      const { result, setViews } = setup({
        activeView: makeView("view-1", { sorts }),
      });

      act(() => {
        result.current.handleSortToggle("p1");
      });

      const updater = setViews.mock.calls[0][0];
      const updated = updater([makeView("view-1", { sorts })]);
      expect(updated[0].config.sorts).toEqual([
        { property_id: "p1", direction: "desc" },
        { property_id: "p2", direction: "desc" },
      ]);
    });
  });
});
