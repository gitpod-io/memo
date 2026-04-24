"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { SerializedEditorState } from "lexical";
import { PageTitle } from "@/components/page-title";
import { PageIcon } from "@/components/page-icon";
import { PageCover } from "@/components/page-cover";
import { ViewTabs } from "@/components/database/view-tabs";
import { SortMenu } from "@/components/database/sort-menu";
import { FilterBar } from "@/components/database/filter-bar";
import { RenamePropertyDialog } from "@/components/database/rename-property-dialog";
import { DeletePropertyDialog } from "@/components/database/delete-property-dialog";
import {
  ViewConfigDropdown,
  ComingSoonPlaceholder,
  DatabaseSkeleton,
} from "@/components/database/database-view-helpers";
import { CSVExportButton } from "@/components/database/csv-export-button";
import { loadDatabase, loadWorkspaceMembers } from "@/lib/database";
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

  // Load database data and workspace members on mount (skipped when
  // server-prefetched initialData is provided — eliminates the second
  // skeleton flash during database page navigation, #682)
  useEffect(() => {
    if (hasInitialData) return;

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
  }, [pageId, workspaceId, hasInitialData]);

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
    handleCardMove,
    handleCellUpdate,
    handleDeleteRow,
  } = useDatabaseRows({ pageId, userId, rows, setRows, setProperties });

  const {
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
              <div className="flex items-center gap-1 p-2">
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
                  rows={displayedRows}
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
      <DeletePropertyDialog
        open={deletingProperty !== null}
        propertyName={deletingProperty?.name ?? null}
        onCancel={handleCancelDeleteColumn}
        onConfirm={handleConfirmDeleteColumn}
      />
    </>
  );
}
