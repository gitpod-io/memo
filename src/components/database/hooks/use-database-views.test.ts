import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const addViewMock = vi.fn();
const updateViewMock = vi.fn();
const deleteViewMock = vi.fn();
const reorderViewsMock = vi.fn();
const loadDatabaseMock = vi.fn();
const toastErrorMock = vi.fn();
const replaceStateMock = vi.fn();
const captureSupabaseErrorMock = vi.fn();
const isInsufficientPrivilegeErrorMock = vi.fn((_error: unknown) => false);

// Track the current search params value so the mock returns it
let currentSearchParams = new URLSearchParams();

vi.mock("@/lib/database", () => ({
  addView: (...args: unknown[]) => addViewMock(...args),
  updateView: (...args: unknown[]) => updateViewMock(...args),
  deleteView: (...args: unknown[]) => deleteViewMock(...args),
  reorderViews: (...args: unknown[]) => reorderViewsMock(...args),
  loadDatabase: (...args: unknown[]) => loadDatabaseMock(...args),
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: (error: unknown, operation: unknown) => captureSupabaseErrorMock(error, operation),
  isInsufficientPrivilegeError: (error: unknown) => isInsufficientPrivilegeErrorMock(error),
}));

vi.mock("@/components/database/view-tabs", () => ({
  VIEW_TYPE_LABELS: {
    table: "Table",
    board: "Board",
    list: "List",
    calendar: "Calendar",
    gallery: "Gallery",
  },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => currentSearchParams,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  useDatabaseViews,
  type UseDatabaseViewsParams,
} from "./use-database-views";
import type {
  DatabaseProperty,
  DatabaseView,
  DatabaseViewConfig,
} from "@/lib/types";

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
  overrides?: Partial<DatabaseView>,
): DatabaseView {
  return {
    id,
    database_id: "db-1",
    name: "Table view",
    type: "table",
    config: {},
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function setup(overrides?: {
  views?: DatabaseView[];
  properties?: DatabaseProperty[];
  searchParams?: URLSearchParams;
}) {
  const views = overrides?.views ?? [
    makeView("view-1", { name: "Table view", position: 0 }),
  ];
  const properties = overrides?.properties ?? [
    makeProp("title-prop", "Title"),
  ];

  currentSearchParams = overrides?.searchParams ?? new URLSearchParams();

  const setViews = vi.fn((updater) => {
    if (typeof updater === "function") return updater(views);
    return updater;
  });

  const initialProps: UseDatabaseViewsParams = {
    pageId: "db-1",
    properties,
    views,
    setViews,
  };

  const hookResult = renderHook(
    (props: UseDatabaseViewsParams) => useDatabaseViews(props),
    { initialProps },
  );

  return { ...hookResult, setViews, views };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useDatabaseViews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    // Mock window.history.replaceState
    replaceStateMock.mockReset();
    vi.spyOn(window.history, "replaceState").mockImplementation(replaceStateMock);
  });

  // -------------------------------------------------------------------------
  // activeViewId
  // -------------------------------------------------------------------------

  describe("activeViewId", () => {
    it("defaults to first view when no URL param", () => {
      const { result } = setup();
      expect(result.current.activeViewId).toBe("view-1");
    });

    it("uses view from URL param when valid", () => {
      const views = [
        makeView("view-1", { position: 0 }),
        makeView("view-2", { position: 1 }),
      ];
      const { result } = setup({
        views,
        searchParams: new URLSearchParams("view=view-2"),
      });
      expect(result.current.activeViewId).toBe("view-2");
    });

    it("falls back to first view when URL param is invalid", () => {
      const { result } = setup({
        searchParams: new URLSearchParams("view=nonexistent"),
      });
      expect(result.current.activeViewId).toBe("view-1");
    });

    it("returns empty string when no views exist", () => {
      const { result } = setup({ views: [] });
      expect(result.current.activeViewId).toBe("");
    });
  });

  // -------------------------------------------------------------------------
  // handleViewChange
  // -------------------------------------------------------------------------

  describe("handleViewChange", () => {
    it("updates URL param via replaceState", () => {
      const { result } = setup();

      act(() => {
        result.current.handleViewChange("view-2");
      });

      expect(replaceStateMock).toHaveBeenCalledWith(
        null,
        "",
        "?view=view-2",
      );
    });
  });

  // -------------------------------------------------------------------------
  // handleAddView
  // -------------------------------------------------------------------------

  describe("handleAddView", () => {
    it("creates a table view with default config", async () => {
      const newView = makeView("new-view", {
        name: "Table view",
        type: "table",
      });
      addViewMock.mockResolvedValue({ data: newView, error: null });

      const { result, setViews } = setup();

      await act(async () => {
        await result.current.handleAddView("table");
      });

      expect(addViewMock).toHaveBeenCalledWith(
        "db-1",
        "Table view",
        "table",
        {},
      );
      const updater = setViews.mock.calls[0][0];
      const updated = updater([makeView("view-1")]);
      expect(updated).toHaveLength(2);
      expect(updated[1].id).toBe("new-view");
      // Switches to new view
      expect(replaceStateMock).toHaveBeenCalled();
    });

    it("auto-detects group_by for board view from select property", async () => {
      const newView = makeView("board-view", { type: "board" });
      addViewMock.mockResolvedValue({ data: newView, error: null });

      const properties = [
        makeProp("title-prop", "Title"),
        makeProp("status-prop", "Status", "select"),
      ];
      const { result } = setup({ properties });

      await act(async () => {
        await result.current.handleAddView("board");
      });

      expect(addViewMock).toHaveBeenCalledWith(
        "db-1",
        "Board view",
        "board",
        { group_by: "status-prop" },
      );
    });

    it("auto-detects group_by for board view from status property", async () => {
      const newView = makeView("board-view", { type: "board" });
      addViewMock.mockResolvedValue({ data: newView, error: null });

      const properties = [
        makeProp("title-prop", "Title"),
        makeProp("st-prop", "Progress", "status"),
      ];
      const { result } = setup({ properties });

      await act(async () => {
        await result.current.handleAddView("board");
      });

      expect(addViewMock).toHaveBeenCalledWith(
        "db-1",
        "Board view",
        "board",
        { group_by: "st-prop" },
      );
    });

    it("auto-detects date_property for calendar view", async () => {
      const newView = makeView("cal-view", { type: "calendar" });
      addViewMock.mockResolvedValue({ data: newView, error: null });

      const properties = [
        makeProp("title-prop", "Title"),
        makeProp("date-prop", "Due Date", "date"),
      ];
      const { result } = setup({ properties });

      await act(async () => {
        await result.current.handleAddView("calendar");
      });

      expect(addViewMock).toHaveBeenCalledWith(
        "db-1",
        "Calendar view",
        "calendar",
        { date_property: "date-prop" },
      );
    });

    it("shows toast and captures Sentry error on failure", async () => {
      const error = new Error("failed");
      addViewMock.mockResolvedValue({
        data: null,
        error,
      });

      const { result, setViews } = setup();

      await act(async () => {
        await result.current.handleAddView("table");
      });

      expect(toastErrorMock).toHaveBeenCalledWith("Failed to create view", expect.objectContaining({ duration: 8000 }));
      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "database-views:create");
      expect(setViews).not.toHaveBeenCalled();
    });

    it("skips Sentry capture for insufficient privilege on create", async () => {
      const error = new Error("violates row-level security policy");
      isInsufficientPrivilegeErrorMock.mockReturnValueOnce(true);
      addViewMock.mockResolvedValue({
        data: null,
        error,
      });

      const { result } = setup();

      await act(async () => {
        await result.current.handleAddView("table");
      });

      expect(toastErrorMock).toHaveBeenCalled();
      expect(captureSupabaseErrorMock).not.toHaveBeenCalled();
    });

    it("passes a Retry action that re-invokes handleAddView", async () => {
      addViewMock.mockResolvedValue({
        data: null,
        error: new Error("network error"),
      });

      const { result } = setup();

      await act(async () => {
        await result.current.handleAddView("board");
      });

      const call = toastErrorMock.mock.calls[0];
      expect(call[1]).toMatchObject({
        action: { label: "Retry", onClick: expect.any(Function) },
      });

      // Invoke the retry callback — it should call addView again
      addViewMock.mockClear();
      addViewMock.mockResolvedValue({
        data: makeView("view-new", { type: "board" }),
        error: null,
      });
      await act(async () => {
        call[1].action.onClick();
      });
      expect(addViewMock).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // handleViewConfigChange
  // -------------------------------------------------------------------------

  describe("handleViewConfigChange", () => {
    it("optimistically updates config and persists", async () => {
      updateViewMock.mockResolvedValue({ data: null, error: null });

      const views = [
        makeView("view-1", { config: { row_height: "default" } }),
      ];
      const { result, setViews } = setup({ views });

      await act(async () => {
        await result.current.handleViewConfigChange({
          row_height: "compact",
        });
      });

      // Optimistic update
      const updater = setViews.mock.calls[0][0];
      const updated = updater(views);
      expect(updated[0].config).toEqual({
        row_height: "compact",
      });

      expect(updateViewMock).toHaveBeenCalledWith(
        "view-1",
        { config: { row_height: "compact" } },
        "db-1",
      );
    });

    it("reverts on failure and captures Sentry error", async () => {
      const error = new Error("failed");
      updateViewMock.mockResolvedValue({
        data: null,
        error,
      });

      const views = [
        makeView("view-1", { config: { row_height: "default" } }),
      ];
      const { result, setViews } = setup({ views });

      await act(async () => {
        await result.current.handleViewConfigChange({
          row_height: "tall",
        });
      });

      expect(toastErrorMock).toHaveBeenCalledWith(
        "Failed to update view configuration",
        expect.objectContaining({ duration: 8000 }),
      );
      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "database-views:update-config");
      // Revert: second setViews call restores original config
      expect(setViews).toHaveBeenCalledTimes(2);
      const revertUpdater = setViews.mock.calls[1][0];
      const reverted = revertUpdater([
        makeView("view-1", { config: { row_height: "tall" } }),
      ]);
      expect(reverted[0].config).toEqual({ row_height: "default" });
    });

    it("does nothing when no active view", async () => {
      const { result } = setup({ views: [] });

      await act(async () => {
        await result.current.handleViewConfigChange({ row_height: "compact" });
      });

      expect(updateViewMock).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // handleRenameView
  // -------------------------------------------------------------------------

  describe("handleRenameView", () => {
    it("renames view and updates state on success", async () => {
      const updatedView = makeView("view-1", { name: "New Name" });
      updateViewMock.mockResolvedValue({ data: updatedView, error: null });

      const { result, setViews } = setup();

      await act(async () => {
        await result.current.handleRenameView("view-1", "New Name");
      });

      expect(updateViewMock).toHaveBeenCalledWith(
        "view-1",
        { name: "New Name" },
        "db-1",
      );
      const updater = setViews.mock.calls[0][0];
      const updated = updater([makeView("view-1")]);
      expect(updated[0].name).toBe("New Name");
    });

    it("shows toast and captures Sentry error on failure", async () => {
      const error = new Error("rename failed");
      updateViewMock.mockResolvedValue({
        data: null,
        error,
      });

      const { result, setViews } = setup();

      await act(async () => {
        await result.current.handleRenameView("view-1", "New Name");
      });

      expect(toastErrorMock).toHaveBeenCalledWith("Failed to rename view", expect.objectContaining({ duration: 8000 }));
      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "database-views:rename");
      expect(setViews).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // handleDeleteView
  // -------------------------------------------------------------------------

  describe("handleDeleteView", () => {
    it("deletes view and switches to first remaining", async () => {
      deleteViewMock.mockResolvedValue({ error: null });

      const views = [
        makeView("view-1", { position: 0 }),
        makeView("view-2", { position: 1 }),
      ];
      const { result, setViews } = setup({ views });

      await act(async () => {
        await result.current.handleDeleteView("view-1");
      });

      expect(deleteViewMock).toHaveBeenCalledWith("view-1", "db-1");
      const updater = setViews.mock.calls[0][0];
      const updated = updater(views);
      expect(updated).toHaveLength(1);
      expect(updated[0].id).toBe("view-2");
      // Switches to remaining view
      expect(replaceStateMock).toHaveBeenCalled();
    });

    it("shows toast with error message and captures Sentry error on failure", async () => {
      const error = { message: "Cannot delete last view" };
      deleteViewMock.mockResolvedValue({
        error,
      });

      const { result, setViews } = setup();

      await act(async () => {
        await result.current.handleDeleteView("view-1");
      });

      expect(toastErrorMock).toHaveBeenCalledWith(
        "Cannot delete last view",
        expect.objectContaining({ duration: 8000 }),
      );
      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "database-views:delete");
      expect(setViews).not.toHaveBeenCalled();
    });

    it("uses fallback message when error has no message", async () => {
      deleteViewMock.mockResolvedValue({
        error: { message: "" },
      });

      const { result } = setup();

      await act(async () => {
        await result.current.handleDeleteView("view-1");
      });

      expect(toastErrorMock).toHaveBeenCalledWith(
        "Failed to delete view",
        expect.objectContaining({ duration: 8000 }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // handleDuplicateView
  // -------------------------------------------------------------------------

  describe("handleDuplicateView", () => {
    it("duplicates view with (copy) suffix and same config", async () => {
      const sourceConfig: DatabaseViewConfig = {
        row_height: "compact",
        sorts: [{ property_id: "p1", direction: "asc" }],
      };
      const views = [
        makeView("view-1", {
          name: "My View",
          type: "table",
          config: sourceConfig,
        }),
      ];
      const duplicated = makeView("view-copy", {
        name: "My View (copy)",
        type: "table",
        config: { ...sourceConfig },
      });
      addViewMock.mockResolvedValue({ data: duplicated, error: null });

      const { result, setViews } = setup({ views });

      await act(async () => {
        await result.current.handleDuplicateView("view-1");
      });

      expect(addViewMock).toHaveBeenCalledWith(
        "db-1",
        "My View (copy)",
        "table",
        { ...sourceConfig },
      );
      const updater = setViews.mock.calls[0][0];
      const updated = updater(views);
      expect(updated).toHaveLength(2);
      // Switches to duplicated view
      expect(replaceStateMock).toHaveBeenCalled();
    });

    it("does nothing for nonexistent source view", async () => {
      const { result } = setup();

      await act(async () => {
        await result.current.handleDuplicateView("nonexistent");
      });

      expect(addViewMock).not.toHaveBeenCalled();
    });

    it("shows toast and captures Sentry error on failure", async () => {
      const error = new Error("failed");
      addViewMock.mockResolvedValue({
        data: null,
        error,
      });

      const { result, setViews } = setup();

      await act(async () => {
        await result.current.handleDuplicateView("view-1");
      });

      expect(toastErrorMock).toHaveBeenCalledWith(
        "Failed to duplicate view",
        expect.objectContaining({ duration: 8000 }),
      );
      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "database-views:duplicate");
      expect(setViews).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // handleReorderViews
  // -------------------------------------------------------------------------

  describe("handleReorderViews", () => {
    it("reorders views optimistically", async () => {
      reorderViewsMock.mockResolvedValue({ error: null });

      const views = [
        makeView("v-a", { position: 0 }),
        makeView("v-b", { position: 1 }),
        makeView("v-c", { position: 2 }),
      ];
      const { result, setViews } = setup({ views });

      await act(async () => {
        await result.current.handleReorderViews(["v-c", "v-a", "v-b"]);
      });

      const updater = setViews.mock.calls[0][0];
      const updated = updater(views);
      expect(updated.map((v: DatabaseView) => v.id)).toEqual([
        "v-c",
        "v-a",
        "v-b",
      ]);
      expect(updated[0].position).toBe(0);
      expect(updated[1].position).toBe(1);
      expect(updated[2].position).toBe(2);

      expect(reorderViewsMock).toHaveBeenCalledWith("db-1", [
        "v-c",
        "v-a",
        "v-b",
      ]);
    });

    it("reloads on reorder failure and captures Sentry error", async () => {
      const error = new Error("reorder failed");
      reorderViewsMock.mockResolvedValue({
        error,
      });
      loadDatabaseMock.mockResolvedValue({
        data: {
          views: [
            makeView("v-a", { position: 0 }),
            makeView("v-b", { position: 1 }),
          ],
        },
        error: null,
      });

      const views = [
        makeView("v-a", { position: 0 }),
        makeView("v-b", { position: 1 }),
      ];
      const { result, setViews } = setup({ views });

      await act(async () => {
        await result.current.handleReorderViews(["v-b", "v-a"]);
      });

      expect(toastErrorMock).toHaveBeenCalledWith(
        "Failed to reorder views",
        expect.objectContaining({ duration: 8000 }),
      );
      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "database-views:reorder");
      expect(loadDatabaseMock).toHaveBeenCalledWith("db-1");
      // setViews called with reloaded data
      const lastCall = setViews.mock.calls[setViews.mock.calls.length - 1][0];
      expect(lastCall).toEqual([
        makeView("v-a", { position: 0 }),
        makeView("v-b", { position: 1 }),
      ]);
    });
  });
});
