"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { RenamePropertyDialog } from "@/components/database/rename-property-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Check } from "lucide-react";
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
  deleteProperty,
  deleteView,
  loadDatabase,
  loadWorkspaceMembers,
  reorderProperties,
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
import { PROPERTY_TYPE_LABEL } from "@/lib/property-icons";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseView,
  DatabaseViewConfig,
  DatabaseViewType,
  PropertyType,
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
// ViewConfigDropdown — toolbar dropdown for selecting a property (group_by, date_property)
// ---------------------------------------------------------------------------

interface ViewConfigDropdownProps {
  label: string;
  selectedId: string | null;
  options: DatabaseProperty[];
  onSelect: (propertyId: string) => void;
}

function ViewConfigDropdown({
  label,
  selectedId,
  options,
  onSelect,
}: ViewConfigDropdownProps) {
  const selectedName = options.find((p) => p.id === selectedId)?.name;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-white/[0.06] hover:text-foreground"
        data-testid={`view-config-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {label}: {selectedName ?? "None"}
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No matching properties
          </div>
        ) : (
          options.map((prop) => (
            <DropdownMenuItem
              key={prop.id}
              onClick={() => onSelect(prop.id)}
              className="gap-2 text-xs"
            >
              {prop.id === selectedId && <Check className="size-3" />}
              {prop.id !== selectedId && <span className="size-3" />}
              {prop.name}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
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

      // Auto-detect a default config property for board and calendar views
      let config: DatabaseViewConfig = {};
      if (type === "board") {
        const firstSelect = properties.find((p) => p.type === "select");
        if (firstSelect) {
          config = { group_by: firstSelect.id };
        }
      } else if (type === "calendar") {
        const firstDate = properties.find((p) => p.type === "date");
        if (firstDate) {
          config = { date_property: firstDate.id };
        }
      }

      const { data: newView, error } = await addView(pageId, name, type, config);
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
    [pageId, properties, router, searchParams],
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

      const { error } = await updateView(activeView.id, { config: newConfig });
      if (error) {
        toast.error("Failed to update view configuration", { duration: 8000 });
        // Revert
        setViews((prev) =>
          prev.map((v) =>
            v.id === activeView.id ? { ...v, config: activeView.config } : v,
          ),
        );
      }
    },
    [activeView],
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
        if (!isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "database-view:move-card");
        }
        toast.error("Failed to move card", { duration: 8000 });
      }
    },
    [],
  );

  const handleCellUpdate = useCallback(
    async (rowId: string, propertyId: string, value: Record<string, unknown>) => {
      // Extract _newOptions before persisting — select/multi-select editors
      // pass newly created options here so we can save them to the property config.
      const newOptions = value._newOptions as
        | Array<{ id: string; name: string; color: string }>
        | undefined;
      const { _newOptions: _, ...cleanValue } = value;

      // Optimistic updates — batch property config and row value together
      // so React renders both in the same cycle (the renderer needs the
      // updated options to display the newly created option badge).
      if (newOptions) {
        setProperties((prev) =>
          prev.map((p) =>
            p.id === propertyId
              ? { ...p, config: { ...p.config, options: newOptions } }
              : p,
          ),
        );
      }

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
                value: cleanValue,
                updated_at: new Date().toISOString(),
              },
            },
          };
        }),
      );

      // Persist to DB: update property config first, then row value
      if (newOptions) {
        const { error: configError } = await updateProperty(propertyId, {
          config: { options: newOptions },
        });
        if (configError) {
          if (!isInsufficientPrivilegeError(configError)) {
            captureSupabaseError(configError, "database-view:update-property-options");
          }
          toast.error("Failed to save new option", { duration: 8000 });
        }
      }

      const { error } = await updateRowValue(rowId, propertyId, cleanValue);
      if (error) {
        if (!isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "database-view:update-cell");
        }
        toast.error("Failed to update cell", { duration: 8000 });
      }
    },
    [],
  );

  const handleAddColumn = useCallback(
    async (type: PropertyType) => {
      if (isAddingColumn.current) return;
      isAddingColumn.current = true;
      try {
        const baseLabel = PROPERTY_TYPE_LABEL[type];
        const existingNames = new Set(properties.map((p) => p.name));
        let name = baseLabel;
        let suffix = 2;
        while (existingNames.has(name)) {
          name = `${baseLabel} ${suffix}`;
          suffix++;
        }
        const { data: newProp, error } = await addProperty(pageId, name, type);
        if (error || !newProp) {
          toast.error("Failed to add column", { duration: 8000 });
          return;
        }
        setProperties((prev) => [...prev, newProp]);
      } finally {
        isAddingColumn.current = false;
      }
    },
    [pageId, properties],
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

      const { error } = await updateProperty(propertyId, { name: newName });
      if (error) {
        toast.error("Failed to rename property", { duration: 8000 });
        // Revert
        setProperties((prev) =>
          prev.map((p) => (p.id === propertyId ? { ...p, name: oldName } : p)),
        );
      }
    },
    [renamingProperty],
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
        toast.error("Failed to reorder columns", { duration: 8000 });
        setProperties(prevProperties);
      }
    },
    [pageId, properties],
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

    const { error } = await deleteProperty(propertyId);
    if (error) {
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
        });
      }
    }
  }, [deletingProperty, properties, views, pageId]);

  const handleCancelDeleteColumn = useCallback(() => {
    setDeletingProperty(null);
  }, []);

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
              <div className="flex items-center gap-1 bg-muted p-2">
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
                {activeView.type === "board" && (
                  <ViewConfigDropdown
                    label="Group by"
                    selectedId={activeView.config.group_by ?? null}
                    options={properties.filter((p) => p.type === "select")}
                    onSelect={(id) => handleViewConfigChange({ group_by: id })}
                  />
                )}
                {activeView.type === "calendar" && (
                  <ViewConfigDropdown
                    label="Date property"
                    selectedId={activeView.config.date_property ?? null}
                    options={properties.filter((p) => p.type === "date")}
                    onSelect={(id) => handleViewConfigChange({ date_property: id })}
                  />
                )}
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
                  onColumnReorder={handleColumnReorder}
                  onDeleteColumn={handleRequestDeleteColumn}
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
                  onAddRow={handleAddRow}
                />
              ) : activeView?.type === "gallery" ? (
                <GalleryView
                  rows={displayedRows}
                  properties={properties}
                  viewConfig={activeView.config}
                  workspaceSlug={workspaceSlug}
                  onAddRow={handleAddRow}
                />
              ) : activeView ? (
                <ComingSoonPlaceholder viewType={activeView.type} />
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Rename property dialog */}
      <RenamePropertyDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        propertyName={renamingProperty?.name ?? ""}
        onRename={handlePropertyRename}
      />

      {/* Delete property confirmation dialog */}
      <AlertDialog
        open={deletingProperty !== null}
        onOpenChange={(open) => {
          if (!open) handleCancelDeleteColumn();
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{deletingProperty?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the property and all its row values.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDeleteColumn}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDeleteColumn}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
