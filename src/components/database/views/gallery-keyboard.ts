"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// useGalleryKeyboardNavigation — manages focused card state and keyboard
// navigation for the gallery view.
//
// Cards are in a CSS grid with responsive column counts. The hook reads the
// actual computed grid column count from the DOM to determine row/column
// positions for ↑/↓ navigation. ←/→ move between adjacent cards in flat
// order. Enter opens the focused card's page. Escape clears focus.
//
// Follows the same container-level `onKeyDown` pattern as the table view
// (useTableCellNavigation) — no global `document.addEventListener`.
// ---------------------------------------------------------------------------

interface UseGalleryKeyboardNavigationParams {
  /** Total number of cards (rows.length). */
  cardCount: number;
  workspaceSlug: string;
  /** Page IDs in display order, used for Enter navigation. */
  pageIds: string[];
}

export function useGalleryKeyboardNavigation({
  cardCount,
  workspaceSlug,
  pageIds,
}: UseGalleryKeyboardNavigationParams) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Compute the number of columns from the rendered grid.
  const getColumnCount = useCallback((): number => {
    if (!containerRef.current) return 1;
    const style = getComputedStyle(containerRef.current);
    const templateColumns = style.gridTemplateColumns;
    if (!templateColumns || templateColumns === "none") return 1;
    // gridTemplateColumns returns space-separated pixel values like "200px 200px 200px"
    return templateColumns.split(/\s+/).length;
  }, []);

  // Focus the DOM element for the given flat index.
  const focusCardElement = useCallback((index: number) => {
    if (!containerRef.current) return;
    const selector = `[data-gallery-index="${index}"]`;
    const el = containerRef.current.querySelector<HTMLElement>(selector);
    if (el) {
      el.focus();
    }
  }, []);

  // Navigate to a card by flat index.
  const navigateToCard = useCallback(
    (index: number) => {
      if (index < 0 || index >= cardCount) return;
      setFocusedIndex(index);
    },
    [cardCount],
  );

  // Handle keyboard events on the gallery container.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (focusedIndex === null) return;

      const cols = getColumnCount();

      switch (e.key) {
        case "ArrowLeft": {
          e.preventDefault();
          if (focusedIndex > 0) {
            navigateToCard(focusedIndex - 1);
          }
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (focusedIndex < cardCount - 1) {
            navigateToCard(focusedIndex + 1);
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const targetUp = focusedIndex - cols;
          if (targetUp >= 0) {
            navigateToCard(targetUp);
          }
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          const targetDown = focusedIndex + cols;
          if (targetDown < cardCount) {
            navigateToCard(targetDown);
          }
          break;
        }
        case "Enter": {
          e.preventDefault();
          const pageId = pageIds[focusedIndex];
          if (pageId) {
            router.push(`/${workspaceSlug}/${pageId}`);
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          setFocusedIndex(null);
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          break;
        }
        default:
          break;
      }
    },
    [focusedIndex, cardCount, getColumnCount, navigateToCard, pageIds, workspaceSlug, router],
  );

  // When a card is clicked/focused via mouse, track it.
  const handleCardFocus = useCallback((index: number) => {
    setFocusedIndex(index);
  }, []);

  // Sync DOM focus when focusedIndex changes.
  useEffect(() => {
    if (focusedIndex === null) return;
    focusCardElement(focusedIndex);
  }, [focusedIndex, focusCardElement]);

  return {
    focusedIndex,
    containerRef,
    handleKeyDown,
    handleCardFocus,
  };
}
