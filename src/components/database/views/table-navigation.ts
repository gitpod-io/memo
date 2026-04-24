"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DatabaseProperty, DatabaseRow } from "@/lib/types";
import { handleCellKeyDown as handleCellKeyDownAction } from "@/components/database/views/table-keyboard";
import type { EditingCell, FocusedCell } from "@/components/database/views/table-row";

// ---------------------------------------------------------------------------
// useTableCellNavigation — manages editing state, focused cell state, and
// keyboard navigation for the table grid.
// ---------------------------------------------------------------------------

interface UseTableCellNavigationParams {
  rows: DatabaseRow[];
  visibleProperties: DatabaseProperty[];
  onCellUpdate?: (rowId: string, propertyId: string, value: Record<string, unknown>) => void;
}

export function useTableCellNavigation({
  rows,
  visibleProperties,
  onCellUpdate,
}: UseTableCellNavigationParams) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [focusedCell, setFocusedCell] = useState<FocusedCell | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const startEditing = useCallback((rowId: string, propertyId: string) => {
    setEditingCell({ rowId, propertyId });
    setFocusedCell(null);
  }, []);

  const stopEditing = useCallback(() => {
    setEditingCell(null);
  }, []);

  // Focus a cell in the DOM by its grid coordinates.
  const focusCellElement = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (!gridRef.current) return;
      const selector = `[data-row="${rowIndex}"][data-col="${colIndex}"]`;
      const el = gridRef.current.querySelector<HTMLElement>(selector);
      if (el) {
        el.focus();
      }
    },
    [],
  );

  // Navigate to a specific cell. Clamps to grid boundaries.
  const navigateToCell = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (rows.length === 0 || visibleProperties.length === 0) return;
      if (rowIndex < 0 || rowIndex >= rows.length) return;
      if (colIndex < 0 || colIndex >= visibleProperties.length) return;
      setFocusedCell({ rowIndex, colIndex });
      setEditingCell(null);
    },
    [rows, visibleProperties],
  );

  // Move focus with horizontal wrapping across rows.
  const moveFocus = useCallback(
    (fromRow: number, fromCol: number, dRow: number, dCol: number) => {
      const totalCols = visibleProperties.length;
      let nextRow = fromRow + dRow;
      let nextCol = fromCol + dCol;

      if (nextCol >= totalCols) {
        nextCol = 0;
        nextRow = nextRow + 1;
      } else if (nextCol < 0) {
        nextCol = totalCols - 1;
        nextRow = nextRow - 1;
      }

      if (nextRow < 0 || nextRow >= rows.length || nextCol < 0 || nextCol >= totalCols) {
        focusCellElement(fromRow, fromCol);
        return;
      }

      navigateToCell(nextRow, nextCol);
    },
    [visibleProperties, rows, navigateToCell, focusCellElement],
  );

  // Keyboard handler for cells in editing mode
  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
      handleCellKeyDownAction({
        e,
        rowIndex,
        colIndex,
        visibleProperties,
        rows,
        startEditing,
        stopEditing,
      });
      if (e.key === "Escape") {
        setEditingCell(null);
        setFocusedCell({ rowIndex, colIndex });
        return;
      }

      if (e.key === "Enter") {
        stopEditing();
        const nextRow = rowIndex + 1;
        if (nextRow < rows.length) {
          setFocusedCell({ rowIndex: nextRow, colIndex });
        } else {
          setFocusedCell({ rowIndex, colIndex });
        }
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

  // Keyboard handler for cells in focused (non-editing) mode
  const handleFocusedCellKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!focusedCell) return;
      const { rowIndex, colIndex } = focusedCell;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          if (rowIndex - 1 >= 0) {
            navigateToCell(rowIndex - 1, colIndex);
          } else {
            focusCellElement(rowIndex, colIndex);
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (rowIndex + 1 < rows.length) {
            navigateToCell(rowIndex + 1, colIndex);
          } else {
            focusCellElement(rowIndex, colIndex);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          moveFocus(rowIndex, colIndex, 0, -1);
          break;
        case "ArrowRight":
          e.preventDefault();
          moveFocus(rowIndex, colIndex, 0, 1);
          break;
        case "Enter": {
          e.preventDefault();
          const prop = visibleProperties[colIndex];
          const row = rows[rowIndex];
          if (prop && row) {
            const isReadOnly =
              prop.type === "formula" ||
              prop.type === "created_time" ||
              prop.type === "updated_time" ||
              prop.type === "created_by";
            if (!isReadOnly) {
              startEditing(row.page.id, prop.id);
            }
          }
          break;
        }
        case "Escape":
          e.preventDefault();
          setFocusedCell(null);
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          break;
        case "Tab": {
          e.preventDefault();
          const direction = e.shiftKey ? -1 : 1;
          moveFocus(rowIndex, colIndex, 0, direction);
          break;
        }
        default:
          break;
      }
    },
    [focusedCell, visibleProperties, rows, navigateToCell, moveFocus, startEditing],
  );

  // Focus the DOM element when focusedCell changes
  useEffect(() => {
    if (!focusedCell) return;
    focusCellElement(focusedCell.rowIndex, focusedCell.colIndex);
  }, [focusedCell, focusCellElement]);

  const handleCellBlur = useCallback(
    (rowId: string, propertyId: string, newValue: Record<string, unknown>) => {
      onCellUpdate?.(rowId, propertyId, newValue);
      stopEditing();
    },
    [onCellUpdate, stopEditing],
  );

  const handleCellFocus = useCallback(
    (rowIndex: number, colIndex: number) => {
      setFocusedCell({ rowIndex, colIndex });
    },
    [],
  );

  return {
    editingCell,
    focusedCell,
    gridRef,
    startEditing,
    handleCellKeyDown,
    handleFocusedCellKeyDown,
    handleCellBlur,
    handleCellFocus,
  };
}
