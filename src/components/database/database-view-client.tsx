"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { SerializedEditorState } from "lexical";
import { AlertCircle } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { PageIcon } from "@/components/page-icon";
import { PageCover } from "@/components/page-cover";
import { ViewTabs } from "@/components/database/view-tabs";
import { SortMenu } from "@/components/database/sort-menu";
import { FilterBar } from "@/components/database/filter-bar";
import { DatabaseSearchInput } from "@/components/database/database-search-input";
import { RenamePropertyDialog } from "@/components/database/rename-property-dialog";

import {
  ViewConfigDropdown,
  ComingSoonPlaceholder,
  DatabaseSkeleton,
} from "@/components/database/database-view-helpers";
import { CSVExportButton } from "@/components/database/csv-export-button";
import { RowCountAnnouncer } from "@/components/database/views/row-count-announcer";
import { Button } from "@/components/ui/button";
import { loadDatabase, loadWorkspaceMembers } from "@/lib/database";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
} from "@/lib/sentry";
import { useDatabaseViews } from "@/components/database/hooks/use-database-views";
import { useDatabaseRows } from "@/components/database/hooks/use-database-rows";
import { useDatabaseProperties } from "@/components/database/hooks/use-database-properties";
import { useDatabaseFilters } from "@/components/database/hooks/use-database-filters";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseView,
} from "@/lib/types";

// Dynamically import view components to code-split database view types.
// TableView uses createPortal(document.body) and useLayoutEffect, so it
// needs { ssr: false }. The other views are pure data renderers.
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
);

const ListView = dynamic(
  () =>
    import("@/components/database/views/list-view").then(
      (mod) => mod.ListView,
    ),
);

const CalendarView = dynamic(
  () =>
    import("@/components/database/views/calendar-view").then(
      (mod) => mod.CalendarView,
    ),
);

const GalleryView = dynamic(
  () =>
    import("@/components/database/views/gallery-view").then(
      (mod) => mod.GalleryView,
    ),
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
  /** Server-prefetched database data to avoid a client-side loading skeleton */
  initialData?: {
    properties: DatabaseProperty[];
    views: DatabaseView[];
    rows: DatabaseRow[];
  } | null;
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
    initialData,
  } = props;

  const router = useRouter();

  // Database data state — seed from server-prefetched data when available
  const hasInitialData = initialData != null;
  const [properties, setProperties] = useState<DatabaseProperty[]>(
    initialData?.properties ?? [],
  );
  const [views, setViews] = useState<DatabaseView[]>(
    initialData?.views ?? [],
  );
  const [rows, setRows] = useState<DatabaseRow[]>(initialData?.rows ?? []);
  const [loading, setLoading] = useState(!hasInitialData);
  const [error, setError] = useState<string | null>(null);

  // Incrementing this counter re-triggers the load effect (used by "Try again")
  const [retryCount, setRetryCount] = useState(0);

  // Load database data and workspace members on mount (skipped when
  // server-prefetched initialData is provided — eliminates the second
  // skeleton flash during database page navigation, #682).
  // Bumping retryCount re-runs this effect for the "Try again" button.
  useEffect(() => {
    if (hasInitialData) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const [dbResult, membersResult] = await Promise.all([
        loadDatabase(pageId),
        loadWorkspaceMembers(workspaceId),
      ]);
      if (cancelled) return;

      if (dbResult.error || !dbResult.data) {
        if (dbResult.error && !isInsufficientPrivilegeError(dbResult.error)) {
          captureSupabaseError(dbResult.error, "database-view-client.load");
        }
        setError("Failed to load database. Please check your connection and try again.");
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
      setError(null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [pageId, workspaceId, hasInitialData, retryCount]);

  // Retry handler for the error state "Try again" button
  const handleRetry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  // --- Hooks ---

  const {
    activeViewId,
    activeView,
    handleViewChange,
    handleAddView,
    handleViewConfigChange,
    handleRenameView,
    handleDeleteView,
    handleDuplicateView,
    handleReorderViews,
  } = useDatabaseViews({ pageId, properties, views, setViews });

  const {
    handleAddRow,
    handleDuplicateRow,
    handleCardMove,
    handleCellUpdate,
    handleDeleteRow,
    handleBulkDeleteRows,
  } = useDatabaseRows({ pageId, userId, rows, properties, setRows, setProperties });

  const {
    renameDialogOpen,
    setRenameDialogOpen,
    renamingProperty,
    handleAddColumn,
    handleColumnHeaderClick,
    handlePropertyRename,
    handleColumnReorder,
    handleDeleteColumn,
  } = useDatabaseProperties({
    pageId,
    properties,
    setProperties,
    views,
    setViews,
    setRows,
  });

  const {
    activeSorts,
    activeFilters,
    displayedRows,
    handleSortsChange,
    handleFiltersChange,
    handleSortToggle,
  } = useDatabaseFilters({ pageId, activeView, rows, properties, setViews });

  // Local search state — filters rows by title substring match (case-insensitive).
  // Keyed to activeViewId so it resets automatically on view switch.
  const [searchState, setSearchState] = useState({ viewId: activeViewId, query: "" });

  // When the active view changes, reset the search query
  const searchQuery = searchState.viewId === activeViewId ? searchState.query : "";
  const setSearchQuery = useCallback(
    (query: string) => setSearchState({ viewId: activeViewId, query }),
    [activeViewId],
  );

  // Apply search filter on top of the filter/sort chain
  const searchFilteredRows = useMemo(() => {
    if (!searchQuery.trim()) return displayedRows;
    const query = searchQuery.trim().toLowerCase();
    return displayedRows.filter((row) =>
      (row.page.title ?? "").toLowerCase().includes(query),
    );
  }, [displayedRows, searchQuery]);

  const hasActiveSearch = searchQuery.trim().length > 0;

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
      <div className="mt-6" data-testid="db-view-container">
        {loading ? (
          <DatabaseSkeleton />
        ) : error ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
              <h2 className="text-lg font-medium">Something went wrong</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                {error}
              </p>
              <Button onClick={handleRetry} data-testid="db-retry-button">Try again</Button>
            </div>
          </div>
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
              <div className="flex items-center gap-1 p-2">
                <DatabaseSearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                />
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
                    options={properties.filter((p) => p.type === "select" || p.type === "status")}
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
                <div className="flex-1" />
                <CSVExportButton
                  rows={searchFilteredRows}
                  properties={properties}
                  databaseTitle={pageTitle}
                  userId={userId}
                  workspaceId={workspaceId}
                  pageId={pageId}
                />
              </div>
            )}

            <div className="mt-0">
              {activeView?.type === "table" ? (
                <TableView
                  rows={searchFilteredRows}
                  properties={properties}
                  viewConfig={activeView.config}
                  workspaceSlug={workspaceSlug}
                  onAddRow={handleAddRow}
                  onCellUpdate={handleCellUpdate}
                  onAddColumn={handleAddColumn}
                  onColumnHeaderClick={handleColumnHeaderClick}
                  onColumnReorder={handleColumnReorder}
                  onDeleteColumn={handleDeleteColumn}
                  onDeleteRow={handleDeleteRow}
                  onDuplicateRow={handleDuplicateRow}
                  onBulkDeleteRows={handleBulkDeleteRows}
                  sorts={activeSorts}
                  onSortToggle={handleSortToggle}
                  totalRowCount={rows.length}
                  hasActiveFilters={activeFilters.length > 0 || hasActiveSearch}
                  onClearFilters={() => {
                    void handleFiltersChange([]);
                    setSearchQuery("");
                  }}
                  selectionResetKey={activeViewId}
                />
              ) : activeView?.type === "board" ? (
                <BoardView
                  rows={searchFilteredRows}
                  properties={properties}
                  viewConfig={activeView.config}
                  workspaceSlug={workspaceSlug}
                  onCardMove={handleCardMove}
                  onAddRow={handleAddRow}
                  onDuplicateRow={handleDuplicateRow}
                  onNavigate={router.push}
                  hasActiveFilters={activeFilters.length > 0 || hasActiveSearch}
                  onClearFilters={() => {
                    void handleFiltersChange([]);
                    setSearchQuery("");
                  }}
                />
              ) : activeView?.type === "list" ? (
                <ListView
                  rows={searchFilteredRows}
                  properties={properties}
                  viewConfig={activeView.config}
                  workspaceSlug={workspaceSlug}
                  onAddRow={handleAddRow}
                  onDuplicateRow={handleDuplicateRow}
                  onNavigate={router.push}
                  hasActiveFilters={activeFilters.length > 0 || hasActiveSearch}
                  onClearFilters={() => {
                    void handleFiltersChange([]);
                    setSearchQuery("");
                  }}
                />
              ) : activeView?.type === "calendar" ? (
                <CalendarView
                  rows={searchFilteredRows}
                  properties={properties}
                  viewConfig={activeView.config}
                  workspaceSlug={workspaceSlug}
                  onAddRow={handleAddRow}
                  onNavigate={router.push}
                  hasActiveFilters={activeFilters.length > 0 || hasActiveSearch}
                  onClearFilters={() => {
                    void handleFiltersChange([]);
                    setSearchQuery("");
                  }}
                />
              ) : activeView?.type === "gallery" ? (
                <GalleryView
                  rows={searchFilteredRows}
                  properties={properties}
                  viewConfig={activeView.config}
                  workspaceSlug={workspaceSlug}
                  onAddRow={handleAddRow}
                  onNavigate={router.push}
                  hasActiveFilters={activeFilters.length > 0 || hasActiveSearch}
                  onClearFilters={() => {
                    void handleFiltersChange([]);
                    setSearchQuery("");
                  }}
                />
              ) : activeView ? (
                <ComingSoonPlaceholder viewType={activeView.type} />
              ) : null}
            </div>

            {/* Screen-reader announcement for row count changes */}
            <RowCountAnnouncer
              filteredCount={searchFilteredRows.length}
              totalCount={rows.length}
            />
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


    </>
  );
}
