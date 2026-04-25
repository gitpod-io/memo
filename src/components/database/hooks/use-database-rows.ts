import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  addRow,
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
  setRows: React.Dispatch<React.SetStateAction<DatabaseRow[]>>;
  setProperties: React.Dispatch<React.SetStateAction<DatabaseProperty[]>>;
}

export interface UseDatabaseRowsReturn {
  handleAddRow: (initialValues?: Record<string, Record<string, unknown>>) => Promise<void>;
  handleCardMove: (rowId: string, propertyId: string, newOptionId: string | null) => Promise<void>;
  handleCellUpdate: (rowId: string, propertyId: string, value: Record<string, unknown>) => Promise<void>;
  handleDeleteRow: (rowId: string) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDatabaseRows({
  pageId,
  userId,
  setRows,
  setProperties,
}: UseDatabaseRowsParams): UseDatabaseRowsReturn {
  // Ref holds the latest handlers so retry closures always call the current version
  const handlersRef = useRef<UseDatabaseRowsReturn>(null);

  const handleAddRow = useCallback(
    async (initialValues?: Record<string, Record<string, unknown>>) => {
      const { data: rowPage, error } = await addRow(
        pageId,
        userId,
        initialValues,
      );
      if (error || !rowPage) {
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
      // Build optimistic row_values from initialValues
      const optimisticValues: DatabaseRow["values"] = {};
      if (initialValues) {
        for (const [propertyId, value] of Object.entries(initialValues)) {
          optimisticValues[propertyId] = {
            id: "",
            row_id: rowPage.id,
            property_id: propertyId,
            value,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
      }
      setRows((prev) => [
        ...prev,
        { page: rowPage as DatabaseRow["page"], values: optimisticValues },
      ]);
    },
    [pageId, userId, setRows],
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

  const handlers: UseDatabaseRowsReturn = {
    handleAddRow,
    handleCardMove,
    handleCellUpdate,
    handleDeleteRow,
  };
  useEffect(() => { handlersRef.current = handlers; });

  return handlers;
}
