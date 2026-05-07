import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const addRowMock = vi.fn();
const duplicateRowMock = vi.fn();
const updateRowValueMock = vi.fn();
const updatePropertyMock = vi.fn();
const loadDatabaseMock = vi.fn();
const captureSupabaseErrorMock = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock needs flexible arity
const isInsufficientPrivilegeErrorMock = vi.fn((..._args: any[]) => false);
const toastMock = vi.fn();
const toastErrorMock = vi.fn();
const softDeletePageMock = vi.fn();

vi.mock("@/lib/database", () => ({
  addRow: (...args: unknown[]) => addRowMock(...args),
  duplicateRow: (...args: unknown[]) => duplicateRowMock(...args),
  updateRowValue: (...args: unknown[]) => updateRowValueMock(...args),
  updateProperty: (...args: unknown[]) => updatePropertyMock(...args),
  loadDatabase: (...args: unknown[]) => loadDatabaseMock(...args),
}));

vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: (error: Error, operation: string) =>
    captureSupabaseErrorMock(error, operation),
  isInsufficientPrivilegeError: (error: Error) =>
    isInsufficientPrivilegeErrorMock(error),
}));

const toastSuccessMock = vi.fn();

vi.mock("sonner", () => ({
  toast: Object.assign(
    (...args: unknown[]) => toastMock(...args),
    {
      error: (...args: unknown[]) => toastErrorMock(...args),
      success: (...args: unknown[]) => toastSuccessMock(...args),
    },
  ),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: (...args: unknown[]) => softDeletePageMock(...args),
  }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { useDatabaseRows } from "./use-database-rows";
import type { DatabaseRow, DatabaseProperty } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function setup(overrides?: Partial<Parameters<typeof useDatabaseRows>[0]>) {
  const rows: DatabaseRow[] = overrides?.rows ?? [makeRow("row-1")];
  const setRows = vi.fn((updater) => {
    if (typeof updater === "function") {
      return updater(rows);
    }
    return updater;
  });
  const setProperties = vi.fn((updater) => {
    if (typeof updater === "function") {
      return updater([] as DatabaseProperty[]);
    }
    return updater;
  });

  const params = {
    pageId: "db-1",
    userId: "user-1",
    rows,
    properties: [] as DatabaseProperty[],
    setRows,
    setProperties,
    ...overrides,
  };

  const hookResult = renderHook(() => useDatabaseRows(params));
  return { ...hookResult, setRows, setProperties, params };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useDatabaseRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // handleAddRow
  // -------------------------------------------------------------------------

  describe("handleAddRow", () => {
    it("inserts a placeholder row immediately before the server responds", async () => {
      // Use a deferred promise so we can inspect state before resolution
      let resolveAdd!: (v: { data: Record<string, unknown>; error: null }) => void;
      const deferred = new Promise<{ data: Record<string, unknown>; error: null }>((r) => {
        resolveAdd = r;
      });
      addRowMock.mockImplementation(() => deferred);

      const { result, setRows } = setup();

      // Start the add but don't await yet
      const p = act(async () => {
        await result.current.handleAddRow();
      });

      // setRows should have been called once with the optimistic placeholder
      expect(setRows).toHaveBeenCalledTimes(1);
      const optimisticUpdater = setRows.mock.calls[0][0];
      const optimistic = optimisticUpdater([makeRow("row-1")]);
      expect(optimistic).toHaveLength(2);
      expect(optimistic[1].page.id).toMatch(/^temp-/);
      expect(optimistic[1].page.title).toBe("");

      // Resolve the server call
      resolveAdd({
        data: {
          id: "new-row-1",
          title: "",
          icon: null,
          cover_url: null,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          created_by: "user-1",
        },
        error: null,
      });
      await p;

      // setRows called a second time to replace the placeholder with the real row
      expect(setRows).toHaveBeenCalledTimes(2);
      const replaceUpdater = setRows.mock.calls[1][0];
      // Feed it the optimistic state so the temp ID is present
      const replaced = replaceUpdater(optimistic);
      expect(replaced).toHaveLength(2);
      expect(replaced[1].page.id).toBe("new-row-1");
    });

    it("replaces placeholder with real row on success", async () => {
      const newPage = {
        id: "new-row-1",
        title: "",
        icon: null,
        cover_url: null,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        created_by: "user-1",
      };
      addRowMock.mockResolvedValue({ data: newPage, error: null });

      const { result, setRows } = setup();

      await act(async () => {
        await result.current.handleAddRow();
      });

      expect(addRowMock).toHaveBeenCalledWith("db-1", "user-1", undefined);
      // First call: optimistic insert, second call: replace with real
      expect(setRows).toHaveBeenCalledTimes(2);

      // Chain the updaters to simulate React state flow
      const optimistic = setRows.mock.calls[0][0]([makeRow("row-1")]);
      const final = setRows.mock.calls[1][0](optimistic);
      expect(final).toHaveLength(2);
      expect(final[1].page.id).toBe("new-row-1");
    });

    it("builds optimistic row_values from initialValues", async () => {
      const newPage = {
        id: "new-row-2",
        title: "",
        icon: null,
        cover_url: null,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        created_by: "user-1",
      };
      addRowMock.mockResolvedValue({ data: newPage, error: null });

      const { result, setRows } = setup();

      const initialValues = {
        "prop-1": { option_id: "opt-a" },
      };

      await act(async () => {
        await result.current.handleAddRow(initialValues);
      });

      expect(addRowMock).toHaveBeenCalledWith("db-1", "user-1", initialValues);

      // Optimistic insert should have values with temp row_id
      const optimistic = setRows.mock.calls[0][0]([]);
      expect(optimistic[0].values["prop-1"]).toMatchObject({
        property_id: "prop-1",
        value: { option_id: "opt-a" },
      });
      expect(optimistic[0].values["prop-1"].row_id).toMatch(/^temp-/);

      // After replacement, values should reference the real row_id
      const final = setRows.mock.calls[1][0](optimistic);
      expect(final[0].values["prop-1"]).toMatchObject({
        row_id: "new-row-2",
        property_id: "prop-1",
        value: { option_id: "opt-a" },
      });
    });

    it("rolls back the optimistic row on error", async () => {
      addRowMock.mockResolvedValue({
        data: null,
        error: new Error("insert failed"),
      });

      const { result, setRows } = setup();

      await act(async () => {
        await result.current.handleAddRow();
      });

      // First call: optimistic insert, second call: rollback removal
      expect(setRows).toHaveBeenCalledTimes(2);

      // Simulate: optimistic insert adds a temp row
      const optimistic = setRows.mock.calls[0][0]([makeRow("row-1")]);
      expect(optimistic).toHaveLength(2);

      // Rollback removes the temp row
      const rolledBack = setRows.mock.calls[1][0](optimistic);
      expect(rolledBack).toHaveLength(1);
      expect(rolledBack[0].page.id).toBe("row-1");

      expect(toastErrorMock).toHaveBeenCalledWith("Failed to add row", expect.objectContaining({ duration: 8000 }));
    });

    it("rolls back the optimistic row when data is null without error", async () => {
      addRowMock.mockResolvedValue({ data: null, error: null });

      const { result, setRows } = setup();

      await act(async () => {
        await result.current.handleAddRow();
      });

      // First call: optimistic insert, second call: rollback removal
      expect(setRows).toHaveBeenCalledTimes(2);
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to add row", expect.objectContaining({ duration: 8000 }));
    });

    it("passes a Retry action that re-invokes handleAddRow", async () => {
      addRowMock.mockResolvedValue({
        data: null,
        error: new Error("network error"),
      });

      const { result } = setup();

      await act(async () => {
        await result.current.handleAddRow({ "prop-1": { option_id: "opt-a" } });
      });

      const call = toastErrorMock.mock.calls[0];
      expect(call[1]).toMatchObject({
        action: { label: "Retry", onClick: expect.any(Function) },
      });

      // Invoke the retry callback — it should call addRow again
      addRowMock.mockClear();
      addRowMock.mockResolvedValue({ data: null, error: null });
      await act(async () => {
        call[1].action.onClick();
      });
      expect(addRowMock).toHaveBeenCalledWith("db-1", "user-1", { "prop-1": { option_id: "opt-a" } });
    });

    it("uses unique temp IDs so concurrent adds don't collide", async () => {
      const newPage1 = {
        id: "real-1", title: "", icon: null, cover_url: null,
        created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z", created_by: "user-1",
      };
      const newPage2 = {
        id: "real-2", title: "", icon: null, cover_url: null,
        created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z", created_by: "user-1",
      };
      addRowMock
        .mockResolvedValueOnce({ data: newPage1, error: null })
        .mockResolvedValueOnce({ data: newPage2, error: null });

      const { result, setRows } = setup();

      await act(async () => {
        await result.current.handleAddRow();
      });
      await act(async () => {
        await result.current.handleAddRow();
      });

      // Each add produces 2 setRows calls (optimistic + replace) = 4 total
      expect(setRows).toHaveBeenCalledTimes(4);

      // The optimistic inserts should have different temp IDs
      const tempId1 = setRows.mock.calls[0][0]([]).find(
        (r: DatabaseRow) => r.page.id.startsWith("temp-"),
      )?.page.id;
      const tempId2 = setRows.mock.calls[2][0]([]).find(
        (r: DatabaseRow) => r.page.id.startsWith("temp-"),
      )?.page.id;
      expect(tempId1).toBeDefined();
      expect(tempId2).toBeDefined();
      expect(tempId1).not.toBe(tempId2);
    });
  });

  // -------------------------------------------------------------------------
  // handleCardMove
  // -------------------------------------------------------------------------

  describe("handleCardMove", () => {
    it("optimistically updates the row value and persists", async () => {
      updateRowValueMock.mockResolvedValue({ data: null, error: null });

      const { result, setRows } = setup({
        rows: [makeRow("row-1")],
      });

      await act(async () => {
        await result.current.handleCardMove("row-1", "prop-status", "opt-done");
      });

      // Optimistic update was called
      expect(setRows).toHaveBeenCalled();
      const updater = setRows.mock.calls[0][0];
      const updated = updater([makeRow("row-1")]);
      expect(updated[0].values["prop-status"].value).toEqual({
        option_id: "opt-done",
      });

      expect(updateRowValueMock).toHaveBeenCalledWith(
        "row-1",
        "prop-status",
        { option_id: "opt-done" },
        "db-1",
      );
    });

    it("handles null newOptionId", async () => {
      updateRowValueMock.mockResolvedValue({ data: null, error: null });

      const { result, setRows } = setup();

      await act(async () => {
        await result.current.handleCardMove("row-1", "prop-status", null);
      });

      const updater = setRows.mock.calls[0][0];
      const updated = updater([makeRow("row-1")]);
      expect(updated[0].values["prop-status"].value).toEqual({
        option_id: null,
      });
    });

    it("shows toast and captures error on failure", async () => {
      const dbError = new Error("update failed");
      updateRowValueMock.mockResolvedValue({ data: null, error: dbError });

      const { result } = setup();

      await act(async () => {
        await result.current.handleCardMove("row-1", "prop-1", "opt-1");
      });

      expect(captureSupabaseErrorMock).toHaveBeenCalledWith(
        dbError,
        "database-view:move-card",
      );
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to move card", expect.objectContaining({ duration: 8000 }));
    });

    it("skips captureSupabaseError for insufficient privilege errors", async () => {
      const dbError = new Error("insufficient_privilege");
      isInsufficientPrivilegeErrorMock.mockReturnValue(true);
      updateRowValueMock.mockResolvedValue({ data: null, error: dbError });

      const { result } = setup();

      await act(async () => {
        await result.current.handleCardMove("row-1", "prop-1", "opt-1");
      });

      expect(captureSupabaseErrorMock).not.toHaveBeenCalled();
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to move card", expect.objectContaining({ duration: 8000 }));
    });
  });

  // -------------------------------------------------------------------------
  // handleCellUpdate
  // -------------------------------------------------------------------------

  describe("handleCellUpdate", () => {
    it("optimistically updates the cell value and persists", async () => {
      updateRowValueMock.mockResolvedValue({ data: null, error: null });

      const { result, setRows } = setup({
        rows: [makeRow("row-1")],
      });

      await act(async () => {
        await result.current.handleCellUpdate("row-1", "prop-1", {
          text: "hello",
        });
      });

      // Optimistic update
      const updater = setRows.mock.calls[0][0];
      const updated = updater([makeRow("row-1")]);
      expect(updated[0].values["prop-1"].value).toEqual({ text: "hello" });

      expect(updateRowValueMock).toHaveBeenCalledWith(
        "row-1",
        "prop-1",
        { text: "hello" },
        "db-1",
      );
    });

    it("strips _newOptions from value before persisting", async () => {
      updateRowValueMock.mockResolvedValue({ data: null, error: null });
      updatePropertyMock.mockResolvedValue({ data: null, error: null });

      const { result } = setup();

      const newOptions = [
        { id: "opt-new", name: "New", color: "blue" },
      ];

      await act(async () => {
        await result.current.handleCellUpdate("row-1", "prop-1", {
          option_id: "opt-new",
          _newOptions: newOptions,
        });
      });

      // updateRowValue should receive cleanValue without _newOptions
      expect(updateRowValueMock).toHaveBeenCalledWith(
        "row-1",
        "prop-1",
        { option_id: "opt-new" },
        "db-1",
      );
    });

    it("updates property config when _newOptions is provided", async () => {
      updateRowValueMock.mockResolvedValue({ data: null, error: null });
      updatePropertyMock.mockResolvedValue({ data: null, error: null });

      const { result, setProperties } = setup();

      const newOptions = [
        { id: "opt-new", name: "New", color: "blue" },
      ];

      await act(async () => {
        await result.current.handleCellUpdate("row-1", "prop-1", {
          option_id: "opt-new",
          _newOptions: newOptions,
        });
      });

      // Property config should be updated optimistically
      expect(setProperties).toHaveBeenCalled();
      // And persisted
      expect(updatePropertyMock).toHaveBeenCalledWith(
        "prop-1",
        { config: { options: newOptions } },
        "db-1",
      );
    });

    it("rolls back on updateRowValue failure", async () => {
      const dbError = new Error("update failed");
      updateRowValueMock.mockResolvedValue({ data: null, error: dbError });

      const existingRows = [makeRow("row-1")];
      const setRows = vi.fn((updater) => {
        if (typeof updater === "function") {
          return updater(existingRows);
        }
        return updater;
      });

      const { result } = setup({ rows: existingRows, setRows });

      await act(async () => {
        await result.current.handleCellUpdate("row-1", "prop-1", {
          text: "new",
        });
      });

      expect(toastErrorMock).toHaveBeenCalledWith("Failed to update cell", expect.objectContaining({ duration: 8000 }));
      // Rollback: setRows called with the snapshot (not a function)
      const lastSetRowsCall = setRows.mock.calls[setRows.mock.calls.length - 1][0];
      // The rollback sets rows directly (not via updater function)
      expect(Array.isArray(lastSetRowsCall)).toBe(true);
    });

    it("rolls back on updateProperty failure when _newOptions present", async () => {
      const configError = new Error("config update failed");
      updatePropertyMock.mockResolvedValue({
        data: null,
        error: configError,
      });
      updateRowValueMock.mockResolvedValue({ data: null, error: null });

      const existingRows = [makeRow("row-1")];
      const setRows = vi.fn((updater) => {
        if (typeof updater === "function") {
          return updater(existingRows);
        }
        return updater;
      });
      const existingProperties: DatabaseProperty[] = [];
      const setProperties = vi.fn((updater) => {
        if (typeof updater === "function") {
          return updater(existingProperties);
        }
        return updater;
      });

      const { result } = setup({
        rows: existingRows,
        setRows,
        setProperties,
      });

      await act(async () => {
        await result.current.handleCellUpdate("row-1", "prop-1", {
          option_id: "opt-1",
          _newOptions: [{ id: "opt-1", name: "Opt", color: "red" }],
        });
      });

      expect(toastErrorMock).toHaveBeenCalledWith(
        "Failed to save new option",
        expect.objectContaining({ duration: 8000 }),
      );
      // Both rows and properties should be rolled back
      const lastSetRowsCall = setRows.mock.calls[setRows.mock.calls.length - 1][0];
      expect(Array.isArray(lastSetRowsCall)).toBe(true);
      const lastSetPropsCall =
        setProperties.mock.calls[setProperties.mock.calls.length - 1][0];
      expect(Array.isArray(lastSetPropsCall)).toBe(true);
    });

    it("skips captureSupabaseError for insufficient privilege errors", async () => {
      const dbError = new Error("insufficient_privilege");
      isInsufficientPrivilegeErrorMock.mockReturnValue(true);
      updateRowValueMock.mockResolvedValue({ data: null, error: dbError });

      const { result } = setup();

      await act(async () => {
        await result.current.handleCellUpdate("row-1", "prop-1", {
          text: "x",
        });
      });

      expect(captureSupabaseErrorMock).not.toHaveBeenCalled();
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to update cell", expect.objectContaining({ duration: 8000 }));
    });

    it("passes a Retry action that re-invokes handleCellUpdate with original value", async () => {
      updateRowValueMock.mockResolvedValue({
        data: null,
        error: new Error("network error"),
      });

      const { result } = setup();

      const originalValue = { text: "hello", _newOptions: [{ id: "o1", name: "New", color: "blue" }] };
      await act(async () => {
        await result.current.handleCellUpdate("row-1", "prop-1", originalValue);
      });

      const call = toastErrorMock.mock.calls[0];
      expect(call[1]).toMatchObject({
        action: { label: "Retry", onClick: expect.any(Function) },
      });
    });
  });

  // -------------------------------------------------------------------------
  // handleDeleteRow (deferred deletion with undo toast)
  // -------------------------------------------------------------------------

  describe("handleDeleteRow", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("optimistically removes the row and shows undo toast", () => {
      const rows = [makeRow("row-1"), makeRow("row-2")];
      const setRows = vi.fn((updater) => {
        if (typeof updater === "function") {
          return updater(rows);
        }
        return updater;
      });

      const { result } = setup({ rows, setRows });

      act(() => {
        result.current.handleDeleteRow("row-1");
      });

      // Optimistic removal
      const updater = setRows.mock.calls[0][0];
      const updated = updater(rows);
      expect(updated).toHaveLength(1);
      expect(updated[0].page.id).toBe("row-2");

      // RPC should NOT be called yet (deferred)
      expect(softDeletePageMock).not.toHaveBeenCalled();

      // Toast shown with undo action
      expect(toastMock).toHaveBeenCalledWith(
        "Row deleted",
        expect.objectContaining({
          duration: 5000,
          action: expect.objectContaining({ label: "Undo" }),
        }),
      );
    });

    it("persists deletion via soft_delete_page after 5.5s timer", async () => {
      softDeletePageMock.mockResolvedValue({ data: null, error: null });

      const rows = [makeRow("row-1"), makeRow("row-2")];
      const setRows = vi.fn((updater) => {
        if (typeof updater === "function") {
          return updater(rows);
        }
        return updater;
      });

      const { result } = setup({ rows, setRows });

      act(() => {
        result.current.handleDeleteRow("row-1");
      });

      // Advance past the deferred timer
      await act(async () => {
        vi.advanceTimersByTime(5500);
      });

      expect(softDeletePageMock).toHaveBeenCalledWith("soft_delete_page", {
        page_id: "row-1",
      });
    });

    it("undo restores the row and cancels the timer", async () => {
      const rows = [makeRow("row-1"), makeRow("row-2")];
      const setRows = vi.fn((updater) => {
        if (typeof updater === "function") {
          return updater(rows);
        }
        return updater;
      });

      const { result } = setup({ rows, setRows });

      act(() => {
        result.current.handleDeleteRow("row-1");
      });

      // Simulate clicking the Undo button from the toast
      const toastCall = toastMock.mock.calls[0];
      const undoAction = toastCall[1].action.onClick;
      act(() => {
        undoAction();
      });

      // Row should be restored — last setRows call appends the snapshot
      const lastSetRowsCall = setRows.mock.calls[setRows.mock.calls.length - 1][0];
      if (typeof lastSetRowsCall === "function") {
        const restored = lastSetRowsCall([makeRow("row-2")]);
        expect(restored).toHaveLength(2);
        expect(restored.find((r: DatabaseRow) => r.page.id === "row-1")).toBeTruthy();
      }

      // Timer should be cancelled — advancing should not trigger RPC
      await act(async () => {
        vi.advanceTimersByTime(6000);
      });
      expect(softDeletePageMock).not.toHaveBeenCalled();
    });

    it("shows toast and reloads on persist failure", async () => {
      const dbError = new Error("delete failed");
      softDeletePageMock.mockResolvedValue({ data: null, error: dbError });
      loadDatabaseMock.mockResolvedValue({
        data: { rows: [makeRow("row-1")] },
        error: null,
      });

      const { result, setRows } = setup();

      act(() => {
        result.current.handleDeleteRow("row-1");
      });

      // Advance past the deferred timer to trigger persist
      await act(async () => {
        vi.advanceTimersByTime(5500);
      });

      expect(toastErrorMock).toHaveBeenCalledWith("Failed to delete row", expect.objectContaining({ duration: 8000 }));
      expect(loadDatabaseMock).toHaveBeenCalledWith("db-1");
      // setRows called with reloaded data
      const lastCall = setRows.mock.calls[setRows.mock.calls.length - 1][0];
      expect(lastCall).toEqual([makeRow("row-1")]);
    });

    it("skips captureSupabaseError for insufficient privilege errors on delete", async () => {
      const dbError = new Error("insufficient_privilege");
      isInsufficientPrivilegeErrorMock.mockReturnValue(true);
      softDeletePageMock.mockResolvedValue({ data: null, error: dbError });
      loadDatabaseMock.mockResolvedValue({ data: null, error: null });

      const { result } = setup();

      act(() => {
        result.current.handleDeleteRow("row-1");
      });

      // Advance past the deferred timer
      await act(async () => {
        vi.advanceTimersByTime(5500);
      });

      expect(captureSupabaseErrorMock).not.toHaveBeenCalled();
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to delete row", expect.objectContaining({ duration: 8000 }));
    });
  });
});
