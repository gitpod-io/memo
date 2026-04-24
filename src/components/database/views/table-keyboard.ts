import type { DatabaseProperty, DatabaseRow } from "@/lib/types";

// ---------------------------------------------------------------------------
// Keyboard navigation for the table grid.
//
// Extracted from table-view.tsx to isolate the key-handling logic and make it
// easier to extend (e.g. arrow-key navigation in #660).
// ---------------------------------------------------------------------------

export interface CellKeyDownParams {
  e: React.KeyboardEvent;
  rowIndex: number;
  colIndex: number;
  visibleProperties: DatabaseProperty[];
  rows: DatabaseRow[];
  startEditing: (rowId: string, propertyId: string) => void;
  stopEditing: () => void;
}

/**
 * Handles keyboard events on an active (editing) table cell.
 *
 * - **Escape / Enter** — stop editing the current cell.
 * - **Tab / Shift+Tab** — move to the next / previous cell, wrapping across rows.
 */
export function handleCellKeyDown({
  e,
  rowIndex,
  colIndex,
  visibleProperties,
  rows,
  startEditing,
  stopEditing,
}: CellKeyDownParams): void {
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
}
