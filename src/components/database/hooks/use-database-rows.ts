import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  addRow,
  duplicateRow,
  loadDatabase,
  updateProperty,
  updateRowValue,
} from "@/lib/database";
import { createClient } from "@/lib/supabase/client";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
} from "@/lib/sentry";
import type { DatabaseProperty, DatabaseRow } from "@/lib/types";

// ---------------------------------------------------------------------------
// Hook params & return type
// ---------------------------------------------------------------------------

export interface UseDatabaseRowsParams {
  pageId: string;
  userId: string;
  rows: DatabaseRow[];
  properties: DatabaseProperty[];
  setRows: React.Dispatch<React.SetStateAction<DatabaseRow[]>>;
  setProperties: React.Dispatch<React.SetStateAction<DatabaseProperty[]>>;
}

export interface UseDatabaseRowsReturn {
  handleAddRow: (initialValues?: Record<string, Record<string, unknown>>) => Promise<void>;
  handleDuplicateRow: (rowId: string) => Promise<void>;
  handleCardMove: (rowId: string, propertyId: string, newOptionId: string | null) => Promise<void>;
  handleCellUpdate: (rowId: string, propertyId: string, value: Record<string, unknown>) => Promise<void>;
  handleDeleteRow: (rowId: string) => void;
  handleBulkDeleteRows: (rowIds: string[]) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDatabaseRows({
  pageId,
  userId,
  rows,
  properties,
  setRows,
  setProperties,
}: UseDatabaseRowsParams): UseDatabaseRowsReturn {
  // Ref holds the latest handlers so retry closures always call the current version
  const handlersRef = useRef<UseDatabaseRowsReturn>(null);

  const handleAddRow = useCallback(
    async (initialValues?: Record<string, Record<string, unknown>>) => {
      // Generate a temporary ID for the optimistic row
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const now = new Date().toISOString();

      // Build optimistic row_values from initialValues
      const optimisticValues: DatabaseRow["values"] = {};
      if (initialValues) {
        for (const [propertyId, value] of Object.entries(initialValues)) {
          optimisticValues[propertyId] = {
            id: "",
            row_id: tempId,
            property_id: propertyId,
            value,
            created_at: now,
            updated_at: now,
          };
        }
      }

      // Insert placeholder row immediately
      const optimisticRow: DatabaseRow = {
        page: {
          id: tempId,
          title: "",
          icon: null,
          cover_url: null,
          created_at: now,
          updated_at: now,
          created_by: userId,
        },
        values: optimisticValues,
      };
      setRows((prev) => [...prev, optimisticRow]);

      const { data: rowPage, error } = await addRow(
        pageId,
        userId,
        initialValues,
      );
      if (error || !rowPage) {
        // Rollback: remove the optimistic row
        setRows((prev) => prev.filter((r) => r.page.id !== tempId));
        if (error && !isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "database-rows:add");
        }
        toast.error("Failed to add row", {
          duration: 8000,
          action: {
            label: "Retry",
            onClick: () => void handlersRef.current?.handleAddRow(initialValues),
          },
        });
        return;
      }

      // Replace the placeholder with the real row from the server
      const realValues: DatabaseRow["values"] = {};
      if (initialValues) {
        for (const [propertyId, value] of Object.entries(initialValues)) {
          realValues[propertyId] = {
            id: "",
            row_id: rowPage.id,
            property_id: propertyId,
            value,
            created_at: now,
            updated_at: now,
          };
        }
      }
      setRows((prev) =>
        prev.map((r) =>
          r.page.id === tempId
            ? { page: rowPage as DatabaseRow["page"], values: realValues }
            : r,
        ),
      );
    },
    [pageId, userId, setRows],
  );

  const handleDuplicateRow = useCallback(
    async (rowId: string) => {
      const sourceRow = rows.find((r) => r.page.id === rowId);
      if (!sourceRow) return;

      // Optimistic: insert a placeholder row right after the source
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const now = new Date().toISOString();
      const optimisticRow: DatabaseRow = {
        page: {
          id: tempId,
          title: sourceRow.page.title
            ? `${sourceRow.page.title} (copy)`
            : "(copy)",
          icon: sourceRow.page.icon,
          cover_url: null,
          created_at: now,
          updated_at: now,
          created_by: userId,
        },
        values: { ...sourceRow.values },
      };

      setRows((prev) => {
        const idx = prev.findIndex((r) => r.page.id === rowId);
        const next = [...prev];
        next.splice(idx + 1, 0, optimisticRow);
        return next;
      });

      const { data: newPage, error } = await duplicateRow(
        pageId,
        userId,
        sourceRow,
        properties,
      );

      if (error || !newPage) {
        // Rollback
        setRows((prev) => prev.filter((r) => r.page.id !== tempId));
        if (error && !isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "database-rows:duplicate");
        }
        toast.error("Failed to duplicate row", {
          duration: 8000,
          action: {
            label: "Retry",
            onClick: () => void handlersRef.current?.handleDuplicateRow(rowId),
          },
        });
        return;
      }

      // Replace placeholder with real row
      const realValues: DatabaseRow["values"] = {};
      for (const [propertyId, rv] of Object.entries(sourceRow.values)) {
        realValues[propertyId] = {
          ...rv,
          row_id: newPage.id,
        };
      }
      setRows((prev) =>
        prev.map((r) =>
          r.page.id === tempId
            ? { page: newPage as DatabaseRow["page"], values: realValues }
            : r,
        ),
      );

      toast.success("Row duplicated");
    },
    [pageId, userId, rows, properties, setRows],
  );

  const handleCardMove = useCallback(
    async (
      rowId: string,
      propertyId: string,
      newOptionId: string | null,
    ) => {
      const newValue: Record<string, unknown> = {
        option_id: newOptionId,
      };
      // Optimistic update
      setRows((prev) =>
        prev.map((r) => {
          if (r.page.id !== rowId) return r;
          return {
            ...r,
            values: {
              ...r.values,
              [propertyId]: {
                ...(r.values[propertyId] ?? {
                  id: "",
                  row_id: rowId,
                  property_id: propertyId,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }),
                value: newValue,
                updated_at: new Date().toISOString(),
              },
            },
          };
        }),
      );

      const { error } = await updateRowValue(rowId, propertyId, newValue, pageId);
      if (error) {
        if (!isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "database-view:move-card");
        }
        toast.error("Failed to move card", {
          duration: 8000,
          action: {
            label: "Retry",
            onClick: () => void handlersRef.current?.handleCardMove(rowId, propertyId, newOptionId),
          },
        });
      }
    },
    [pageId, setRows],
  );

  const handleCellUpdate = useCallback(
    async (rowId: string, propertyId: string, value: Record<string, unknown>) => {
      // Extract _newOptions before persisting — select/multi-select editors
      // pass newly created options here so we can save them to the property config.
      const newOptions = value._newOptions as
        | Array<{ id: string; name: string; color: string }>
        | undefined;
      const { _newOptions: _, ...cleanValue } = value;

      // Snapshot previous state for rollback on save failure
      let prevRows: DatabaseRow[] | null = null;
      let prevProperties: DatabaseProperty[] | null = null;

      // Optimistic updates — batch property config and row value together
      // so React renders both in the same cycle (the renderer needs the
      // updated options to display the newly created option badge).
      if (newOptions) {
        setProperties((prev) => {
          prevProperties = prev;
          return prev.map((p) =>
            p.id === propertyId
              ? { ...p, config: { ...p.config, options: newOptions } }
              : p,
          );
        });
      }

      setRows((prev) => {
        prevRows = prev;
        return prev.map((r) => {
          if (r.page.id !== rowId) return r;
          return {
            ...r,
            values: {
              ...r.values,
              [propertyId]: {
                ...(r.values[propertyId] ?? {
                  id: "",
                  row_id: rowId,
                  property_id: propertyId,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }),
                value: cleanValue,
                updated_at: new Date().toISOString(),
              },
            },
          };
        });
      });

      // Persist to DB: update property config first, then row value
      let shouldRollback = false;

      // Retry uses the original value (with _newOptions) so the full operation reruns
      const retryAction = {
        label: "Retry",
        onClick: () => void handlersRef.current?.handleCellUpdate(rowId, propertyId, value),
      };

      if (newOptions) {
        const { error: configError } = await updateProperty(propertyId, {
          config: { options: newOptions },
        }, pageId);
        if (configError) {
          if (!isInsufficientPrivilegeError(configError)) {
            captureSupabaseError(configError, "database-view:update-property-options");
          }
          toast.error("Failed to save new option", {
            duration: 8000,
            action: retryAction,
          });
          shouldRollback = true;
        }
      }

      const { error } = await updateRowValue(rowId, propertyId, cleanValue, pageId);
      if (error) {
        if (!isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "database-view:update-cell");
        }
        toast.error("Failed to update cell", {
          duration: 8000,
          action: retryAction,
        });
        shouldRollback = true;
      }

      // Revert optimistic updates so the cell shows the previous value
      if (shouldRollback) {
        if (prevRows) setRows(prevRows);
        if (prevProperties) setProperties(prevProperties);
      }
    },
    [pageId, setRows, setProperties],
  );

  // Track pending row deletion timers so undo can cancel them
  const pendingRowDeletions = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleDeleteRow = useCallback(
    (rowId: string) => {
      // Snapshot the row for undo
      let snapshot: DatabaseRow | undefined;
      setRows((prev) => {
        snapshot = prev.find((r) => r.page.id === rowId);
        return prev.filter((r) => r.page.id !== rowId);
      });

      // Cancel any existing pending deletion for this row (e.g. rapid re-delete)
      const existing = pendingRowDeletions.current.get(rowId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        pendingRowDeletions.current.delete(rowId);
        const supabase = createClient();
        const { error } = await supabase.rpc("soft_delete_page", {
          page_id: rowId,
        });
        if (error) {
          if (!isInsufficientPrivilegeError(error)) {
            captureSupabaseError(error, "database-view:delete-row");
          }
          toast.error("Failed to delete row", {
            duration: 8000,
            action: {
              label: "Retry",
              onClick: () => handlersRef.current?.handleDeleteRow(rowId),
            },
          });
          // Reload to restore
          const { data } = await loadDatabase(pageId);
          if (data) setRows(data.rows);
        }
      }, 5500);

      pendingRowDeletions.current.set(rowId, timer);

      toast("Row deleted", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            clearTimeout(timer);
            pendingRowDeletions.current.delete(rowId);
            const restored = snapshot;
            if (restored) {
              setRows((prev) => [...prev, restored]);
            }
          },
        },
      });
    },
    [pageId, setRows],
  );

  const handleBulkDeleteRows = useCallback(
    (rowIds: string[]) => {
      if (rowIds.length === 0) return;

      // Snapshot all rows being deleted for undo
      let snapshots: DatabaseRow[] = [];
      setRows((prev) => {
        const deleteSet = new Set(rowIds);
        snapshots = prev.filter((r) => deleteSet.has(r.page.id));
        return prev.filter((r) => !deleteSet.has(r.page.id));
      });

      // Cancel any existing pending single-row deletions for these rows
      for (const rowId of rowIds) {
        const existing = pendingRowDeletions.current.get(rowId);
        if (existing) {
          clearTimeout(existing);
          pendingRowDeletions.current.delete(rowId);
        }
      }

      const timer = setTimeout(async () => {
        const supabase = createClient();
        const errors: string[] = [];
        for (const rowId of rowIds) {
          pendingRowDeletions.current.delete(rowId);
          const { error } = await supabase.rpc("soft_delete_page", {
            page_id: rowId,
          });
          if (error) {
            if (!isInsufficientPrivilegeError(error)) {
              captureSupabaseError(error, "database-view:bulk-delete-row");
            }
            errors.push(rowId);
          }
        }
        if (errors.length > 0) {
          toast.error(`Failed to delete ${errors.length} row${errors.length !== 1 ? "s" : ""}`, {
            duration: 8000,
            action: {
              label: "Retry",
              onClick: () => handlersRef.current?.handleBulkDeleteRows(errors),
            },
          });
          // Reload to restore failed rows
          const { data } = await loadDatabase(pageId);
          if (data) setRows(data.rows);
        }
      }, 5500);

      // Track all rows under a single timer keyed to the first row ID
      const timerKey = `bulk-${Date.now()}`;
      pendingRowDeletions.current.set(timerKey, timer);

      const count = rowIds.length;
      toast(`${count} row${count !== 1 ? "s" : ""} deleted`, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            clearTimeout(timer);
            pendingRowDeletions.current.delete(timerKey);
            if (snapshots.length > 0) {
              setRows((prev) => [...prev, ...snapshots]);
            }
          },
        },
      });
    },
    [pageId, setRows],
  );

  const handlers: UseDatabaseRowsReturn = {
    handleAddRow,
    handleDuplicateRow,
    handleCardMove,
    handleCellUpdate,
    handleDeleteRow,
    handleBulkDeleteRows,
  };
  useEffect(() => { handlersRef.current = handlers; });

  return handlers;
}
