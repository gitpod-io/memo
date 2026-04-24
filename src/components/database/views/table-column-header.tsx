"use client";

import {
  ArrowDown,
  ArrowUp,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SortRule } from "@/lib/database-filters";
import { cn } from "@/lib/utils";
import type { DatabaseProperty } from "@/lib/types";

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
  onDeleteColumn?: (propertyId: string) => void;
  onSortToggle?: (propertyId: string) => void;
  onDragStart: (e: React.DragEvent, propertyId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, colIndex: number) => void;
  onDrop: (e: React.DragEvent) => void;
  onResizeStart: (propertyId: string, e: React.MouseEvent) => void;
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
  onDeleteColumn,
  onSortToggle,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onResizeStart,
}: TableColumnHeaderProps) {
  const Icon = PROPERTY_TYPE_ICON[property.type];

  return (
    <div
      className={cn(
        "group/header relative sticky top-0 z-10 border-b border-overlay-border bg-background p-2",
        onColumnReorder && "cursor-grab",
        isDragging && "opacity-50",
      )}
      role="columnheader"
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
      <div className="flex w-full items-center gap-1.5">
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
        {/* Column header menu — rename / delete */}
        {(onColumnHeaderClick || onDeleteColumn) && (
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
              {onDeleteColumn && property.position !== 0 && (
                <>
                  {onColumnHeaderClick && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDeleteColumn(property.id)}
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
        role="separator"
        aria-orientation="vertical"
      />
    </div>
  );
}
