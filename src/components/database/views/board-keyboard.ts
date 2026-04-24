"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnData } from "./board-view-helpers";

// ---------------------------------------------------------------------------
// useBoardKeyboardNavigation — manages focused card state and keyboard
// navigation for the board view.
//
// Arrow keys navigate between cards within a column (↑/↓) and between
// columns (←/→). Enter opens the focused card's page. Escape clears focus.
//
// Follows the same container-level `onKeyDown` pattern as the table view
// (useTableCellNavigation) — no global `document.addEventListener`.
// ---------------------------------------------------------------------------

export interface BoardFocusedCard {
  columnIndex: number;
  cardIndex: number;
}

interface UseBoardKeyboardNavigationParams {
  columns: ColumnData[];
  workspaceSlug: string;
}

export function useBoardKeyboardNavigation({
  columns,
  workspaceSlug,
}: UseBoardKeyboardNavigationParams) {
  const [focusedCard, setFocusedCard] = useState<BoardFocusedCard | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Focus the DOM element for the currently focused card.
  const focusCardElement = useCallback(
    (columnIndex: number, cardIndex: number) => {
      if (!containerRef.current) return;
      const selector = `[data-board-col="${columnIndex}"][data-board-row="${cardIndex}"]`;
      const el = containerRef.current.querySelector<HTMLElement>(selector);
      if (el) {
        el.focus();
      }
    },
    [],
  );

  // Navigate to a card. Clamps to valid boundaries.
  const navigateToCard = useCallback(
    (columnIndex: number, cardIndex: number) => {
      if (columns.length === 0) return;
      if (columnIndex < 0 || columnIndex >= columns.length) return;
      const column = columns[columnIndex];
      if (column.rows.length === 0) return;
      if (cardIndex < 0 || cardIndex >= column.rows.length) return;
      setFocusedCard({ columnIndex, cardIndex });
    },
    [columns],
  );

  // Handle keyboard events on the board container.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!focusedCard) return;
      const { columnIndex, cardIndex } = focusedCard;

      switch (e.key) {
        case "ArrowUp": {
          e.preventDefault();
          if (cardIndex > 0) {
            navigateToCard(columnIndex, cardIndex - 1);
          }
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          const column = columns[columnIndex];
          if (column && cardIndex < column.rows.length - 1) {
            navigateToCard(columnIndex, cardIndex + 1);
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          // Move to the previous column, clamping the card index
          let prevCol = columnIndex - 1;
          while (prevCol >= 0 && columns[prevCol].rows.length === 0) {
            prevCol--;
          }
          if (prevCol >= 0) {
            const clampedCard = Math.min(
              cardIndex,
              columns[prevCol].rows.length - 1,
            );
            navigateToCard(prevCol, clampedCard);
          }
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          // Move to the next column, clamping the card index
          let nextCol = columnIndex + 1;
          while (nextCol < columns.length && columns[nextCol].rows.length === 0) {
            nextCol++;
          }
          if (nextCol < columns.length) {
            const clampedCard = Math.min(
              cardIndex,
              columns[nextCol].rows.length - 1,
            );
            navigateToCard(nextCol, clampedCard);
          }
          break;
        }
        case "Enter": {
          e.preventDefault();
          const column = columns[columnIndex];
          const row = column?.rows[cardIndex];
          if (row) {
            router.push(`/${workspaceSlug}/${row.page.id}`);
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          setFocusedCard(null);
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          break;
        }
        default:
          break;
      }
    },
    [focusedCard, columns, navigateToCard, workspaceSlug, router],
  );

  // When a card is clicked/focused via mouse, track it.
  const handleCardFocus = useCallback(
    (columnIndex: number, cardIndex: number) => {
      setFocusedCard({ columnIndex, cardIndex });
    },
    [],
  );

  // Sync DOM focus when focusedCard changes.
  useEffect(() => {
    if (!focusedCard) return;
    focusCardElement(focusedCard.columnIndex, focusedCard.cardIndex);
  }, [focusedCard, focusCardElement]);

  return {
    focusedCard,
    containerRef,
    handleKeyDown,
    handleCardFocus,
  };
}
