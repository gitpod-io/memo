import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const addPropertyMock = vi.fn();
const updatePropertyMock = vi.fn();
const deletePropertyMock = vi.fn();
const reorderPropertiesMock = vi.fn();
const loadDatabaseMock = vi.fn();
const updateViewMock = vi.fn();
const toastErrorMock = vi.fn();
const captureSupabaseErrorMock = vi.fn();
const isInsufficientPrivilegeErrorMock = vi.fn((_error: unknown) => false);

vi.mock("@/lib/database", () => ({
  addProperty: (...args: unknown[]) => addPropertyMock(...args),
  updateProperty: (...args: unknown[]) => updatePropertyMock(...args),
  deleteProperty: (...args: unknown[]) => deletePropertyMock(...args),
  reorderProperties: (...args: unknown[]) => reorderPropertiesMock(...args),
  loadDatabase: (...args: unknown[]) => loadDatabaseMock(...args),
  updateView: (...args: unknown[]) => updateViewMock(...args),
}));

vi.mock("@/lib/column-helpers", () => ({
  generateColumnName: (type: string, _existing: Set<string>) =>
    `${type.charAt(0).toUpperCase() + type.slice(1)}`,
  getDefaultColumnConfig: (type: string) =>
    type === "status"
      ? { options: [{ id: "s1", name: "Todo", color: "gray" }] }
      : {},
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: (error: unknown, operation: unknown) => captureSupabaseErrorMock(error, operation),
  isInsufficientPrivilegeError: (error: unknown) => isInsufficientPrivilegeErrorMock(error),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  useDatabaseProperties,
  type UseDatabasePropertiesParams,
} from "./use-database-properties";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseView,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProp(
  id: string,
  name: string,
  position: number,
  type: DatabaseProperty["type"] = "text",
): DatabaseProperty {
  return {
    id,
    database_id: "db-1",
    name,
    type,
    config: {},
    position,
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

function makeRow(
  id: string,
  values: DatabaseRow["values"] = {},
): DatabaseRow {
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
    values,
  };
}

function setup(overrides?: {
  properties?: DatabaseProperty[];
  views?: DatabaseView[];
  rows?: DatabaseRow[];
}) {
  const properties = overrides?.properties ?? [
    makeProp("title-prop", "Title", 0),
    makeProp("prop-1", "Status", 1, "select"),
  ];
  const views = overrides?.views ?? [makeView("view-1")];
  const rows = overrides?.rows ?? [makeRow("row-1")];

  const setProperties = vi.fn((updater) => {
    if (typeof updater === "function") return updater(properties);
    return updater;
  });
  const setViews = vi.fn((updater) => {
    if (typeof updater === "function") return updater(views);
    return updater;
  });
  const setRows = vi.fn((updater) => {
    if (typeof updater === "function") return updater(rows);
    return updater;
  });

  const initialProps: UseDatabasePropertiesParams = {
    pageId: "db-1",
    properties,
    setProperties,
    views,
    setViews,
    setRows,
  };

  const hookResult = renderHook(
    (props: UseDatabasePropertiesParams) => useDatabaseProperties(props),
    { initialProps },
  );

  return { ...hookResult, setProperties, setViews, setRows, properties, views };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useDatabaseProperties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // handleAddColumn
  // -------------------------------------------------------------------------

  describe("handleAddColumn", () => {
    it("adds a property with generated name and default config", async () => {
      const newProp = makeProp("new-prop", "Text", 2);
      addPropertyMock.mockResolvedValue({ data: newProp, error: null });

      const { result, setProperties } = setup();

      await act(async () => {
        await result.current.handleAddColumn("text");
      });

      expect(addPropertyMock).toHaveBeenCalledWith(
        "db-1",
        "Text",
        "text",
        {},
      );
      const updater = setProperties.mock.calls[0][0];
      const updated = updater([makeProp("title-prop", "Title", 0)]);
      expect(updated).toHaveLength(2);
      expect(updated[1].id).toBe("new-prop");
    });

    it("passes status default config for status type", async () => {
      const newProp = makeProp("new-status", "Status", 2, "status");
      addPropertyMock.mockResolvedValue({ data: newProp, error: null });

      const { result } = setup();

      await act(async () => {
        await result.current.handleAddColumn("status");
      });

      expect(addPropertyMock).toHaveBeenCalledWith(
        "db-1",
        "Status",
        "status",
        { options: [{ id: "s1", name: "Todo", color: "gray" }] },
      );
    });

    it("shows toast and captures Sentry error on failure", async () => {
      const error = new Error("failed");
      addPropertyMock.mockResolvedValue({
        data: null,
        error,
      });

      const { result, setProperties } = setup();

      await act(async () => {
        await result.current.handleAddColumn("text");
      });

      expect(toastErrorMock).toHaveBeenCalledWith("Failed to add column", {
        duration: 8000,
      });
      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "database-properties:add");
      expect(setProperties).not.toHaveBeenCalled();
    });

    it("skips Sentry capture for insufficient privilege errors", async () => {
      const error = new Error("violates row-level security policy");
      isInsufficientPrivilegeErrorMock.mockReturnValueOnce(true);
      addPropertyMock.mockResolvedValue({
        data: null,
        error,
      });

      const { result } = setup();

      await act(async () => {
        await result.current.handleAddColumn("text");
      });

      expect(toastErrorMock).toHaveBeenCalledWith("Failed to add column", {
        duration: 8000,
      });
      expect(captureSupabaseErrorMock).not.toHaveBeenCalled();
    });

    it("guards against concurrent calls", async () => {
      // Use a deferred promise so we control when the first call resolves
      let resolveFirst!: (v: { data: DatabaseProperty; error: null }) => void;
      const firstCall = new Promise<{ data: DatabaseProperty; error: null }>(
        (r) => {
          resolveFirst = r;
        },
      );
      addPropertyMock.mockImplementationOnce(() => firstCall);

      const { result } = setup();

      // Start first call (don't await yet)
      const p1 = act(async () => {
        await result.current.handleAddColumn("text");
      });

      // Second call should be guarded — the ref is still true
      await act(async () => {
        await result.current.handleAddColumn("number");
      });

      // Resolve the first
      resolveFirst({ data: makeProp("p1", "Text", 2), error: null });
      await p1;

      // Only one addProperty call should have been made
      expect(addPropertyMock).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // handleColumnHeaderClick / handlePropertyRename
  // -------------------------------------------------------------------------

  describe("handlePropertyRename", () => {
    it("opens rename dialog and renames optimistically", async () => {
      updatePropertyMock.mockResolvedValue({ data: null, error: null });

      const { result, setProperties } = setup();

      // Open rename dialog
      act(() => {
        result.current.handleColumnHeaderClick("prop-1");
      });

      expect(result.current.renameDialogOpen).toBe(true);
      expect(result.current.renamingProperty).toEqual({
        id: "prop-1",
        name: "Status",
      });

      // Perform rename
      await act(async () => {
        await result.current.handlePropertyRename("Priority");
      });

      // Optimistic update
      const updater = setProperties.mock.calls[0][0];
      const updated = updater([
        makeProp("title-prop", "Title", 0),
        makeProp("prop-1", "Status", 1, "select"),
      ]);
      expect(updated[1].name).toBe("Priority");

      expect(updatePropertyMock).toHaveBeenCalledWith(
        "prop-1",
        { name: "Priority" },
        "db-1",
      );
    });

    it("reverts on rename failure and captures Sentry error", async () => {
      const error = new Error("rename failed");
      updatePropertyMock.mockResolvedValue({
        data: null,
        error,
      });

      const { result, setProperties } = setup();

      act(() => {
        result.current.handleColumnHeaderClick("prop-1");
      });

      await act(async () => {
        await result.current.handlePropertyRename("New Name");
      });

      expect(toastErrorMock).toHaveBeenCalledWith(
        "Failed to rename property",
        { duration: 8000 },
      );
      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "database-properties:rename");
      // Revert call: second setProperties call restores old name
      expect(setProperties).toHaveBeenCalledTimes(2);
      const revertUpdater = setProperties.mock.calls[1][0];
      const reverted = revertUpdater([
        makeProp("title-prop", "Title", 0),
        makeProp("prop-1", "New Name", 1, "select"),
      ]);
      expect(reverted[1].name).toBe("Status");
    });

    it("skips Sentry capture for insufficient privilege on rename", async () => {
      isInsufficientPrivilegeErrorMock.mockReturnValueOnce(true);
      updatePropertyMock.mockResolvedValue({
        data: null,
        error: new Error("42501"),
      });

      const { result } = setup();

      act(() => {
        result.current.handleColumnHeaderClick("prop-1");
      });

      await act(async () => {
        await result.current.handlePropertyRename("New Name");
      });

      expect(toastErrorMock).toHaveBeenCalled();
      expect(captureSupabaseErrorMock).not.toHaveBeenCalled();
    });

    it("does nothing when no property is being renamed", async () => {
      const { result } = setup();

      await act(async () => {
        await result.current.handlePropertyRename("Anything");
      });

      expect(updatePropertyMock).not.toHaveBeenCalled();
    });

    it("does nothing for unknown property id", () => {
      const { result } = setup();

      act(() => {
        result.current.handleColumnHeaderClick("nonexistent");
      });

      expect(result.current.renameDialogOpen).toBe(false);
      expect(result.current.renamingProperty).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // handleColumnReorder
  // -------------------------------------------------------------------------

  describe("handleColumnReorder", () => {
    it("reorders properties optimistically", async () => {
      reorderPropertiesMock.mockResolvedValue({ error: null });

      const props = [
        makeProp("p-a", "A", 0),
        makeProp("p-b", "B", 1),
        makeProp("p-c", "C", 2),
      ];
      const { result, setProperties } = setup({ properties: props });

      await act(async () => {
        await result.current.handleColumnReorder(["p-c", "p-a", "p-b"]);
      });

      const updater = setProperties.mock.calls[0][0];
      const updated = updater(props);
      expect(updated.map((p: DatabaseProperty) => p.id)).toEqual([
        "p-c",
        "p-a",
        "p-b",
      ]);
      expect(updated[0].position).toBe(0);
      expect(updated[1].position).toBe(1);
      expect(updated[2].position).toBe(2);

      expect(reorderPropertiesMock).toHaveBeenCalledWith("db-1", [
        "p-c",
        "p-a",
        "p-b",
      ]);
    });

    it("reverts on reorder failure and captures Sentry error", async () => {
      const error = new Error("reorder failed");
      reorderPropertiesMock.mockResolvedValue({
        error,
      });

      const props = [makeProp("p-a", "A", 0), makeProp("p-b", "B", 1)];
      const { result, setProperties } = setup({ properties: props });

      await act(async () => {
        await result.current.handleColumnReorder(["p-b", "p-a"]);
      });

      expect(toastErrorMock).toHaveBeenCalledWith(
        "Failed to reorder columns",
        { duration: 8000 },
      );
      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "database-properties:reorder");
      // Revert: second setProperties call restores original
      expect(setProperties).toHaveBeenCalledTimes(2);
      const revertValue = setProperties.mock.calls[1][0];
      expect(revertValue).toEqual(props);
    });
  });

  // -------------------------------------------------------------------------
  // handleRequestDeleteColumn / handleConfirmDeleteColumn
  // -------------------------------------------------------------------------

  describe("handleConfirmDeleteColumn", () => {
    it("deletes property, cleans up views and row values", async () => {
      deletePropertyMock.mockResolvedValue({ error: null });

      const props = [
        makeProp("title-prop", "Title", 0),
        makeProp("prop-del", "To Delete", 1, "text"),
      ];
      const views = [
        makeView("view-1", { visible_properties: ["title-prop", "prop-del"] }),
      ];
      const rows = [
        makeRow("row-1", {
          "prop-del": {
            id: "rv-1",
            row_id: "row-1",
            property_id: "prop-del",
            value: { text: "hello" },
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
        }),
      ];

      const { result, setProperties, setViews, setRows } = setup({
        properties: props,
        views,
        rows,
      });

      // Request delete
      act(() => {
        result.current.handleRequestDeleteColumn("prop-del");
      });
      expect(result.current.deletingProperty).toEqual({
        id: "prop-del",
        name: "To Delete",
      });

      // Confirm delete
      await act(async () => {
        await result.current.handleConfirmDeleteColumn();
      });

      expect(deletePropertyMock).toHaveBeenCalledWith("prop-del", "db-1");

      // Properties updated
      const propUpdater = setProperties.mock.calls[0][0];
      const updatedProps = propUpdater(props);
      expect(updatedProps).toHaveLength(1);
      expect(updatedProps[0].id).toBe("title-prop");

      // Views cleaned up
      const viewUpdater = setViews.mock.calls[0][0];
      const updatedViews = viewUpdater(views);
      expect(updatedViews[0].config.visible_properties).toEqual([
        "title-prop",
      ]);

      // Row values cleaned up
      const rowUpdater = setRows.mock.calls[0][0];
      const updatedRows = rowUpdater(rows);
      expect(updatedRows[0].values).toEqual({});
    });

    it("prevents deleting the title property (position 0)", () => {
      const props = [makeProp("title-prop", "Title", 0)];
      const { result } = setup({ properties: props });

      act(() => {
        result.current.handleRequestDeleteColumn("title-prop");
      });

      expect(result.current.deletingProperty).toBeNull();
    });

    it("reverts on delete failure and captures Sentry error", async () => {
      const error = new Error("delete failed");
      deletePropertyMock.mockResolvedValue({
        error,
      });
      loadDatabaseMock.mockResolvedValue({
        data: { rows: [makeRow("row-1")] },
        error: null,
      });

      const props = [
        makeProp("title-prop", "Title", 0),
        makeProp("prop-del", "Col", 1),
      ];
      const views = [makeView("view-1")];
      const { result, setProperties, setViews } = setup({
        properties: props,
        views,
      });

      act(() => {
        result.current.handleRequestDeleteColumn("prop-del");
      });

      await act(async () => {
        await result.current.handleConfirmDeleteColumn();
      });

      expect(toastErrorMock).toHaveBeenCalledWith(
        "Failed to delete property",
        { duration: 8000 },
      );
      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(error, "database-properties:delete");
      // Properties and views reverted
      const revertProps = setProperties.mock.calls[1][0];
      expect(revertProps).toEqual(props);
      const revertViews = setViews.mock.calls[1][0];
      expect(revertViews).toEqual(views);
    });

    it("does nothing when no property is being deleted", async () => {
      const { result } = setup();

      await act(async () => {
        await result.current.handleConfirmDeleteColumn();
      });

      expect(deletePropertyMock).not.toHaveBeenCalled();
    });

    it("handleCancelDeleteColumn clears deletingProperty", () => {
      const props = [
        makeProp("title-prop", "Title", 0),
        makeProp("prop-1", "Col", 1),
      ];
      const { result } = setup({ properties: props });

      act(() => {
        result.current.handleRequestDeleteColumn("prop-1");
      });
      expect(result.current.deletingProperty).not.toBeNull();

      act(() => {
        result.current.handleCancelDeleteColumn();
      });
      expect(result.current.deletingProperty).toBeNull();
    });
  });
});
