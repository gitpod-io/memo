"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Plus,
} from "lucide-react";
import { PROPERTY_TYPE_ICON } from "@/lib/property-icons";
import type { SortRule } from "@/lib/database-filters";
import { cn } from "@/lib/utils";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseViewConfig,
  PropertyType,
  RowValue,
} from "@/lib/types";

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
  /** Called when a new column should be added. */
  onAddColumn?: () => void;
  /** Called when column widths change (for persisting to view config). */
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
  /** Called when a column header is clicked (for property config). */
  onColumnHeaderClick?: (propertyId: string) => void;
  /** Active sort rules (for displaying sort indicators in column headers). */
  sorts?: SortRule[];
  /** Called when a column header sort indicator is clicked. Cycles: unsorted → asc → desc → unsorted. */
  onSortToggle?: (propertyId: string) => void;
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
// TableView
// ---------------------------------------------------------------------------

export function TableView({
  rows,
  properties,
  viewConfig,
  workspaceSlug,
  onCellUpdate,
  onAddRow,
  onAddColumn,
  onColumnWidthsChange,
  onColumnHeaderClick,
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

  // Grid template: title column + property columns + add-column button
  const gridTemplateColumns = useMemo(() => {
    const cols = [
      `${TITLE_COLUMN_WIDTH}px`,
      ...visibleProperties.map((p) => `${columnWidths[p.id] ?? DEFAULT_COLUMN_WIDTH}px`),
      "48px", // add column button
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
          <div className="border-b border-white/[0.06] bg-muted p-2">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Title
            </span>
          </div>
          {visibleProperties.map((prop) => {
            const Icon = PROPERTY_TYPE_ICON[prop.type];
            return (
              <div
                key={prop.id}
                className="relative border-b border-white/[0.06] bg-muted p-2"
              >
                <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  <Icon className="h-3 w-3" />
                  {prop.name}
                </span>
              </div>
            );
          })}
          <div className="border-b border-white/[0.06] bg-muted p-2" />
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
            onClick={onAddRow}
            className="w-full border-t border-white/[0.06] p-2 text-left text-sm text-muted-foreground hover:bg-white/[0.02]"
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
          className="sticky top-0 z-10 border-b border-white/[0.06] bg-muted p-2"
          role="columnheader"
        >
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Title
          </span>
        </div>

        {visibleProperties.map((prop) => {
          const Icon = PROPERTY_TYPE_ICON[prop.type];
          const sortRule = sorts.find((s) => s.property_id === prop.id);
          return (
            <div
              key={prop.id}
              className="group/header sticky top-0 z-10 border-b border-white/[0.06] bg-muted p-2"
              role="columnheader"
            >
              <div className="flex w-full items-center gap-1.5">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground hover:text-foreground"
                  onClick={() => onColumnHeaderClick?.(prop.id)}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{prop.name}</span>
                </button>
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
              </div>
              {/* Resize handle */}
              <div
                className={cn(
                  "absolute right-0 top-0 h-full w-1 cursor-col-resize",
                  resizingColumn === prop.id
                    ? "bg-accent"
                    : "bg-transparent group-hover/header:bg-white/[0.06]",
                )}
                onMouseDown={(e) => handleResizeStart(prop.id, e)}
                role="separator"
                aria-orientation="vertical"
              />
            </div>
          );
        })}

        {/* Add column header button */}
        <div className="sticky top-0 z-10 flex items-center justify-center border-b border-white/[0.06] bg-muted">
          {onAddColumn && (
            <button
              type="button"
              onClick={onAddColumn}
              className="flex h-full w-full items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Add column"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* --- Data rows --- */}
        {rows.map((row, rowIndex) => (
          <TableRow
            key={row.page.id}
            row={row}
            rowIndex={rowIndex}
            visibleProperties={visibleProperties}
            rowHeightClass={rowHeightClass}
            workspaceSlug={workspaceSlug}
            editingCell={editingCell}
            onStartEditing={startEditing}
            onCellKeyDown={handleCellKeyDown}
            onCellBlur={handleCellBlur}
          />
        ))}
      </div>

      {/* Add row button */}
      {onAddRow && (
        <button
          type="button"
          onClick={onAddRow}
          className="w-full border-t border-white/[0.06] p-2 text-left text-sm text-muted-foreground hover:bg-white/[0.02]"
        >
          + New
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TableRow (extracted for readability, not a separate file per conventions)
// ---------------------------------------------------------------------------

interface TableRowProps {
  row: DatabaseRow;
  rowIndex: number;
  visibleProperties: DatabaseProperty[];
  rowHeightClass: string;
  workspaceSlug: string;
  editingCell: EditingCell | null;
  onStartEditing: (rowId: string, propertyId: string) => void;
  onCellKeyDown: (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => void;
  onCellBlur: (rowId: string, propertyId: string, newValue: Record<string, unknown>) => void;
}

function TableRow({
  row,
  rowIndex,
  visibleProperties,
  rowHeightClass,
  workspaceSlug,
  editingCell,
  onStartEditing,
  onCellKeyDown,
  onCellBlur,
}: TableRowProps) {
  return (
    <>
      {/* Title cell */}
      <div
        className={cn(
          "flex items-center border-b border-white/[0.06] p-2 hover:bg-white/[0.02]",
          rowHeightClass,
        )}
        role="gridcell"
      >
        <Link
          href={`/${workspaceSlug}/${row.page.id}`}
          className="truncate text-sm text-foreground hover:underline"
        >
          {row.page.icon && <span className="mr-1.5">{row.page.icon}</span>}
          {row.page.title || "Untitled"}
        </Link>
      </div>

      {/* Property cells */}
      {visibleProperties.map((prop, colIndex) => {
        const isEditing =
          editingCell?.rowId === row.page.id &&
          editingCell?.propertyId === prop.id;
        const cellValue = row.values[prop.id];

        return (
          <TableCell
            key={prop.id}
            rowId={row.page.id}
            propertyId={prop.id}
            propertyType={prop.type}
            value={cellValue}
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
          "border-b border-white/[0.06]",
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
  propertyType: PropertyType;
  value: RowValue | undefined;
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
  propertyType,
  value,
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
    return (
      <div
        className={cn(
          "flex items-center border-b border-white/[0.06] p-0",
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
          onBlur={(e) => onBlur(rowId, propertyId, { value: e.target.value })}
        />
      </div>
    );
  }

  // Checkbox type: toggle on click
  if (propertyType === "checkbox") {
    const checked = value?.value?.value === true;
    return (
      <div
        className={cn(
          "flex items-center justify-center border-b border-white/[0.06] p-2 hover:bg-white/[0.02]",
          rowHeightClass,
        )}
        role="gridcell"
      >
        <button
          type="button"
          onClick={() => onBlur(rowId, propertyId, { value: !checked })}
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

  return (
    <div
      className={cn(
        "flex items-center border-b border-white/[0.06] p-2 hover:bg-white/[0.02]",
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
        propertyType={propertyType}
        displayValue={displayValue}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CellRenderer — renders the display value based on property type
// ---------------------------------------------------------------------------

interface CellRendererProps {
  value: RowValue | undefined;
  propertyType: PropertyType;
  displayValue: string;
}

function CellRenderer({ value, propertyType, displayValue }: CellRendererProps) {
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

    case "select": {
      const color = (value?.value as Record<string, unknown>)?.color as string | undefined;
      return <SelectBadge label={displayValue} color={color} />;
    }

    case "multi_select": {
      const items = (value?.value as Record<string, unknown>)?.items as
        | { value: string; color?: string }[]
        | undefined;
      if (!items || items.length === 0) return null;
      return (
        <div className="flex flex-wrap gap-1">
          {items.map((item, i) => (
            <SelectBadge key={i} label={item.value} color={item.color} />
          ))}
        </div>
      );
    }

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
  gray: { bg: "bg-white/[0.08]", text: "text-foreground" },
  blue: { bg: "bg-blue-500/20", text: "text-blue-400" },
  green: { bg: "bg-green-500/20", text: "text-green-400" },
  yellow: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  orange: { bg: "bg-orange-500/20", text: "text-orange-400" },
  red: { bg: "bg-red-500/20", text: "text-red-400" },
  purple: { bg: "bg-purple-500/20", text: "text-purple-400" },
  pink: { bg: "bg-pink-500/20", text: "text-pink-400" },
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

function extractDisplayValue(value: RowValue | undefined, propertyType: PropertyType): string {
  if (!value) return "";

  const raw = value.value;
  if (!raw) return "";

  // Most values are stored as { value: <actual> }
  const inner = raw.value;

  switch (propertyType) {
    case "checkbox":
      return inner === true ? "true" : inner === false ? "false" : "";
    case "multi_select":
      // Multi-select is handled specially in CellRenderer
      return (raw.items as { value: string }[] | undefined)
        ?.map((i) => i.value)
        .join(", ") ?? "";
    default:
      if (typeof inner === "string") return inner;
      if (typeof inner === "number") return String(inner);
      if (inner === null || inner === undefined) return "";
      return String(inner);
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
      <div className="flex border-b border-white/[0.06] bg-muted">
        {cols.map((i) => (
          <div key={i} className="flex-1 p-2">
            <div className="h-3 w-16 animate-pulse bg-white/[0.06]" />
          </div>
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: skeletonRows }, (_, rowIdx) => (
        <div key={rowIdx} className={cn("flex border-b border-white/[0.06]", rowHeight)}>
          {cols.map((colIdx) => (
            <div key={colIdx} className="flex flex-1 items-center p-2">
              <div
                className="h-3 animate-pulse bg-white/[0.06]"
                style={{ width: colIdx === 0 ? "60%" : "40%" }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
