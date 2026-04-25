"use client";

import { memo, useMemo } from "react";
import { DatabaseEmptyState } from "@/components/database/views/database-empty-state";
import { PROPERTY_TYPE_ICON } from "@/lib/property-icons";
import { PropertyTypePicker } from "@/components/database/property-type-picker";
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

const ROW_HEIGHT_CLASS: Record<NonNullable<DatabaseViewConfig["row_height"]>, string> = {
  compact: "h-8",
  default: "h-10",
  tall: "h-14",
};

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
  loading?: boolean;
  /** Total row count before filtering — used to show "X of Y rows" when filters are active */
  totalRowCount?: number;
  /** Whether filters are currently active on the view */
  hasActiveFilters?: boolean;
  /** Callback to clear all active filters */
  onClearFilters?: () => void;
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
  sorts = [],
  onSortToggle,
  loading = false,
  totalRowCount,
  hasActiveFilters = false,
  onClearFilters,
}: TableViewProps) {
  const rowHeight = viewConfig.row_height ?? "default";
  const rowHeightClass = ROW_HEIGHT_CLASS[rowHeight];

  // Visible properties (filter by viewConfig.visible_properties if set)
  const visibleProperties = useMemo(() => {
    if (viewConfig.visible_properties && viewConfig.visible_properties.length > 0) {
      const visibleSet = new Set(viewConfig.visible_properties);
      return properties.filter((p) => visibleSet.has(p.id));
    }
    return properties;
  }, [properties, viewConfig.visible_properties]);

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

  // Grid template: title column + property columns + flexible trailing column.
  const gridTemplateColumns = useMemo(() => {
    const cols = [
      `${TITLE_COLUMN_WIDTH}px`,
      ...visibleProperties.map((p) => `${columnWidths[p.id] ?? DEFAULT_COLUMN_WIDTH}px`),
      "minmax(48px, 1fr)",
    ];
    return cols.join(" ");
  }, [visibleProperties, columnWidths]);

  // --- Loading skeleton ---

  if (loading) {
    return <TableSkeleton rowHeight={rowHeightClass} columnCount={visibleProperties.length + 1} />;
  }

  // --- Empty state ---

  if (rows.length === 0 && !loading) {
    return (
      <div className="w-full">
        <div className="grid w-full" style={{ gridTemplateColumns }}>
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

  return (
    <div className="w-full overflow-x-auto" data-testid="db-table-container">
      <div
        ref={gridRef}
        className="grid w-max min-w-full"
        style={{ gridTemplateColumns }}
        role="grid"
        aria-label="Database table"
        onKeyDown={handleFocusedCellKeyDown}
      >
        {/* Header row */}
        <div role="row" style={{ display: "contents" }}>
          {/* Title column header */}
          <div
            className="sticky top-0 z-10 border-b border-overlay-border bg-background p-2"
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
          <div className="sticky top-0 z-10 flex items-center border-b border-overlay-border bg-background px-2" data-testid="db-table-add-column">
            {onAddColumn && <PropertyTypePicker onSelect={onAddColumn} />}
          </div>
        </div>

        {/* Data rows */}
        {rows.map((row, rowIndex) => (
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
          />
        ))}
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
    </div>
  );
});
