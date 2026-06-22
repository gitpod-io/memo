"use client";

import { useCallback, useState } from "react";
import {
  ArrowDown,
  ArrowDownWideNarrow,
  ArrowUp,
  ArrowUpNarrowWide,
  Calendar,
  Check,
  Copy,
  Hash,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { PROPERTY_TYPE_ICON } from "@/lib/property-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { SortRule } from "@/lib/database-filters";
import { cn } from "@/lib/utils";
import type { DatabaseProperty } from "@/lib/types";
import { DATE_FORMAT_OPTIONS } from "@/components/database/property-types/date";
import type { DateFormat } from "@/components/database/property-types/date";

// ---------------------------------------------------------------------------
// Column drag state (shared with TableView)
// ---------------------------------------------------------------------------

export interface ColumnDragState {
  /** The property ID of the column being dragged. */
  propertyId: string;
}

export interface ColumnDropTarget {
  /** Index in visibleProperties where the dragged column would be inserted. */
  insertIndex: number;
}

// ---------------------------------------------------------------------------
// Number format options
// ---------------------------------------------------------------------------

type NumberFormat = "number" | "currency" | "percent";

const NUMBER_FORMAT_OPTIONS: { value: NumberFormat; label: string }[] = [
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency ($)" },
  { value: "percent", label: "Percent (%)" },
];

// ---------------------------------------------------------------------------
// TableColumnHeader
// ---------------------------------------------------------------------------

export interface TableColumnHeaderProps {
  property: DatabaseProperty;
  colIndex: number;
  sortRule: SortRule | undefined;
  isDragging: boolean;
  showDropBefore: boolean;
  showDropAfter: boolean;
  resizingColumn: string | null;
  onColumnReorder?: (orderedPropertyIds: string[]) => void;
  onColumnHeaderClick?: (propertyId: string) => void;
  onDuplicateColumn?: (propertyId: string) => void;
  onDeleteColumn?: (propertyId: string) => void;
  onPropertyConfigChange?: (
    propertyId: string,
    config: Record<string, unknown>,
  ) => void;
  onSortToggle?: (propertyId: string) => void;
  onSortColumn?: (propertyId: string, direction: "asc" | "desc") => void;
  onDragStart: (e: React.DragEvent, propertyId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, colIndex: number) => void;
  onDrop: (e: React.DragEvent) => void;
  onResizeStart: (propertyId: string, e: React.MouseEvent) => void;
  onResizeAutoFit?: (propertyId: string) => void;
}

export function TableColumnHeader({
  property,
  colIndex,
  sortRule,
  isDragging,
  showDropBefore,
  showDropAfter,
  resizingColumn,
  onColumnReorder,
  onColumnHeaderClick,
  onDuplicateColumn,
  onDeleteColumn,
  onPropertyConfigChange,
  onSortToggle,
  onSortColumn,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onResizeStart,
  onResizeAutoFit,
}: TableColumnHeaderProps) {
  const Icon = PROPERTY_TYPE_ICON[property.type];

  // ---------------------------------------------------------------------------
  // Delete confirmation
  // ---------------------------------------------------------------------------

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const requestDelete = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (onDeleteColumn) {
      onDeleteColumn(property.id);
    }
    setShowDeleteConfirm(false);
  }, [onDeleteColumn, property.id]);

  const cancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  return (
    <div
      className={cn(
        "group/header relative sticky top-0 z-10 border-b border-overlay-border bg-background p-2",
        onColumnReorder && "cursor-grab",
        isDragging && "opacity-50",
      )}
      role="columnheader"
      aria-sort={
        sortRule
          ? sortRule.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      data-testid={`db-table-column-header-${colIndex}`}
      draggable={!!onColumnReorder}
      onDragStart={(e) => onDragStart(e, property.id)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, colIndex)}
      onDrop={onDrop}
    >
      {/* Drop indicator — left edge */}
      {showDropBefore && (
        <div className="absolute left-0 top-0 z-20 h-full w-0.5 bg-accent" />
      )}
      <div className="flex w-full items-center gap-1.5" data-column-id={property.id}>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <Icon className="h-3 w-3 shrink-0" />
          <span className="truncate">{property.name}</span>
        </span>
        {/* Sort indicator — click to cycle */}
        {onSortToggle && (
          <button
            type="button"
            onClick={() => onSortToggle(property.id)}
            className={cn(
              "shrink-0",
              sortRule
                ? "text-muted-foreground"
                : "text-transparent group-hover/header:text-muted-foreground/50",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
            aria-label={`Sort by ${property.name}`}
          >
            {sortRule?.direction === "desc" ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUp className="h-3 w-3" />
            )}
          </button>
        )}
        {/* Column header menu — rename / duplicate / sort / format / delete */}
        {(onColumnHeaderClick || onDuplicateColumn || onDeleteColumn || onPropertyConfigChange || onSortColumn) && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="shrink-0 text-transparent outline-none group-hover/header:text-muted-foreground/50"
              aria-label={`${property.name} column menu`}
            >
              <MoreHorizontal className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {onColumnHeaderClick && (
                <DropdownMenuItem onClick={() => onColumnHeaderClick(property.id)}>
                  <Pencil className="h-4 w-4" />
                  Rename property
                </DropdownMenuItem>
              )}
              {onDuplicateColumn && property.position !== 0 && (
                <DropdownMenuItem onClick={() => onDuplicateColumn(property.id)}>
                  <Copy className="h-4 w-4" />
                  Duplicate property
                </DropdownMenuItem>
              )}
              {onSortColumn && (
                <>
                  {(onColumnHeaderClick || (onDuplicateColumn && property.position !== 0)) && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    data-testid="sort-ascending"
                    onClick={() => onSortColumn(property.id, "asc")}
                  >
                    <ArrowUpNarrowWide className="h-4 w-4" />
                    Sort ascending
                    {sortRule?.direction === "asc" && (
                      <Check className="ml-auto h-4 w-4" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-testid="sort-descending"
                    onClick={() => onSortColumn(property.id, "desc")}
                  >
                    <ArrowDownWideNarrow className="h-4 w-4" />
                    Sort descending
                    {sortRule?.direction === "desc" && (
                      <Check className="ml-auto h-4 w-4" />
                    )}
                  </DropdownMenuItem>
                </>

              )}
              {property.type === "number" && onPropertyConfigChange && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
                    <Hash className="mr-1 inline-block h-3 w-3" />
                    Number format
                  </div>
                  {NUMBER_FORMAT_OPTIONS.map((opt) => {
                    const currentFormat =
                      (property.config.format as string) ?? "number";
                    const isActive = currentFormat === opt.value;
                    return (
                      <DropdownMenuItem
                        key={opt.value}
                        data-testid={`number-format-${opt.value}`}
                        onClick={() => {
                          void onPropertyConfigChange(property.id, {
                            ...property.config,
                            format: opt.value,
                          });
                        }}
                      >
                        <Check
                          className={cn(
                            "h-4 w-4",
                            !isActive && "invisible",
                          )}
                        />
                        {opt.label}
                      </DropdownMenuItem>
                    );
                  })}
                </>
              )}
              {property.type === "date" && onPropertyConfigChange && (
                <>
                  {(onColumnHeaderClick || (onDuplicateColumn && property.position !== 0) || onSortColumn) && <DropdownMenuSeparator />}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Calendar className="h-4 w-4" />
                      Date format
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup
                        value={(property.config.date_format as DateFormat) ?? "short"}
                        onValueChange={(value) =>
                          onPropertyConfigChange(property.id, {
                            ...property.config,
                            date_format: value,
                          })
                        }
                      >
                        {DATE_FORMAT_OPTIONS.map((opt) => (
                          <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                            <span className="flex items-center justify-between gap-4">
                              <span>{opt.label}</span>
                              <span className="text-muted-foreground text-xs">
                                {opt.example}
                              </span>
                            </span>
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}
              {onDeleteColumn && property.position !== 0 && (
                <>
                  {(onColumnHeaderClick ||
                    onDuplicateColumn ||
                    onSortColumn ||
                    ((property.type === "number" || property.type === "date") &&
                      onPropertyConfigChange)) && (
                    <DropdownMenuSeparator />
                  )}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={requestDelete}
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
          resizingColumn === property.id
            ? "bg-accent"
            : "bg-transparent group-hover/header:bg-overlay-border",
        )}
        onMouseDown={(e) => onResizeStart(property.id, e)}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onResizeAutoFit?.(property.id);
        }}
        role="separator"
        aria-orientation="vertical"
        data-testid={`db-table-resize-handle-${colIndex}`}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          if (!open) cancelDelete();
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{property.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              All row values for this column will be permanently deleted. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
