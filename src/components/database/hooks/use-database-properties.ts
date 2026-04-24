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
  // Delete dialog state
  deletingProperty: { id: string; name: string } | null;
  // Callbacks
  handleAddColumn: (type: PropertyType) => Promise<void>;
  handleColumnHeaderClick: (propertyId: string) => void;
  handlePropertyRename: (newName: string) => Promise<void>;
  handleColumnReorder: (orderedPropertyIds: string[]) => Promise<void>;
  handleRequestDeleteColumn: (propertyId: string) => void;
  handleConfirmDeleteColumn: () => Promise<void>;
  handleCancelDeleteColumn: () => void;
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

  // Delete property confirmation state
  const [deletingProperty, setDeletingProperty] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Guard against concurrent addProperty calls (e.g. rapid double-click)
  const isAddingColumn = useRef(false);

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

  // Open the delete-property confirmation dialog (called from column header menu)
  const handleRequestDeleteColumn = useCallback(
    (propertyId: string) => {
      const prop = properties.find((p) => p.id === propertyId);
      if (!prop || prop.position === 0) return; // Title property cannot be deleted
      setDeletingProperty({ id: prop.id, name: prop.name });
    },
    [properties],
  );

  // Confirmed deletion — remove property, clean up view configs, and persist
  const handleConfirmDeleteColumn = useCallback(async () => {
    if (!deletingProperty) return;
    const { id: propertyId } = deletingProperty;
    setDeletingProperty(null);

    // Optimistic removal from properties
    const prevProperties = properties;
    setProperties((prev) => prev.filter((p) => p.id !== propertyId));

    // Optimistic removal from visible_properties in all views
    const prevViews = views;
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

    // Optimistic removal from row values
    setRows((prev) =>
      prev.map((r) => {
        if (!(propertyId in r.values)) return r;
        const { [propertyId]: _, ...rest } = r.values;
        return { ...r, values: rest };
      }),
    );

    const { error } = await deleteProperty(propertyId, pageId);
    if (error) {
      if (!isInsufficientPrivilegeError(error)) {
        captureSupabaseError(error, "database-properties:delete");
      }
      toast.error("Failed to delete property", { duration: 8000 });
      // Revert
      setProperties(prevProperties);
      setViews(prevViews);
      const { data } = await loadDatabase(pageId);
      if (data) {
        setRows(data.rows);
      }
      return;
    }

    // Persist visible_properties cleanup for each affected view
    for (const v of views) {
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
  }, [deletingProperty, properties, views, pageId, setProperties, setViews, setRows]);

  const handleCancelDeleteColumn = useCallback(() => {
    setDeletingProperty(null);
  }, []);

  return {
    renameDialogOpen,
    setRenameDialogOpen,
    renamingProperty,
    deletingProperty,
    handleAddColumn,
    handleColumnHeaderClick,
    handlePropertyRename,
    handleColumnReorder,
    handleRequestDeleteColumn,
    handleConfirmDeleteColumn,
    handleCancelDeleteColumn,
  };
}
