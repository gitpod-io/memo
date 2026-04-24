"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { computePosition, flip, shift, offset } from "@floating-ui/react";
import {
  ArrowDown,
  ArrowUp,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { PROPERTY_TYPE_ICON } from "@/lib/property-icons";
import { PropertyTypePicker } from "@/components/database/property-type-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SortRule } from "@/lib/database-filters";
import { cn } from "@/lib/utils";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseViewConfig,
  PropertyType,
  RowValue,
  SelectOption,
} from "@/lib/types";
import {
  isComputedType,
  buildComputedValue,
  getPropertyTypeConfig,
} from "@/components/database/property-types";
import { evaluateFormulaForRow } from "@/components/database/property-types/formula";
import { DEFAULT_STATUS_OPTIONS } from "@/components/database/property-types/status";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_COLUMN_WIDTH = 180;
const MIN_COLUMN_WIDTH = 80;
const TITLE_COLUMN_WIDTH = 260;

const ROW_HEIGHT_CLASS: Record<NonNullable<DatabaseViewConfig["row_height"]>, string> = {
  compact: "h-8",
  default: "h-10",
  tall: "h-14",
};

/**
 * Maps a property type to the key its registry editor/renderer expects inside
 * the value object. For example, "text" → "text", "number" → "number", etc.
 * Returns "value" for types without a specific key (fallback).
 */
function valueKeyForType(propertyType: PropertyType): string {
  switch (propertyType) {
    case "text":
      return "text";
    case "number":
      return "number";
    case "url":
      return "url";
    case "email":
      return "email";
    case "phone":
      return "phone";
    case "checkbox":
      return "checked";
    case "date":
      return "date";
    default:
      return "value";
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TableViewProps {
  rows: DatabaseRow[];
  properties: DatabaseProperty[];
  viewConfig: DatabaseViewConfig;
  workspaceSlug: string;
  /** Called when a cell value is updated. */
  onCellUpdate?: (rowId: string, propertyId: string, value: Record<string, unknown>) => void;
  /** Called when a new row should be added. */
  onAddRow?: () => void;
  /** Called when a new column should be added with the chosen property type. */
  onAddColumn?: (type: PropertyType) => void;
  /** Called when column widths change (for persisting to view config). */
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
  /** Called when a column header is clicked (for property config). */
  onColumnHeaderClick?: (propertyId: string) => void;
  /** Called when columns are reordered via drag-and-drop. Receives the new ordered property IDs. */
  onColumnReorder?: (orderedPropertyIds: string[]) => void;
  /** Called when a column should be deleted. Receives the property ID. */
  onDeleteColumn?: (propertyId: string) => void;
  /** Active sort rules (for displaying sort indicators in column headers). */
  sorts?: SortRule[];
  /** Called when a column header sort indicator is clicked. Cycles: unsorted → asc → desc → unsorted. */
  onSortToggle?: (propertyId: string) => void;
  /** Called when a row should be deleted. */
  onDeleteRow?: (rowId: string) => void;
  /** Loading state — shows skeleton. */
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Editing state
// ---------------------------------------------------------------------------

interface EditingCell {
  rowId: string;
  propertyId: string;
}

// ---------------------------------------------------------------------------
// Column drag state
// ---------------------------------------------------------------------------

interface ColumnDragState {
  /** The property ID of the column being dragged. */
  propertyId: string;
}

interface ColumnDropTarget {
  /** Index in visibleProperties where the dragged column would be inserted. */
  insertIndex: number;
}

// ---------------------------------------------------------------------------
// TableView
// ---------------------------------------------------------------------------

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
}: TableViewProps) {
  // Column widths: merge persisted widths with defaults.
  // The key changes when the property set changes, resetting the state
  // with new defaults merged in. User-resized widths are preserved via
  // the viewConfig.column_widths prop (persisted by the parent).
  const propertyKey = useMemo(() => properties.map((p) => p.id).join(","), [properties]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => ({
    ...Object.fromEntries(properties.map((p) => [p.id, DEFAULT_COLUMN_WIDTH])),
    ...viewConfig.column_widths,
  }));

  // Reset widths when property set changes (new columns added/removed)
  // Using the key trick: track the previous key and reset when it changes
  const [prevPropertyKey, setPrevPropertyKey] = useState(propertyKey);
  if (propertyKey !== prevPropertyKey) {
    setPrevPropertyKey(propertyKey);
    const base: Record<string, number> = {};
    for (const p of properties) {
      // Preserve existing user-resized widths, default for new columns
      base[p.id] = columnWidths[p.id] ?? DEFAULT_COLUMN_WIDTH;
    }
    setColumnWidths({ ...base, ...viewConfig.column_widths });
  }

  // Editing state
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  // Resize state
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const prevResizingColumn = useRef<string | null>(null);

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

  // Grid template: title column + property columns + flexible trailing column.
  // The trailing column uses 1fr so it stretches to fill remaining viewport
  // width instead of creating a hard cutoff (matches Notion behaviour).
  const gridTemplateColumns = useMemo(() => {
    const cols = [
      `${TITLE_COLUMN_WIDTH}px`,
      ...visibleProperties.map((p) => `${columnWidths[p.id] ?? DEFAULT_COLUMN_WIDTH}px`),
      "minmax(48px, 1fr)",
    ];
    return cols.join(" ");
  }, [visibleProperties, columnWidths]);

  // --- Resize handlers ---

  const handleResizeStart = useCallback(
    (propertyId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizingColumn(propertyId);
      resizeStartX.current = e.clientX;
      resizeStartWidth.current = columnWidths[propertyId] ?? DEFAULT_COLUMN_WIDTH;
    },
    [columnWidths],
  );

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current;
      const newWidth = Math.max(MIN_COLUMN_WIDTH, resizeStartWidth.current + delta);
      setColumnWidths((prev) => ({ ...prev, [resizingColumn]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingColumn, onColumnWidthsChange]);

  // Persist column widths after a resize ends
  useEffect(() => {
    if (prevResizingColumn.current !== null && resizingColumn === null) {
      onColumnWidthsChange?.(columnWidths);
    }
    prevResizingColumn.current = resizingColumn;
  }, [resizingColumn, columnWidths, onColumnWidthsChange]);

  // --- Column drag-and-drop reorder ---

  const [columnDrag, setColumnDrag] = useState<ColumnDragState | null>(null);
  const [columnDropTarget, setColumnDropTarget] = useState<ColumnDropTarget | null>(null);

  const handleColumnDragStart = useCallback(
    (e: React.DragEvent, propertyId: string) => {
      if (!onColumnReorder) return;
      setColumnDrag({ propertyId });
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", propertyId);
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = "0.5";
      }
    },
    [onColumnReorder],
  );

  const handleColumnDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setColumnDrag(null);
    setColumnDropTarget(null);
  }, []);

  const handleColumnDragOver = useCallback(
    (e: React.DragEvent, colIndex: number) => {
      if (!columnDrag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      // Determine insert position based on cursor position within the header cell
      const rect = e.currentTarget.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const insertIndex = e.clientX < midX ? colIndex : colIndex + 1;

      setColumnDropTarget({ insertIndex });
    },
    [columnDrag],
  );

  const handleColumnDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!columnDrag || !columnDropTarget || !onColumnReorder) return;

      const draggedId = columnDrag.propertyId;
      const fromIndex = visibleProperties.findIndex((p) => p.id === draggedId);
      let toIndex = columnDropTarget.insertIndex;

      // Adjust target index when moving right (the source removal shifts indices)
      if (fromIndex < toIndex) {
        toIndex -= 1;
      }

      if (fromIndex !== -1 && toIndex !== fromIndex) {
        const newOrder = visibleProperties.map((p) => p.id);
        const [removed] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, removed);
        onColumnReorder(newOrder);
      }

      setColumnDrag(null);
      setColumnDropTarget(null);
    },
    [columnDrag, columnDropTarget, onColumnReorder, visibleProperties],
  );

  // --- Cell editing ---

  const startEditing = useCallback((rowId: string, propertyId: string) => {
    setEditingCell({ rowId, propertyId });
  }, []);

  const stopEditing = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
      if (e.key === "Escape") {
        stopEditing();
        return;
      }

      if (e.key === "Enter") {
        stopEditing();
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        const direction = e.shiftKey ? -1 : 1;
        let nextCol = colIndex + direction;
        let nextRow = rowIndex;

        if (nextCol >= visibleProperties.length) {
          nextCol = 0;
          nextRow = nextRow + 1;
        } else if (nextCol < 0) {
          nextCol = visibleProperties.length - 1;
          nextRow = nextRow - 1;
        }

        if (nextRow >= 0 && nextRow < rows.length) {
          startEditing(rows[nextRow].page.id, visibleProperties[nextCol].id);
        } else {
          stopEditing();
        }
      }
    },
    [visibleProperties, rows, startEditing, stopEditing],
  );

  const handleCellBlur = useCallback(
    (rowId: string, propertyId: string, newValue: Record<string, unknown>) => {
      onCellUpdate?.(rowId, propertyId, newValue);
      stopEditing();
    },
    [onCellUpdate, stopEditing],
  );

  // --- Loading skeleton ---

  if (loading) {
    return <TableSkeleton rowHeight={rowHeightClass} columnCount={visibleProperties.length + 1} />;
  }

  // --- Empty state ---

  if (rows.length === 0 && !loading) {
    return (
      <div className="w-full">
        <div
          className="grid w-full"
          style={{ gridTemplateColumns }}
        >
          {/* Header row */}
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
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No rows yet</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Click &quot;+ New&quot; below to add a row
          </p>
        </div>
        {onAddRow && (
          <button
            type="button"
            onClick={() => onAddRow()}
            className="w-full border-t border-overlay-border p-2 text-left text-sm text-muted-foreground hover:bg-overlay-subtle"
          >
            + New
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div
        className="grid w-max min-w-full"
        style={{ gridTemplateColumns }}
        role="grid"
        aria-label="Database table"
      >
        {/* --- Header row --- */}
        <div
          className="sticky top-0 z-10 border-b border-overlay-border bg-background p-2"
          role="columnheader"
        >
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Title
          </span>
        </div>

        {visibleProperties.map((prop, colIndex) => {
          const Icon = PROPERTY_TYPE_ICON[prop.type];
          const sortRule = sorts.find((s) => s.property_id === prop.id);
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
                "group/header relative sticky top-0 z-10 border-b border-overlay-border bg-background p-2",
                onColumnReorder && "cursor-grab",
                isDragging && "opacity-50",
              )}
              role="columnheader"
              draggable={!!onColumnReorder}
              onDragStart={(e) => handleColumnDragStart(e, prop.id)}
              onDragEnd={handleColumnDragEnd}
              onDragOver={(e) => handleColumnDragOver(e, colIndex)}
              onDrop={handleColumnDrop}
            >
              {/* Drop indicator — left edge */}
              {showDropBefore && (
                <div className="absolute left-0 top-0 z-20 h-full w-0.5 bg-accent" />
              )}
              <div className="flex w-full items-center gap-1.5">
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{prop.name}</span>
                </span>
                {/* Sort indicator — click to cycle */}
                {onSortToggle && (
                  <button
                    type="button"
                    onClick={() => onSortToggle(prop.id)}
                    className={cn(
                      "shrink-0",
                      sortRule
                        ? "text-muted-foreground"
                        : "text-transparent group-hover/header:text-muted-foreground/50",
                    )}
                    aria-label={`Sort by ${prop.name}`}
                  >
                    {sortRule?.direction === "desc" ? (
                      <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUp className="h-3 w-3" />
                    )}
                  </button>
                )}
                {/* Column header menu — rename / delete */}
                {(onColumnHeaderClick || onDeleteColumn) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="shrink-0 text-transparent outline-none group-hover/header:text-muted-foreground/50"
                      aria-label={`${prop.name} column menu`}
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {onColumnHeaderClick && (
                        <DropdownMenuItem onClick={() => onColumnHeaderClick(prop.id)}>
                          <Pencil className="h-4 w-4" />
                          Rename property
                        </DropdownMenuItem>
                      )}
                      {onDeleteColumn && prop.position !== 0 && (
                        <>
                          {onColumnHeaderClick && <DropdownMenuSeparator />}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onDeleteColumn(prop.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete property
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {/* Drop indicator — right edge */}
              {showDropAfter && (
                <div className="absolute right-0 top-0 z-20 h-full w-0.5 bg-accent" />
              )}
              {/* Resize handle */}
              <div
                className={cn(
                  "absolute right-0 top-0 h-full w-1 cursor-col-resize",
                  resizingColumn === prop.id
                    ? "bg-accent"
                    : "bg-transparent group-hover/header:bg-overlay-border",
                )}
                onMouseDown={(e) => handleResizeStart(prop.id, e)}
                role="separator"
                aria-orientation="vertical"
              />
            </div>
          );
        })}

        {/* Add column header button */}
        <div className="sticky top-0 z-10 flex items-center border-b border-overlay-border bg-background px-2">
          {onAddColumn && (
            <PropertyTypePicker onSelect={onAddColumn} />
          )}
        </div>

        {/* --- Data rows --- */}
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
            onStartEditing={startEditing}
            onCellKeyDown={handleCellKeyDown}
            onCellBlur={handleCellBlur}
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
        >
          + New
        </button>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// TableRow (extracted for readability, not a separate file per conventions)
// ---------------------------------------------------------------------------

interface TableRowProps {
  row: DatabaseRow;
  rowIndex: number;
  visibleProperties: DatabaseProperty[];
  allProperties: DatabaseProperty[];
  rowHeightClass: string;
  workspaceSlug: string;
  editingCell: EditingCell | null;
  onStartEditing: (rowId: string, propertyId: string) => void;
  onCellKeyDown: (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => void;
  onCellBlur: (rowId: string, propertyId: string, newValue: Record<string, unknown>) => void;
  onDeleteRow?: (rowId: string) => void;
}

function TableRow({
  row,
  rowIndex,
  visibleProperties,
  allProperties,
  rowHeightClass,
  workspaceSlug,
  editingCell,
  onStartEditing,
  onCellKeyDown,
  onCellBlur,
  onDeleteRow,
}: TableRowProps) {
  return (
    <>
      {/* Title cell */}
      <div
        className={cn(
          "group/row flex items-center border-b border-overlay-border p-2 hover:bg-overlay-subtle",
          rowHeightClass,
        )}
        role="gridcell"
      >
        <Link
          href={`/${workspaceSlug}/${row.page.id}`}
          className="min-w-0 flex-1 truncate text-sm text-foreground hover:underline"
        >
          {row.page.icon && <span className="mr-1.5">{row.page.icon}</span>}
          {row.page.title || "Untitled"}
        </Link>
        {onDeleteRow && (
          <button
            type="button"
            onClick={() => onDeleteRow(row.page.id)}
            className="ml-1 shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover/row:opacity-100"
            aria-label="Delete row"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Property cells */}
      {visibleProperties.map((prop, colIndex) => {
        const isEditing =
          editingCell?.rowId === row.page.id &&
          editingCell?.propertyId === prop.id;

        // Computed types derive values from page metadata, not row_values.
        // Formula types evaluate expressions against the row's property values.
        const cellValue =
          isComputedType(prop.type) || prop.type === "formula"
            ? undefined
            : row.values[prop.id];
        const computedValue = isComputedType(prop.type)
          ? buildComputedValue(prop.type, row.page)
          : prop.type === "formula"
            ? evaluateFormulaForRow(prop, row, allProperties)
            : undefined;

        return (
          <TableCell
            key={prop.id}
            rowId={row.page.id}
            propertyId={prop.id}
            property={prop}
            propertyType={prop.type}
            value={cellValue}
            computedValue={computedValue}
            isEditing={isEditing}
            rowHeightClass={rowHeightClass}
            rowIndex={rowIndex}
            colIndex={colIndex}
            onStartEditing={onStartEditing}
            onKeyDown={onCellKeyDown}
            onBlur={onCellBlur}
          />
        );
      })}

      {/* Empty cell under add-column */}
      <div
        className={cn(
          "border-b border-overlay-border",
          rowHeightClass,
        )}
        role="gridcell"
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// TableCell
// ---------------------------------------------------------------------------

interface TableCellProps {
  rowId: string;
  propertyId: string;
  property: DatabaseProperty;
  propertyType: PropertyType;
  value: RowValue | undefined;
  /** Synthetic value for computed types (created_time, updated_time, created_by). */
  computedValue?: Record<string, unknown>;
  isEditing: boolean;
  rowHeightClass: string;
  rowIndex: number;
  colIndex: number;
  onStartEditing: (rowId: string, propertyId: string) => void;
  onKeyDown: (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => void;
  onBlur: (rowId: string, propertyId: string, newValue: Record<string, unknown>) => void;
}

function TableCell({
  rowId,
  propertyId,
  property,
  propertyType,
  value,
  computedValue,
  isEditing,
  rowHeightClass,
  rowIndex,
  colIndex,
  onStartEditing,
  onKeyDown,
  onBlur,
}: TableCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const displayValue = extractDisplayValue(value, propertyType);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Read-only property types don't support editing
  const isReadOnly = propertyType === "formula" ||
    propertyType === "created_time" ||
    propertyType === "updated_time" ||
    propertyType === "created_by";

  if (isEditing && !isReadOnly) {
    // Types with specialized editors use the registry Editor component.
    // Simple text-input types (text, number, url, email, phone) use a plain <input>.
    const config = getPropertyTypeConfig(propertyType);
    const hasRegistryEditor =
      config?.Editor &&
      propertyType !== "text" &&
      propertyType !== "number" &&
      propertyType !== "url" &&
      propertyType !== "email" &&
      propertyType !== "phone";

    if (hasRegistryEditor) {
      return (
        <RegistryEditorCell
          rowId={rowId}
          propertyId={propertyId}
          property={property}
          propertyType={propertyType}
          value={value}
          rowHeightClass={rowHeightClass}
          onBlur={onBlur}
        />
      );
    }

    return (
      <div
        className={cn(
          "flex items-center border-b border-overlay-border p-0",
          rowHeightClass,
        )}
        role="gridcell"
      >
        <input
          ref={inputRef}
          type={propertyType === "number" ? "number" : "text"}
          defaultValue={displayValue}
          className="h-full w-full bg-transparent px-2 text-sm text-foreground outline-none ring-2 ring-inset ring-accent"
          onKeyDown={(e) => onKeyDown(e, rowIndex, colIndex)}
          onBlur={(e) => {
            const key = valueKeyForType(propertyType);
            const raw = e.target.value;
            const parsed = propertyType === "number"
              ? (raw === "" ? null : Number(raw))
              : raw;
            onBlur(rowId, propertyId, { [key]: parsed });
          }}
        />
      </div>
    );
  }

  // Checkbox type: toggle on click
  if (propertyType === "checkbox") {
    const raw = value?.value;
    const checked = raw?.checked === true || raw?.value === true;
    return (
      <div
        className={cn(
          "flex items-center justify-center border-b border-overlay-border p-2 hover:bg-overlay-subtle",
          rowHeightClass,
        )}
        role="gridcell"
      >
        <button
          type="button"
          onClick={() => onBlur(rowId, propertyId, { checked: !checked })}
          className={cn(
            "flex h-4 w-4 items-center justify-center border",
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-transparent",
          )}
          aria-label={checked ? "Uncheck" : "Check"}
        >
          {checked && (
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 6L5 8.5L9.5 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>
    );
  }

  // Computed types use registry renderers with synthesized values
  if (computedValue) {
    const config = getPropertyTypeConfig(propertyType);
    if (config) {
      const { Renderer } = config;
      return (
        <div
          className={cn(
            "flex items-center border-b border-overlay-border p-2",
            "cursor-default",
            rowHeightClass,
          )}
          role="gridcell"
        >
          <Renderer value={computedValue} property={property} />
        </div>
      );
    }
  }

  return (
    <div
      className={cn(
        "flex items-center border-b border-overlay-border p-2 hover:bg-overlay-subtle",
        isReadOnly ? "cursor-default" : "cursor-text",
        rowHeightClass,
      )}
      role="gridcell"
      onClick={isReadOnly ? undefined : () => onStartEditing(rowId, propertyId)}
      onKeyDown={
        isReadOnly
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onStartEditing(rowId, propertyId);
              }
            }
      }
      tabIndex={isReadOnly ? undefined : 0}
    >
      <CellRenderer
        value={value}
        property={property}
        propertyType={propertyType}
        displayValue={displayValue}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Property types whose editors render floating panels (calendars, dropdowns)
// that must escape the table's overflow-x-auto clipping context via a portal.
// ---------------------------------------------------------------------------

const PORTALED_EDITOR_TYPES: ReadonlySet<PropertyType> = new Set([
  "date",
  "select",
  "multi_select",
  "status",
]);

// ---------------------------------------------------------------------------
// RegistryEditorCell — wraps a registry Editor, tracks value changes via ref,
// and commits the latest value on blur so onChange→onBlur sequences work.
// For date/select/multi_select, renders the editor in a portal positioned
// relative to the cell so it is not clipped by the table overflow.
// ---------------------------------------------------------------------------

interface RegistryEditorCellProps {
  rowId: string;
  propertyId: string;
  property: DatabaseProperty;
  propertyType: PropertyType;
  value: RowValue | undefined;
  rowHeightClass: string;
  onBlur: (rowId: string, propertyId: string, newValue: Record<string, unknown>) => void;
}

function RegistryEditorCell({
  rowId,
  propertyId,
  property,
  propertyType,
  value,
  rowHeightClass,
  onBlur,
}: RegistryEditorCellProps) {
  const config = getPropertyTypeConfig(propertyType);
  const Editor = config!.Editor!;
  const latestValue = useRef<Record<string, unknown>>(value?.value ?? {});
  const cellRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const needsPortal = PORTALED_EDITOR_TYPES.has(propertyType);

  const handleChange = useCallback(
    (newValue: Record<string, unknown>) => {
      latestValue.current = newValue;
      onBlur(rowId, propertyId, newValue);
    },
    [rowId, propertyId, onBlur],
  );

  const handleBlur = useCallback(() => {
    onBlur(rowId, propertyId, latestValue.current);
  }, [rowId, propertyId, onBlur]);

  // Position the portaled editor below the cell anchor
  useLayoutEffect(() => {
    if (!needsPortal) return;
    const anchor = cellRef.current;
    const floating = floatingRef.current;
    if (!anchor || !floating) return;

    void computePosition(anchor, floating, {
      placement: "bottom-start",
      middleware: [offset(2), flip({ padding: 8 }), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      floating.style.left = `${x}px`;
      floating.style.top = `${y}px`;
    });
  });

  if (needsPortal) {
    return (
      <>
        <div
          ref={cellRef}
          className={cn(
            "border-b border-overlay-border",
            rowHeightClass,
          )}
          role="gridcell"
        />
        {createPortal(
          <div
            ref={floatingRef}
            className="absolute z-50"
            style={{ left: 0, top: 0 }}
          >
            <Editor
              value={value?.value ?? {}}
              property={property}
              onChange={handleChange}
              onBlur={handleBlur}
            />
          </div>,
          document.body,
        )}
      </>
    );
  }

  return (
    <div
      className={cn(
        "relative border-b border-overlay-border",
        rowHeightClass,
      )}
      role="gridcell"
    >
      <Editor
        value={value?.value ?? {}}
        property={property}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CellRenderer — renders the display value based on property type
// ---------------------------------------------------------------------------

interface CellRendererProps {
  value: RowValue | undefined;
  property: DatabaseProperty;
  propertyType: PropertyType;
  displayValue: string;
}

function CellRenderer({ value, property, propertyType, displayValue }: CellRendererProps) {
  switch (propertyType) {
    case "select":
    case "status": {
      const raw = value?.value as Record<string, unknown> | undefined;
      const optionId = typeof raw?.option_id === "string" ? raw.option_id : null;
      if (!optionId) return null;
      const options = getSelectOptions(property.config, propertyType);
      const option = options.find((o) => o.id === optionId);
      if (!option) return null;
      return <SelectBadge label={option.name} color={option.color} />;
    }

    case "multi_select": {
      const raw = value?.value as Record<string, unknown> | undefined;
      const optionIds = Array.isArray(raw?.option_ids)
        ? (raw.option_ids as string[])
        : [];
      if (optionIds.length === 0) return null;
      const options = getSelectOptions(property.config, propertyType);
      const optionMap = new Map(options.map((o) => [o.id, o]));
      return (
        <div className="flex flex-wrap gap-1">
          {optionIds.map((id) => {
            const option = optionMap.get(id);
            if (!option) return null;
            return (
              <SelectBadge key={id} label={option.name} color={option.color} />
            );
          })}
        </div>
      );
    }

    default:
      break;
  }

  // Non-select types require a displayValue string
  if (!displayValue) {
    return null;
  }

  switch (propertyType) {
    case "url":
      return (
        <a
          href={displayValue}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-sm text-accent hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {displayValue}
        </a>
      );

    case "email":
      return (
        <a
          href={`mailto:${displayValue}`}
          className="truncate text-sm text-accent hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {displayValue}
        </a>
      );

    case "number":
      return (
        <span className="truncate text-sm text-foreground tabular-nums text-right w-full">
          {displayValue}
        </span>
      );

    case "date":
      return (
        <span className="truncate text-sm text-foreground">
          {formatDate(displayValue)}
        </span>
      );

    case "created_time":
    case "updated_time":
      return (
        <span className="truncate text-sm text-muted-foreground">
          {formatDate(displayValue)}
        </span>
      );

    case "formula":
      return (
        <span className="truncate text-sm text-muted-foreground">
          {displayValue}
        </span>
      );

    default:
      return (
        <span className="truncate text-sm text-foreground">
          {displayValue}
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// SelectBadge
// ---------------------------------------------------------------------------

const SELECT_COLORS: Record<string, { bg: string; text: string }> = {
  gray: { bg: "bg-overlay-active", text: "text-foreground" },
  blue: { bg: "bg-blue-500/20", text: "text-blue-400" },
  green: { bg: "bg-green-500/20", text: "text-green-400" },
  yellow: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  orange: { bg: "bg-orange-500/20", text: "text-orange-400" },
  red: { bg: "bg-red-500/20", text: "text-red-400" },
  purple: { bg: "bg-purple-500/20", text: "text-purple-400" },
  pink: { bg: "bg-pink-500/20", text: "text-pink-400" },
  cyan: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
};

function SelectBadge({ label, color }: { label: string; color?: string }) {
  const colorStyle = SELECT_COLORS[color ?? "gray"] ?? SELECT_COLORS.gray;
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 text-xs",
        colorStyle.bg,
        colorStyle.text,
      )}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSelectOptions(config: Record<string, unknown>, type?: PropertyType): SelectOption[] {
  if (Array.isArray(config.options) && config.options.length > 0) {
    return config.options as SelectOption[];
  }
  if (type === "status") return DEFAULT_STATUS_OPTIONS;
  return [];
}

function extractDisplayValue(value: RowValue | undefined, propertyType: PropertyType): string {
  if (!value) return "";

  const raw = value.value;
  if (!raw) return "";

  // Read from the type-specific key first, then fall back to the legacy
  // generic "value" key for data saved before the format was corrected.
  const key = valueKeyForType(propertyType);
  const typed = raw[key];
  const legacy = raw.value;

  switch (propertyType) {
    case "checkbox": {
      const checked = typed ?? legacy;
      return checked === true ? "true" : checked === false ? "false" : "";
    }
    case "select":
    case "multi_select":
    case "status":
      // Select/multi-select/status rendering is handled directly by CellRenderer
      // using option IDs from the raw value and the property config.
      return "";
    default: {
      const inner = typed ?? legacy;
      if (typeof inner === "string") return inner;
      if (typeof inner === "number") return String(inner);
      if (inner === null || inner === undefined) return "";
      return String(inner);
    }
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (_e) {
    // Invalid date string — return as-is rather than crashing
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// TableSkeleton
// ---------------------------------------------------------------------------

interface TableSkeletonProps {
  rowHeight: string;
  columnCount: number;
}

function TableSkeleton({ rowHeight, columnCount }: TableSkeletonProps) {
  const skeletonRows = 5;
  const cols = Array.from({ length: columnCount }, (_, i) => i);

  return (
    <div className="w-full">
      {/* Header skeleton */}
      <div className="flex border-b border-overlay-border">
        {cols.map((i) => (
          <div key={i} className="flex-1 p-2">
            <div className="h-3 w-16 animate-pulse bg-overlay-border" />
          </div>
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: skeletonRows }, (_, rowIdx) => (
        <div key={rowIdx} className={cn("flex border-b border-overlay-border", rowHeight)}>
          {cols.map((colIdx) => (
            <div key={colIdx} className="flex flex-1 items-center p-2">
              <div
                className="h-3 animate-pulse bg-overlay-border"
                style={{ width: colIdx === 0 ? "60%" : "40%" }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
