import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";
import { VIEW_TYPE_LABELS } from "@/components/database/view-tabs";
import {
  addView,
  deleteView,
  loadDatabase,
  reorderViews,
  updateView,
} from "@/lib/database";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
} from "@/lib/sentry";
import { retryOnNetworkError } from "@/lib/retry";
import type {
  DatabaseProperty,
  DatabaseView,
  DatabaseViewConfig,
  DatabaseViewType,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Hook params & return type
// ---------------------------------------------------------------------------

export interface UseDatabaseViewsParams {
  pageId: string;
  properties: DatabaseProperty[];
  views: DatabaseView[];
  setViews: React.Dispatch<React.SetStateAction<DatabaseView[]>>;
}

export interface UseDatabaseViewsReturn {
  activeViewId: string;
  activeView: DatabaseView | undefined;
  handleViewChange: (viewId: string) => void;
  handleAddView: (type: DatabaseViewType) => Promise<void>;
  handleViewConfigChange: (configPatch: Partial<DatabaseViewConfig>) => Promise<void>;
  handleRenameView: (viewId: string, newName: string) => Promise<void>;
  handleDeleteView: (viewId: string) => Promise<void>;
  handleDuplicateView: (viewId: string) => Promise<void>;
  handleReorderViews: (orderedIds: string[]) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDatabaseViews({
  pageId,
  properties,
  views,
  setViews,
}: UseDatabaseViewsParams): UseDatabaseViewsReturn {
  // Ref holds the latest handlers so retry closures always call the current version
  const handlersRef = useRef<UseDatabaseViewsReturn>(null);

  const searchParams = useSearchParams();

  // Active view: from URL ?view= param, or first view by position
  const viewIdFromUrl = searchParams.get("view");

  const activeViewId = useMemo(() => {
    if (viewIdFromUrl && views.some((v) => v.id === viewIdFromUrl)) {
      return viewIdFromUrl;
    }
    return views[0]?.id ?? "";
  }, [viewIdFromUrl, views]);

  const activeView = useMemo(
    () => views.find((v) => v.id === activeViewId),
    [views, activeViewId],
  );

  // Handle view tab change — update URL ?view= param without server round-trip
  const handleViewChange = useCallback(
    (viewId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", viewId);
      window.history.replaceState(null, "", `?${params.toString()}`);
    },
    [searchParams],
  );

  // Create a new view with sensible defaults per type
  const handleAddView = useCallback(
    async (type: DatabaseViewType) => {
      const name = `${VIEW_TYPE_LABELS[type]} view`;

      // Auto-detect a default config property for board and calendar views
      let config: DatabaseViewConfig = {};
      if (type === "board") {
        const firstGroupable = properties.find((p) => p.type === "select" || p.type === "status");
        if (firstGroupable) {
          config = { group_by: firstGroupable.id };
        }
      } else if (type === "calendar") {
        const firstDate = properties.find((p) => p.type === "date");
        if (firstDate) {
          config = { date_property: firstDate.id };
        }
      }

      const { data: newView, error } = await addView(pageId, name, type, config);
      if (error || !newView) {
        if (error && !isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "database-views:create");
        }
        toast.error("Failed to create view", {
          duration: 8000,
          action: {
            label: "Retry",
            onClick: () => void handlersRef.current?.handleAddView(type),
          },
        });
        return;
      }
      setViews((prev) => [...prev, newView]);
      // Switch to the new view
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", newView.id);
      window.history.replaceState(null, "", `?${params.toString()}`);
    },
    [pageId, properties, searchParams, setViews],
  );

  // Update the active view's config (used by board/calendar config dropdowns)
  const handleViewConfigChange = useCallback(
    async (configPatch: Partial<DatabaseViewConfig>) => {
      if (!activeView) return;
      const newConfig = { ...activeView.config, ...configPatch };

      // Optimistic update
      setViews((prev) =>
        prev.map((v) =>
          v.id === activeView.id ? { ...v, config: newConfig } : v,
        ),
      );

      const { error } = await updateView(activeView.id, { config: newConfig }, pageId);
      if (error) {
        if (!isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "database-views:update-config");
        }
        toast.error("Failed to update view configuration", {
          duration: 8000,
          action: {
            label: "Retry",
            onClick: () => void handlersRef.current?.handleViewConfigChange(configPatch),
          },
        });
        // Revert
        setViews((prev) =>
          prev.map((v) =>
            v.id === activeView.id ? { ...v, config: activeView.config } : v,
          ),
        );
      }
    },
    [activeView, pageId, setViews],
  );

  // Rename a view
  const handleRenameView = useCallback(
    async (viewId: string, newName: string) => {
      const { data: updated, error } = await updateView(viewId, {
        name: newName,
      }, pageId);
      if (error || !updated) {
        if (error && !isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "database-views:rename");
        }
        toast.error("Failed to rename view", {
          duration: 8000,
          action: {
            label: "Retry",
            onClick: () => void handlersRef.current?.handleRenameView(viewId, newName),
          },
        });
        return;
      }
      setViews((prev) =>
        prev.map((v) => (v.id === viewId ? { ...v, name: newName } : v)),
      );
    },
    [pageId, setViews],
  );

  // Delete a view (with last-view protection handled by deleteView)
  const handleDeleteView = useCallback(
    async (viewId: string) => {
      const { error } = await deleteView(viewId, pageId);
      if (error) {
        if (!isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "database-views:delete");
        }
        toast.error(error.message || "Failed to delete view", {
          duration: 8000,
          action: {
            label: "Retry",
            onClick: () => void handlersRef.current?.handleDeleteView(viewId),
          },
        });
        return;
      }
      setViews((prev) => prev.filter((v) => v.id !== viewId));
      // If the deleted view was active, switch to the first remaining view.
      // Done outside setViews to avoid calling history.replaceState during render.
      if (viewId === activeViewId) {
        const remaining = views.filter((v) => v.id !== viewId);
        if (remaining.length > 0) {
          const params = new URLSearchParams(searchParams.toString());
          params.set("view", remaining[0].id);
          window.history.replaceState(null, "", `?${params.toString()}`);
        }
      }
    },
    [activeViewId, pageId, searchParams, setViews, views],
  );

  // Duplicate a view — copy config and create with " (copy)" suffix
  const handleDuplicateView = useCallback(
    async (viewId: string) => {
      const source = views.find((v) => v.id === viewId);
      if (!source) return;

      const name = `${source.name} (copy)`;
      const { data: newView, error } = await addView(
        pageId,
        name,
        source.type,
        { ...source.config },
      );
      if (error || !newView) {
        if (error && !isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "database-views:duplicate");
        }
        toast.error("Failed to duplicate view", {
          duration: 8000,
          action: {
            label: "Retry",
            onClick: () => void handlersRef.current?.handleDuplicateView(viewId),
          },
        });
        return;
      }
      setViews((prev) => [...prev, newView]);
      // Switch to the duplicated view
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", newView.id);
      window.history.replaceState(null, "", `?${params.toString()}`);
    },
    [pageId, views, searchParams, setViews],
  );

  // Reorder views by updating position values
  const handleReorderViews = useCallback(
    async (orderedIds: string[]) => {
      // Optimistic update — reorder locally first
      setViews((prev) => {
        const viewMap = new Map(prev.map((v) => [v.id, v]));
        return orderedIds
          .map((id, i) => {
            const v = viewMap.get(id);
            return v ? { ...v, position: i } : null;
          })
          .filter((v): v is DatabaseView => v !== null);
      });

      const { error } = await reorderViews(pageId, orderedIds);
      if (error) {
        if (!isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "database-views:reorder");
        }
        toast.error("Failed to reorder views", {
          duration: 8000,
          action: {
            label: "Retry",
            onClick: () => void handlersRef.current?.handleReorderViews(orderedIds),
          },
        });
        // Reload to restore correct order
        const { data } = await retryOnNetworkError(() => loadDatabase(pageId));
        if (data) setViews(data.views);
      }
    },
    [pageId, setViews],
  );

  const handlers: UseDatabaseViewsReturn = {
    activeViewId,
    activeView,
    handleViewChange,
    handleAddView,
    handleViewConfigChange,
    handleRenameView,
    handleDeleteView,
    handleDuplicateView,
    handleReorderViews,
  };
  useEffect(() => { handlersRef.current = handlers; });

  return handlers;
}
