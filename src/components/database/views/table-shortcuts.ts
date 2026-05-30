"use client";

import { useCallback } from "react";
import type { FocusedCell } from "@/components/database/views/table-row";

// ---------------------------------------------------------------------------
// useTableShortcuts — structural keyboard shortcuts for the table grid.
//
// Handles Ctrl/⌘+Enter (add row at bottom), Ctrl/⌘+Shift+Enter (add row
// below focused row), and Backspace/Delete (trigger bulk delete when rows
// are selected via checkboxes).
//
// Returns a React keyboard event handler to compose with the grid's existing
// onKeyDown handler.
// ---------------------------------------------------------------------------

interface UseTableShortcutsParams {
  /** The currently focused (non-editing) cell, if any. */
  focusedCell: FocusedCell | null;
  /** Whether a cell is currently being edited. */
  isEditing: boolean;
  /** Number of rows currently selected via bulk selection checkboxes. */
  selectedCount: number;
  /** Callback to add a row at the bottom of the table. */
  onAddRow?: () => void;
  /** Callback to add a row at a specific index (inserts after that index). */
  onAddRowAtIndex?: (index: number) => void;
  /** Callback to trigger the bulk delete flow for selected rows. */
  onBulkDelete?: () => void;
}

export function useTableShortcuts({
  focusedCell,
  isEditing,
  selectedCount,
  onAddRow,
  onAddRowAtIndex,
  onBulkDelete,
}: UseTableShortcutsParams): (e: React.KeyboardEvent) => void {
  return useCallback(
    (e: React.KeyboardEvent) => {
      // Never fire when a cell editor input is focused
      if (isEditing) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        target.closest('[data-testid="table-cell-editor"]')
      ) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;

      // Ctrl/⌘+Shift+Enter — add row below focused row
      if (mod && e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        if (focusedCell && onAddRowAtIndex) {
          onAddRowAtIndex(focusedCell.rowIndex);
        } else if (onAddRow) {
          // Fallback: add at bottom if no focused cell
          onAddRow();
        }
        return;
      }

      // Ctrl/⌘+Enter — add row at bottom
      if (mod && !e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        onAddRow?.();
        return;
      }

      // Backspace or Delete — trigger bulk delete when rows are selected
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        !mod &&
        !e.shiftKey &&
        !e.altKey &&
        selectedCount > 0
      ) {
        e.preventDefault();
        onBulkDelete?.();
        return;
      }
    },
    [isEditing, focusedCell, selectedCount, onAddRow, onAddRowAtIndex, onBulkDelete],
  );
}
