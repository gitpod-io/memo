"use client";

import { memo } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DatabaseProperty,
  DatabaseRow,
} from "@/lib/types";
import {
  isComputedType,
  buildComputedValue,
} from "@/components/database/property-types";
import { evaluateFormulaForRow } from "@/components/database/property-types/formula";
import { TableCell } from "@/components/database/views/table-cell";

// ---------------------------------------------------------------------------
// Editing / focus state (shared with TableView)
// ---------------------------------------------------------------------------

export interface EditingCell {
  rowId: string;
  propertyId: string;
}

export interface FocusedCell {
  rowIndex: number;
  colIndex: number;
}

// ---------------------------------------------------------------------------
// TableRow
// ---------------------------------------------------------------------------

export interface TableRowProps {
  row: DatabaseRow;
  rowIndex: number;
  visibleProperties: DatabaseProperty[];
  allProperties: DatabaseProperty[];
  rowHeightClass: string;
  workspaceSlug: string;
  editingCell: EditingCell | null;
  focusedCell: FocusedCell | null;
  onStartEditing: (rowId: string, propertyId: string) => void;
  onCellKeyDown: (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => void;
  onCellBlur: (rowId: string, propertyId: string, newValue: Record<string, unknown>) => void;
  onCellFocus: (rowIndex: number, colIndex: number) => void;
  onDeleteRow?: (rowId: string) => void;
}

// editingCell and focusedCell change on every interaction but only affect the
// row they target. Compare whether the state is relevant to *this* row so
// unrelated rows skip re-rendering.
function areTableRowPropsEqual(prev: TableRowProps, next: TableRowProps): boolean {
  if (prev.row !== next.row) return false;
  if (prev.rowIndex !== next.rowIndex) return false;
  if (prev.visibleProperties !== next.visibleProperties) return false;
  if (prev.allProperties !== next.allProperties) return false;
  if (prev.rowHeightClass !== next.rowHeightClass) return false;
  if (prev.workspaceSlug !== next.workspaceSlug) return false;
  if (prev.onStartEditing !== next.onStartEditing) return false;
  if (prev.onCellKeyDown !== next.onCellKeyDown) return false;
  if (prev.onCellBlur !== next.onCellBlur) return false;
  if (prev.onCellFocus !== next.onCellFocus) return false;
  if (prev.onDeleteRow !== next.onDeleteRow) return false;

  // Only re-render if editing/focus state targets this row
  const prevEditing = prev.editingCell?.rowId === prev.row.page.id ? prev.editingCell : null;
  const nextEditing = next.editingCell?.rowId === next.row.page.id ? next.editingCell : null;
  if (prevEditing?.propertyId !== nextEditing?.propertyId) return false;

  const prevFocused = prev.focusedCell?.rowIndex === prev.rowIndex ? prev.focusedCell : null;
  const nextFocused = next.focusedCell?.rowIndex === next.rowIndex ? next.focusedCell : null;
  if (prevFocused?.colIndex !== nextFocused?.colIndex) return false;

  return true;
}

export const TableRow = memo(function TableRow({
  row,
  rowIndex,
  visibleProperties,
  allProperties,
  rowHeightClass,
  workspaceSlug,
  editingCell,
  focusedCell,
  onStartEditing,
  onCellKeyDown,
  onCellBlur,
  onCellFocus,
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
        const isFocused =
          focusedCell?.rowIndex === rowIndex &&
          focusedCell?.colIndex === colIndex;

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
            isFocused={isFocused}
            rowHeightClass={rowHeightClass}
            rowIndex={rowIndex}
            colIndex={colIndex}
            onStartEditing={onStartEditing}
            onKeyDown={onCellKeyDown}
            onBlur={onCellBlur}
            onFocus={onCellFocus}
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
}, areTableRowPropsEqual);
