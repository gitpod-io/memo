import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  addProperty,
  deleteProperty,
  loadDatabase,
  reorderProperties,
  updateProperty,
  updateView,
} from "@/lib/database";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
} from "@/lib/sentry";
import {
  generateColumnName,
  getDefaultColumnConfig,
} from "@/lib/column-helpers";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
} from "@/lib/sentry";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseView,
  PropertyType,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Hook params & return type
// ---------------------------------------------------------------------------

export interface UseDatabasePropertiesParams {
  pageId: string;
  properties: DatabaseProperty[];
  setProperties: React.Dispatch<React.SetStateAction<DatabaseProperty[]>>;
  views: DatabaseView[];
  setViews: React.Dispatch<React.SetStateAction<DatabaseView[]>>;
  setRows: React.Dispatch<React.SetStateAction<DatabaseRow[]>>;
}

export interface UseDatabasePropertiesReturn {
  // Rename dialog state
  renameDialogOpen: boolean;
  setRenameDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  renamingProperty: { id: string; name: string } | null;
  // Callbacks
  handleAddColumn: (type: PropertyType) => Promise<void>;
  handleColumnHeaderClick: (propertyId: string) => void;
  handlePropertyRename: (newName: string) => Promise<void>;
  handleColumnReorder: (orderedPropertyIds: string[]) => Promise<void>;
  handleDeleteColumn: (propertyId: string) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDatabaseProperties({
  pageId,
  properties,
  setProperties,
  views,
  setViews,
  setRows,
}: UseDatabasePropertiesParams): UseDatabasePropertiesReturn {
  // Rename property dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingProperty, setRenamingProperty] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Guard against concurrent addProperty calls (e.g. rapid double-click)
  const isAddingColumn = useRef(false);

  // Track pending column deletion timers so undo can cancel them
  const pendingColumnDeletions = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleAddColumn = useCallback(
    async (type: PropertyType) => {
      if (isAddingColumn.current) return;
      isAddingColumn.current = true;
      try {
        const existingNames = new Set(properties.map((p) => p.name));
        const name = generateColumnName(type, existingNames);
        const config = getDefaultColumnConfig(type);
        const { data: newProp, error } = await addProperty(pageId, name, type, config);
        if (error || !newProp) {
          if (error && !isInsufficientPrivilegeError(error)) {
            captureSupabaseError(error, "database-properties:add");
          }
          toast.error("Failed to add column", { duration: 8000 });
          return;
        }
        setProperties((prev) => [...prev, newProp]);
      } finally {
        isAddingColumn.current = false;
      }
    },
    [pageId, properties, setProperties],
  );

  const handleColumnHeaderClick = useCallback(
    (propertyId: string) => {
      const prop = properties.find((p) => p.id === propertyId);
      if (!prop) return;
      setRenamingProperty({ id: prop.id, name: prop.name });
      setRenameDialogOpen(true);
    },
    [properties],
  );

  const handlePropertyRename = useCallback(
    async (newName: string) => {
      if (!renamingProperty) return;
      const { id: propertyId, name: oldName } = renamingProperty;

      // Optimistic update
      setProperties((prev) =>
        prev.map((p) => (p.id === propertyId ? { ...p, name: newName } : p)),
      );

      const { error } = await updateProperty(propertyId, { name: newName }, pageId);
      if (error) {
        if (!isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "database-properties:rename");
        }
        toast.error("Failed to rename property", { duration: 8000 });
        // Revert
        setProperties((prev) =>
          prev.map((p) => (p.id === propertyId ? { ...p, name: oldName } : p)),
        );
      }
    },
    [renamingProperty, pageId, setProperties],
  );

  const handleColumnReorder = useCallback(
    async (orderedPropertyIds: string[]) => {
      // Optimistic update: reorder properties in state
      const prevProperties = properties;
      setProperties((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]));
        return orderedPropertyIds
          .map((id, i) => {
            const p = byId.get(id);
            return p ? { ...p, position: i } : null;
          })
          .filter((p): p is NonNullable<typeof p> => p !== null);
      });

      const { error } = await reorderProperties(pageId, orderedPropertyIds);
      if (error) {
        if (!isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "database-properties:reorder");
        }
        toast.error("Failed to reorder columns", { duration: 8000 });
        setProperties(prevProperties);
      }
    },
    [pageId, properties, setProperties],
  );

  // Deferred column deletion with undo toast — replaces the confirmation dialog
  const handleDeleteColumn = useCallback(
    (propertyId: string) => {
      const prop = properties.find((p) => p.id === propertyId);
      if (!prop || prop.position === 0) return; // Title property cannot be deleted

      // Snapshot state for undo
      const prevProperties = [...properties];
      const prevViews = [...views];
      let prevRows: DatabaseRow[] | null = null;

      // Optimistic removal from properties
      setProperties((prev) => prev.filter((p) => p.id !== propertyId));

      // Optimistic removal from visible_properties in all views
      setViews((prev) =>
        prev.map((v) => {
          const vp = v.config.visible_properties;
          if (!vp || !vp.includes(propertyId)) return v;
          return {
            ...v,
            config: {
              ...v.config,
              visible_properties: vp.filter((id: string) => id !== propertyId),
            },
          };
        }),
      );

      // Optimistic removal from row values (capture snapshot first)
      setRows((prev) => {
        prevRows = prev;
        return prev.map((r) => {
          if (!(propertyId in r.values)) return r;
          const { [propertyId]: _, ...rest } = r.values;
          return { ...r, values: rest };
        });
      });

      // Cancel any existing pending deletion for this column
      const existing = pendingColumnDeletions.current.get(propertyId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        pendingColumnDeletions.current.delete(propertyId);

        const { error } = await deleteProperty(propertyId, pageId);
        if (error) {
          if (!isInsufficientPrivilegeError(error)) {
            captureSupabaseError(error, "database-view:delete-column");
          }
          toast.error("Failed to delete column", { duration: 8000 });
          // Revert all state
          setProperties(prevProperties);
          setViews(prevViews);
          const { data } = await loadDatabase(pageId);
          if (data) setRows(data.rows);
          return;
        }

        // Persist visible_properties cleanup for each affected view
        // Use prevViews (snapshot from deletion time) to avoid stale closure
        // if views change during the 5.5s undo window
        for (const v of prevViews) {
          const vp = v.config.visible_properties;
          if (vp && vp.includes(propertyId)) {
            void updateView(v.id, {
              config: {
                ...v.config,
                visible_properties: vp.filter((id: string) => id !== propertyId),
              },
            }, pageId);
          }
        }
      }, 5500);

      pendingColumnDeletions.current.set(propertyId, timer);

      toast(`Column "${prop.name}" deleted`, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            clearTimeout(timer);
            pendingColumnDeletions.current.delete(propertyId);
            setProperties(prevProperties);
            setViews(prevViews);
            if (prevRows) setRows(prevRows);
          },
        },
      });
    },
    [properties, views, pageId, setProperties, setViews, setRows],
  );


  return {
    renameDialogOpen,
    setRenameDialogOpen,
    renamingProperty,
    handleAddColumn,
    handleColumnHeaderClick,
    handlePropertyRename,
    handleColumnReorder,
    handleDeleteColumn,
  };
}
