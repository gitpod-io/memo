"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import type { SerializedEditorState } from "lexical";
import { PageTitle } from "@/components/page-title";
import { PageIcon } from "@/components/page-icon";
import { PageCover } from "@/components/page-cover";
import { ViewTabs, VIEW_TYPE_LABELS } from "@/components/database/view-tabs";
import { SortMenu } from "@/components/database/sort-menu";
import { FilterBar } from "@/components/database/filter-bar";
import {
  sortRows,
  filterRows,
  type SortRule,
  type FilterRule,
} from "@/lib/database-filters";
import {
  addProperty,
  addRow,
  addView,
  deleteView,
  loadDatabase,
  loadWorkspaceMembers,
  reorderViews,
  updateProperty,
  updateRowValue,
  updateView,
} from "@/lib/database";
import { createClient } from "@/lib/supabase/client";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
} from "@/lib/sentry";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseView,
  DatabaseViewType,
} from "@/lib/types";

// Dynamically import view components to code-split database view types
const TableView = dynamic(
  () =>
    import("@/components/database/views/table-view").then(
      (mod) => mod.TableView,
    ),
  { ssr: false },
);

const BoardView = dynamic(
  () =>
    import("@/components/database/views/board-view").then(
      (mod) => mod.BoardView,
    ),
  { ssr: false },
);

const ListView = dynamic(
  () =>
    import("@/components/database/views/list-view").then(
      (mod) => mod.ListView,
    ),
  { ssr: false },
);

const CalendarView = dynamic(
  () =>
    import("@/components/database/views/calendar-view").then(
      (mod) => mod.CalendarView,
    ),
  { ssr: false },
);

const GalleryView = dynamic(
  () =>
    import("@/components/database/views/gallery-view").then(
      (mod) => mod.GalleryView,
    ),
  { ssr: false },
);

// Dynamically import the editor only when the database page has content above the grid
const Editor = dynamic(
  () => import("@/components/editor/editor").then((mod) => mod.Editor),
  { ssr: false },
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DatabaseViewClientProps {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  pageCoverUrl: string | null;
  initialContent: SerializedEditorState | null;
  workspaceId: string;
  workspaceSlug: string;
  userId: string;
}

// ---------------------------------------------------------------------------
// Coming Soon placeholder for non-table view types
// ---------------------------------------------------------------------------

function ComingSoonPlaceholder({ viewType }: { viewType: DatabaseViewType }) {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
      {viewType.charAt(0).toUpperCase() + viewType.slice(1)} view coming soon
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DatabaseSkeleton() {
  return (
    <div className="space-y-3">
      {/* View tabs skeleton */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
        <div className="h-5 w-20 animate-pulse bg-muted" />
        <div className="h-5 w-20 animate-pulse bg-muted" />
        <div className="h-5 w-20 animate-pulse bg-muted" />
      </div>
      {/* Table skeleton */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="h-8 w-1/4 animate-pulse bg-muted" />
          <div className="h-8 w-1/4 animate-pulse bg-muted" />
          <div className="h-8 w-1/4 animate-pulse bg-muted" />
          <div className="h-8 w-1/4 animate-pulse bg-muted" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <div className="h-10 w-1/4 animate-pulse bg-muted" />
            <div className="h-10 w-1/4 animate-pulse bg-muted" />
            <div className="h-10 w-1/4 animate-pulse bg-muted" />
            <div className="h-10 w-1/4 animate-pulse bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DatabaseViewClient
// ---------------------------------------------------------------------------

export function DatabaseViewClient(props: DatabaseViewClientProps) {
  const {
    pageId,
    pageTitle,
    pageIcon,
    pageCoverUrl,
    initialContent,
    workspaceId,
    workspaceSlug,
    userId,
  } = props;
  const router = useRouter();
  const searchParams = useSearchParams();

  // Database data state
  const [properties, setProperties] = useState<DatabaseProperty[]>([]);
  const [views, setViews] = useState<DatabaseView[]>([]);
  const [rows, setRows] = useState<DatabaseRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Load database data and workspace members on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [dbResult, membersResult] = await Promise.all([
        loadDatabase(pageId),
        loadWorkspaceMembers(workspaceId),
      ]);
      if (cancelled) return;

      if (dbResult.error || !dbResult.data) {
        setLoading(false);
        return;
      }

      // Inject _members into person and created_by properties so renderers
      // can resolve user IDs to display names and avatars.
      const members = membersResult.data ?? [];
      const enrichedProperties = dbResult.data.properties.map((prop) => {
        if (prop.type === "person" || prop.type === "created_by") {
          return { ...prop, config: { ...prop.config, _members: members } };
        }
        return prop;
      });

      setProperties(enrichedProperties);
      setViews(dbResult.data.views);
      setRows(dbResult.data.rows);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [pageId, workspaceId]);

  // Handle view tab change — update URL ?view= param
  const handleViewChange = useCallback(
    (viewId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", viewId);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Create a new view with sensible defaults per type
  const handleAddView = useCallback(
    async (type: DatabaseViewType) => {
      const name = `${VIEW_TYPE_LABELS[type]} view`;
      const { data: newView, error } = await addView(pageId, name, type, {});
      if (error || !newView) {
        toast.error("Failed to create view", { duration: 8000 });
        return;
      }
      setViews((prev) => [...prev, newView]);
      // Switch to the new view
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", newView.id);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [pageId, router, searchParams],
  );

  // Rename a view
  const handleRenameView = useCallback(
    async (viewId: string, newName: string) => {
      const { data: updated, error } = await updateView(viewId, {
        name: newName,
      });
      if (error || !updated) {
        toast.error("Failed to rename view", { duration: 8000 });
        return;
      }
      setViews((prev) =>
        prev.map((v) => (v.id === viewId ? { ...v, name: newName } : v)),
      );
    },
    [],
  );

  // Delete a view (with last-view protection handled by deleteView)
  const handleDeleteView = useCallback(
    async (viewId: string) => {
      const { error } = await deleteView(viewId);
      if (error) {
        toast.error(error.message || "Failed to delete view", {
          duration: 8000,
        });
        return;
      }
      setViews((prev) => {
        const remaining = prev.filter((v) => v.id !== viewId);
        // If the deleted view was active, switch to the first remaining view
        if (viewId === activeViewId && remaining.length > 0) {
          const params = new URLSearchParams(searchParams.toString());
          params.set("view", remaining[0].id);
          router.replace(`?${params.toString()}`, { scroll: false });
        }
        return remaining;
      });
    },
    [activeViewId, router, searchParams],
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
        toast.error("Failed to duplicate view", { duration: 8000 });
        return;
      }
      setViews((prev) => [...prev, newView]);
      // Switch to the duplicated view
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", newView.id);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [pageId, views, router, searchParams],
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
        toast.error("Failed to reorder views", { duration: 8000 });
        // Reload to restore correct order
        const { data } = await loadDatabase(pageId);
        if (data) setViews(data.views);
      }
    },
    [pageId],
  );

  // -----------------------------------------------------------------------
  // Sort & filter — derived from active view config, persisted on change
  // -----------------------------------------------------------------------

  const activeSorts: SortRule[] = useMemo(
    () => (activeView?.config.sorts as SortRule[] | undefined) ?? [],
    [activeView],
  );

  const activeFilters: FilterRule[] = useMemo(
    () => (activeView?.config.filters as FilterRule[] | undefined) ?? [],
    [activeView],
  );

  // Apply sort and filter to produce the displayed rows
  const displayedRows = useMemo(() => {
    let result = rows;
    if (activeFilters.length > 0) {
      result = filterRows(result, activeFilters, properties);
    }
    if (activeSorts.length > 0) {
      result = sortRows(result, activeSorts, properties);
    }
    return result;
  }, [rows, activeSorts, activeFilters, properties]);

  const handleSortsChange = useCallback(
    async (newSorts: SortRule[]) => {
      if (!activeView) return;
      const newConfig = { ...activeView.config, sorts: newSorts };
      // Optimistic update
      setViews((prev) =>
        prev.map((v) =>
          v.id === activeView.id ? { ...v, config: newConfig } : v,
        ),
      );
      const { error } = await updateView(activeView.id, { config: newConfig });
      if (error) {
        toast.error("Failed to update sort", { duration: 8000 });
      }
    },
    [activeView],
  );

  const handleFiltersChange = useCallback(
    async (newFilters: FilterRule[]) => {
      if (!activeView) return;
      const newConfig = { ...activeView.config, filters: newFilters };
      // Optimistic update
      setViews((prev) =>
        prev.map((v) =>
          v.id === activeView.id ? { ...v, config: newConfig } : v,
        ),
      );
      const { error } = await updateView(activeView.id, { config: newConfig });
      if (error) {
        toast.error("Failed to update filter", { duration: 8000 });
      }
    },
    [activeView],
  );

  // Column header sort toggle: cycles unsorted → asc → desc → unsorted
  const handleSortToggle = useCallback(
    (propertyId: string) => {
      const existing = activeSorts.find((s) => s.property_id === propertyId);
      let newSorts: SortRule[];
      if (!existing) {
        newSorts = [...activeSorts, { property_id: propertyId, direction: "asc" }];
      } else if (existing.direction === "asc") {
        newSorts = activeSorts.map((s) =>
          s.property_id === propertyId ? { ...s, direction: "desc" as const } : s,
        );
      } else {
        newSorts = activeSorts.filter((s) => s.property_id !== propertyId);
      }
      void handleSortsChange(newSorts);
    },
    [activeSorts, handleSortsChange],
  );

  // -----------------------------------------------------------------------
  // Row / column / cell CRUD
  // -----------------------------------------------------------------------

  const handleAddRow = useCallback(
    async (initialValues?: Record<string, Record<string, unknown>>) => {
      const { data: rowPage, error } = await addRow(
        pageId,
        userId,
        initialValues,
      );
      if (error || !rowPage) {
        toast.error("Failed to add row", { duration: 8000 });
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
    [pageId, userId],
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

      const { error } = await updateRowValue(rowId, propertyId, newValue);
      if (error) {
        toast.error("Failed to move card", { duration: 8000 });
      }
    },
    [],
  );

  const handleCellUpdate = useCallback(
    async (rowId: string, propertyId: string, value: Record<string, unknown>) => {
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
                value,
                updated_at: new Date().toISOString(),
              },
            },
          };
        }),
      );

      const { error } = await updateRowValue(rowId, propertyId, value);
      if (error) {
        toast.error("Failed to update cell", { duration: 8000 });
      }
    },
    [],
  );

  const handleAddColumn = useCallback(async () => {
    const name = `Property ${properties.length + 1}`;
    const { data: newProp, error } = await addProperty(pageId, name, "text");
    if (error || !newProp) {
      toast.error("Failed to add column", { duration: 8000 });
      return;
    }
    setProperties((prev) => [...prev, newProp]);
  }, [pageId, properties.length]);

  const handleColumnHeaderClick = useCallback(
    async (propertyId: string) => {
      const prop = properties.find((p) => p.id === propertyId);
      if (!prop) return;

      const newName = window.prompt("Rename property", prop.name);
      if (newName === null || newName.trim() === "" || newName === prop.name) return;

      // Optimistic update
      setProperties((prev) =>
        prev.map((p) => (p.id === propertyId ? { ...p, name: newName.trim() } : p)),
      );

      const { error } = await updateProperty(propertyId, { name: newName.trim() });
      if (error) {
        toast.error("Failed to rename property", { duration: 8000 });
        // Revert
        setProperties((prev) =>
          prev.map((p) => (p.id === propertyId ? { ...p, name: prop.name } : p)),
        );
      }
    },
    [properties],
  );

  const handleDeleteRow = useCallback(
    async (rowId: string) => {
      // Optimistic removal
      setRows((prev) => prev.filter((r) => r.page.id !== rowId));

      const supabase = createClient();
      const { error } = await supabase.rpc("soft_delete_page", {
        page_id: rowId,
      });
      if (error) {
        if (!isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "database-view:delete-row");
        }
        toast.error("Failed to delete row", { duration: 8000 });
        // Reload to restore
        const { data } = await loadDatabase(pageId);
        if (data) setRows(data.rows);
      }
    },
    [pageId],
  );

  // Check if there's Lexical content to render above the database
  const hasContent =
    initialContent !== null &&
    initialContent !== undefined &&
    typeof initialContent === "object" &&
    "root" in initialContent;

  return (
    <>
      <div className="group/page-header">
        <PageCover
          key={`cover-${pageId}`}
          pageId={pageId}
          initialCoverUrl={pageCoverUrl}
        />
        <PageIcon
          key={`icon-${pageId}`}
          pageId={pageId}
          initialIcon={pageIcon}
        />
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <PageTitle key={pageId} pageId={pageId} initialTitle={pageTitle} />
          </div>
        </div>
      </div>

      {/* Optional Lexical content above the database grid */}
      {hasContent && (
        <div className="mt-4">
          <Editor
            key={`db-content-${pageId}`}
            pageId={pageId}
            workspaceId={workspaceId}
            initialContent={initialContent}
          />
        </div>
      )}

      {/* Database view area */}
      <div className="mt-6">
        {loading ? (
          <DatabaseSkeleton />
        ) : (
          <>
            {views.length > 0 && (
              <ViewTabs
                views={views}
                activeViewId={activeViewId}
                onViewChange={handleViewChange}
                onAddView={handleAddView}
                onRenameView={handleRenameView}
                onDeleteView={handleDeleteView}
                onDuplicateView={handleDuplicateView}
                onReorderViews={handleReorderViews}
              />
            )}

            {/* Sort & filter toolbar */}
            {activeView && (
              <div className="flex items-center gap-1 px-1 py-1">
                <SortMenu
                  properties={properties}
                  sorts={activeSorts}
                  onSortsChange={handleSortsChange}
                />
                <FilterBar
                  properties={properties}
                  filters={activeFilters}
                  onFiltersChange={handleFiltersChange}
                />
              </div>
            )}

            <div className="mt-0">
              {activeView?.type === "table" ? (
                <TableView
                  rows={displayedRows}
                  properties={properties}
                  viewConfig={activeView.config}
                  workspaceSlug={workspaceSlug}
                  onAddRow={handleAddRow}
                  onCellUpdate={handleCellUpdate}
                  onAddColumn={handleAddColumn}
                  onColumnHeaderClick={handleColumnHeaderClick}
                  onDeleteRow={handleDeleteRow}
                  sorts={activeSorts}
                  onSortToggle={handleSortToggle}
                />
              ) : activeView?.type === "board" ? (
                <BoardView
                  rows={displayedRows}
                  properties={properties}
                  viewConfig={activeView.config}
                  workspaceSlug={workspaceSlug}
                  onCardMove={handleCardMove}
                  onAddRow={handleAddRow}
                />
              ) : activeView?.type === "list" ? (
                <ListView
                  rows={displayedRows}
                  properties={properties}
                  viewConfig={activeView.config}
                  workspaceSlug={workspaceSlug}
                  onAddRow={handleAddRow}
                />
              ) : activeView?.type === "calendar" ? (
                <CalendarView
                  rows={displayedRows}
                  properties={properties}
                  viewConfig={activeView.config}
                  workspaceSlug={workspaceSlug}
                />
              ) : activeView?.type === "gallery" ? (
                <GalleryView
                  rows={displayedRows}
                  properties={properties}
                  viewConfig={activeView.config}
                  workspaceSlug={workspaceSlug}
                />
              ) : activeView ? (
                <ComingSoonPlaceholder viewType={activeView.type} />
              ) : null}
            </div>
          </>
        )}
      </div>
    </>
  );
}
