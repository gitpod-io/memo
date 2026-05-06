"use client";

import { memo, useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { DatabaseEmptyState } from "@/components/database/views/database-empty-state";
import { PROPERTY_TYPE_ICON } from "@/lib/property-icons";
import { PropertyTypePicker } from "@/components/database/property-type-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkActionBar } from "@/components/database/views/bulk-action-bar";
import { useRowSelection } from "@/components/database/hooks/use-row-selection";
import type { SortRule } from "@/lib/database-filters";
import { cn } from "@/lib/utils";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseViewConfig,
  PropertyType,
} from "@/lib/types";
import { TableSkeleton } from "@/components/database/views/table-skeleton";
import { TableRow } from "@/components/database/views/table-row";
import { TableColumnHeader } from "@/components/database/views/table-column-header";
import { RowCountStatusBar } from "@/components/database/views/row-count-status-bar";
import { useTableCellNavigation } from "@/components/database/views/table-navigation";
import {
  useColumnResize,
  useColumnDragReorder,
} from "@/components/database/views/table-columns";

const TITLE_COLUMN_WIDTH = 260;
const DEFAULT_COLUMN_WIDTH = 180;

// On mobile, enforce minimum row height of 44px for touch targets
const ROW_HEIGHT_CLASS: Record<NonNullable<DatabaseViewConfig["row_height"]>, string> = {
  compact: "h-8 md:h-8 min-h-[44px] md:min-h-0",
  default: "h-10 md:h-10 min-h-[44px] md:min-h-0",
  tall: "h-14",
};

// Pixel heights for the virtualizer's estimateSize (desktop values).
const ROW_HEIGHT_PX: Record<NonNullable<DatabaseViewConfig["row_height"]>, number> = {
  compact: 33, // 32px (h-8) + 1px border-b
  default: 41, // 40px (h-10) + 1px border-b
  tall: 57,    // 56px (h-14) + 1px border-b
};

// Only virtualize when row count exceeds this threshold.
const VIRTUALIZATION_THRESHOLD = 50;

// Rows rendered beyond the visible area in each direction.
const OVERSCAN_COUNT = 10;

// ---------------------------------------------------------------------------
// useScrollShadow — shows gradient shadows on scrollable edges
// ---------------------------------------------------------------------------

function useScrollShadow() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  return { scrollRef, canScrollLeft, canScrollRight };
}

export interface TableViewProps {
  rows: DatabaseRow[];
  properties: DatabaseProperty[];
  viewConfig: DatabaseViewConfig;
  workspaceSlug: string;
  onCellUpdate?: (rowId: string, propertyId: string, value: Record<string, unknown>) => void;
  onAddRow?: () => void;
  onAddColumn?: (type: PropertyType) => void;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
  onColumnHeaderClick?: (propertyId: string) => void;
  onColumnReorder?: (orderedPropertyIds: string[]) => void;
  onDeleteColumn?: (propertyId: string) => void;
  sorts?: SortRule[];
  onSortToggle?: (propertyId: string) => void;
  onDeleteRow?: (rowId: string) => void;
  /** Bulk delete handler — called with an array of row IDs to delete. */
  onBulkDeleteRows?: (rowIds: string[]) => void;
  loading?: boolean;
  /** Total row count before filtering — used to show "X of Y rows" when filters are active */
  totalRowCount?: number;
  /** Whether filters are currently active on the view */
  hasActiveFilters?: boolean;
  /** Callback to clear all active filters */
  onClearFilters?: () => void;
  /** Key that resets row selection when it changes (e.g. active view ID). */
  selectionResetKey?: string;
}

export const TableView = memo(function TableView({
  rows,
  properties,
  viewConfig,
  workspaceSlug,
  onCellUpdate,
  onAddRow,
  onAddColumn,
  onColumnWidthsChange,
  onColumnHeaderClick,
  onColumnReorder,
  onDeleteColumn,
  onDeleteRow,
  onBulkDeleteRows,
  sorts = [],
  onSortToggle,
  loading = false,
  totalRowCount,
  hasActiveFilters = false,
  onClearFilters,
  selectionResetKey,
}: TableViewProps) {
  const rowHeight = viewConfig.row_height ?? "default";
  const rowHeightClass = ROW_HEIGHT_CLASS[rowHeight];
  const rowHeightPx = ROW_HEIGHT_PX[rowHeight];

  // Visible properties (filter by viewConfig.visible_properties if set)
  const visibleProperties = useMemo(() => {
    if (viewConfig.visible_properties && viewConfig.visible_properties.length > 0) {
      const visibleSet = new Set(viewConfig.visible_properties);
      return properties.filter((p) => visibleSet.has(p.id));
    }
    return properties;
  }, [properties, viewConfig.visible_properties]);

  // Row selection state
  const rowIds = useMemo(() => rows.map((r) => r.page.id), [rows]);
  const selectionEnabled = !!onBulkDeleteRows;
  const {
    selectedIds,
    isSelected,
    isAllSelected,
    isIndeterminate,
    toggle: toggleRowSelection,
    toggleAll: toggleAllRows,
    clear: clearSelection,
  } = useRowSelection({ rowIds, resetKey: selectionResetKey });

  const handleBulkDelete = useCallback(() => {
    if (!onBulkDeleteRows || selectedIds.size === 0) return;
    onBulkDeleteRows(Array.from(selectedIds));
    clearSelection();
  }, [onBulkDeleteRows, selectedIds, clearSelection]);

  // Column resize state
  const { columnWidths, resizingColumn, handleResizeStart } = useColumnResize({
    properties,
    initialWidths: viewConfig.column_widths,
    onColumnWidthsChange,
  });

  // Column drag-and-drop reorder state
  const {
    columnDrag,
    columnDropTarget,
    handleColumnDragStart,
    handleColumnDragEnd,
    handleColumnDragOver,
    handleColumnDrop,
  } = useColumnDragReorder({ visibleProperties, onColumnReorder });

  // Cell editing / focus / keyboard navigation
  const {
    editingCell,
    focusedCell,
    gridRef,
    startEditing,
    handleCellKeyDown,
    handleFocusedCellKeyDown,
    handleCellBlur,
    handleCellFocus,
  } = useTableCellNavigation({ rows, visibleProperties, onCellUpdate });

  // Grid template: checkbox column (when selection enabled) + title column + property columns + flexible trailing column.
  const gridTemplateColumns = useMemo(() => {
    const cols = [
      ...(selectionEnabled ? ["32px"] : []),
      `${TITLE_COLUMN_WIDTH}px`,
      ...visibleProperties.map((p) => `${columnWidths[p.id] ?? DEFAULT_COLUMN_WIDTH}px`),
      "minmax(48px, 1fr)",
    ];
    return cols.join(" ");
  }, [visibleProperties, columnWidths, selectionEnabled]);

  // Scroll shadow for horizontal overflow (must be called before early returns)
  const { scrollRef, canScrollLeft, canScrollRight } = useScrollShadow();

  // --- Row virtualization ---
  const useVirtual = rows.length > VIRTUALIZATION_THRESHOLD;
  const virtualScrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => virtualScrollRef.current,
    estimateSize: () => rowHeightPx,
    overscan: OVERSCAN_COUNT,
    enabled: useVirtual,
  });

  // Expose scrollToIndex so keyboard navigation can scroll virtualized rows
  // into view before focusing them.
  const scrollToRow = useCallback(
    (rowIndex: number) => {
      if (useVirtual) {
        rowVirtualizer.scrollToIndex(rowIndex, { align: "auto" });
      }
    },
    [useVirtual, rowVirtualizer],
  );

  // Attach scrollToRow to the grid element for table-navigation to call.
  useEffect(() => {
    const el = gridRef.current;
    if (el) {
      (el as HTMLDivElement & { __scrollToRow?: (idx: number) => void }).__scrollToRow =
        scrollToRow;
    }
  }, [gridRef, scrollToRow]);

  // --- Loading skeleton ---

  if (loading) {
    return <TableSkeleton rowHeight={rowHeightClass} columnCount={visibleProperties.length + 1} />;
  }

  // --- Empty state ---

  if (rows.length === 0 && !loading) {
    return (
      <div className="w-full">
        <div className="grid w-full" style={{ gridTemplateColumns }}>
          {/* Empty checkbox column placeholder in empty state */}
          {selectionEnabled && (
            <div className="border-b border-overlay-border" />
          )}
          <div className="border-b border-overlay-border p-2">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Title
            </span>
          </div>
          {visibleProperties.map((prop, colIndex) => {
            const Icon = PROPERTY_TYPE_ICON[prop.type];
            const isDragging = columnDrag?.propertyId === prop.id;
            const showDropBefore =
              columnDrag &&
              columnDropTarget?.insertIndex === colIndex &&
              columnDrag.propertyId !== prop.id;
            const showDropAfter =
              columnDrag &&
              columnDropTarget?.insertIndex === colIndex + 1 &&
              columnDrag.propertyId !== prop.id;
            return (
              <div
                key={prop.id}
                className={cn(
                  "relative border-b border-overlay-border p-2",
                  onColumnReorder && "cursor-grab",
                  isDragging && "opacity-50",
                )}
                draggable={!!onColumnReorder}
                onDragStart={(e) => handleColumnDragStart(e, prop.id)}
                onDragEnd={handleColumnDragEnd}
                onDragOver={(e) => handleColumnDragOver(e, colIndex)}
                onDrop={handleColumnDrop}
              >
                {showDropBefore && (
                  <div className="absolute left-0 top-0 z-20 h-full w-0.5 bg-accent" />
                )}
                <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  <Icon className="h-3 w-3" />
                  {prop.name}
                </span>
                {showDropAfter && (
                  <div className="absolute right-0 top-0 z-20 h-full w-0.5 bg-accent" />
                )}
              </div>
            );
          })}
          <div className="border-b border-overlay-border p-2" />
        </div>
        <DatabaseEmptyState
          hasActiveFilters={hasActiveFilters}
          onClearFilters={onClearFilters}
          onAddRow={onAddRow}
        />
        {onAddRow && (
          <button
            type="button"
            onClick={() => onAddRow()}
            className="w-full border-t border-overlay-border p-2 text-left text-sm text-muted-foreground hover:bg-overlay-subtle"
            data-testid="db-table-add-row"
          >
            + New
          </button>
        )}

        {/* Row count status bar */}
        <RowCountStatusBar
          filteredCount={rows.length}
          totalCount={totalRowCount ?? rows.length}
        />
      </div>
    );
  }

  // --- Main table ---

  const virtualItems = useVirtual ? rowVirtualizer.getVirtualItems() : null;
  const totalSize = useVirtual ? rowVirtualizer.getTotalSize() : 0;

  return (
    <div className="relative w-full" data-testid="db-table-container">
      {/* Left scroll shadow */}
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 z-20 w-4 bg-gradient-to-r from-background to-transparent transition-opacity",
          canScrollLeft ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      />
      {/* Right scroll shadow */}
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 z-20 w-4 bg-gradient-to-l from-background to-transparent transition-opacity",
          canScrollRight ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      />

      <div ref={scrollRef} className="w-full overflow-x-auto">
        <div
          ref={gridRef}
          className="w-max min-w-full"
          role="grid"
          aria-label="Database table"
          aria-rowcount={rows.length + 1}
          onKeyDown={handleFocusedCellKeyDown}
        >
          {/* Header row */}
          <div
            role="row"
            className="sticky top-0 z-10 grid"
            style={{ gridTemplateColumns }}
          >
            {/* Select-all checkbox header */}
            {selectionEnabled && (
              <div
                className="flex items-center justify-center border-b border-overlay-border bg-background"
              >
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onCheckedChange={() => toggleAllRows()}
                  aria-label="Select all rows"
                  data-testid="db-table-select-all"
                />
              </div>
            )}

            {/* Title column header */}
            <div
              className="border-b border-overlay-border bg-background p-2"
              role="columnheader"
            >
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Title
              </span>
            </div>

            {/* Property column headers */}
            {visibleProperties.map((prop, colIndex) => {
              const sortRule = sorts.find((s) => s.property_id === prop.id);
              const isDragging = columnDrag?.propertyId === prop.id;
              const showDropBefore = !!(
                columnDrag &&
                columnDropTarget?.insertIndex === colIndex &&
                columnDrag.propertyId !== prop.id
              );
              const showDropAfter = !!(
                columnDrag &&
                columnDropTarget?.insertIndex === colIndex + 1 &&
                columnDrag.propertyId !== prop.id
              );
              return (
                <TableColumnHeader
                  key={prop.id}
                  property={prop}
                  colIndex={colIndex}
                  sortRule={sortRule}
                  isDragging={isDragging}
                  showDropBefore={showDropBefore}
                  showDropAfter={showDropAfter}
                  resizingColumn={resizingColumn}
                  onColumnReorder={onColumnReorder}
                  onColumnHeaderClick={onColumnHeaderClick}
                  onDeleteColumn={onDeleteColumn}
                  onSortToggle={onSortToggle}
                  onDragStart={handleColumnDragStart}
                  onDragEnd={handleColumnDragEnd}
                  onDragOver={handleColumnDragOver}
                  onDrop={handleColumnDrop}
                  onResizeStart={handleResizeStart}
                />
              );
            })}

            {/* Add column header button */}
            <div className="flex items-center border-b border-overlay-border bg-background px-2" data-testid="db-table-add-column">
              {onAddColumn && <PropertyTypePicker onSelect={onAddColumn} />}
            </div>
          </div>

          {/* Data rows — virtualized when above threshold */}
          {useVirtual ? (
            <div
              ref={virtualScrollRef}
              className="overflow-y-auto"
              style={{ maxHeight: `${Math.min(rows.length, 20) * rowHeightPx}px` }}
              data-testid="db-table-virtual-scroll"
            >
              <div
                style={{
                  height: `${totalSize}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualItems!.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <div
                      key={row.page.id}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <TableRow
                        row={row}
                        rowIndex={virtualRow.index}
                        visibleProperties={visibleProperties}
                        allProperties={properties}
                        rowHeightClass={rowHeightClass}
                        workspaceSlug={workspaceSlug}
                        editingCell={editingCell}
                        focusedCell={focusedCell}
                        onStartEditing={startEditing}
                        onCellKeyDown={handleCellKeyDown}
                        onCellBlur={handleCellBlur}
                        onCellFocus={handleCellFocus}
                        onDeleteRow={onDeleteRow}
                        gridTemplateColumns={gridTemplateColumns}
                        isSelected={isSelected(row.page.id)}
                        onToggleSelect={selectionEnabled ? toggleRowSelection : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            rows.map((row, rowIndex) => (
              <TableRow
                key={row.page.id}
                row={row}
                rowIndex={rowIndex}
                visibleProperties={visibleProperties}
                allProperties={properties}
                rowHeightClass={rowHeightClass}
                workspaceSlug={workspaceSlug}
                editingCell={editingCell}
                focusedCell={focusedCell}
                onStartEditing={startEditing}
                onCellKeyDown={handleCellKeyDown}
                onCellBlur={handleCellBlur}
                onCellFocus={handleCellFocus}
                onDeleteRow={onDeleteRow}
                gridTemplateColumns={gridTemplateColumns}
                isSelected={isSelected(row.page.id)}
                onToggleSelect={selectionEnabled ? toggleRowSelection : undefined}
              />
            ))
          )}
        </div>
      </div>

      {/* Add row button */}
      {onAddRow && (
        <button
          type="button"
          onClick={() => onAddRow()}
          className="w-full border-t border-overlay-border p-2 text-left text-sm text-muted-foreground hover:bg-overlay-subtle"
          data-testid="db-table-add-row"
        >
          + New
        </button>
      )}

      {/* Row count status bar */}
      <RowCountStatusBar
        filteredCount={rows.length}
        totalCount={totalRowCount ?? rows.length}
      />

      {/* Bulk action bar — floating at bottom when rows are selected */}
      {selectionEnabled && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onBulkDelete={handleBulkDelete}
          onClear={clearSelection}
        />
      )}
    </div>
  );
});
