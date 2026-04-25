"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// useListKeyboardNavigation — manages focused row state and keyboard
// navigation for the list view.
//
// Arrow Up/Down moves between rows. Enter opens the focused row's page.
// Home/End jump to the first/last row. Escape clears focus.
//
// Follows the same container-level `onKeyDown` pattern as the board and
// gallery keyboard hooks — no global `document.addEventListener`.
//
// Navigation is delegated to an `onNavigate` callback so the hook stays
// framework-agnostic and works in Storybook (no Next.js router required).
// ---------------------------------------------------------------------------

interface UseListKeyboardNavigationParams {
  /** Total number of rows. */
  rowCount: number;
  workspaceSlug: string;
  /** Page IDs in display order, used for Enter navigation. */
  pageIds: string[];
  /** Called when Enter is pressed on a focused row. Receives the target URL path. */
  onNavigate?: (path: string) => void;
}

export function useListKeyboardNavigation({
  rowCount,
  workspaceSlug,
  pageIds,
  onNavigate,
}: UseListKeyboardNavigationParams) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus the DOM element for the given index.
  const focusRowElement = useCallback((index: number) => {
    if (!containerRef.current) return;
    const selector = `[data-list-index="${index}"]`;
    const el = containerRef.current.querySelector<HTMLElement>(selector);
    if (el) {
      el.focus();
    }
  }, []);

  // Navigate to a row by index. Clamps to valid boundaries.
  const navigateToRow = useCallback(
    (index: number) => {
      if (index < 0 || index >= rowCount) return;
      setFocusedIndex(index);
    },
    [rowCount],
  );

  // Handle keyboard events on the list container.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (focusedIndex === null) return;

      switch (e.key) {
        case "ArrowUp": {
          e.preventDefault();
          if (focusedIndex > 0) {
            navigateToRow(focusedIndex - 1);
          }
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          if (focusedIndex < rowCount - 1) {
            navigateToRow(focusedIndex + 1);
          }
          break;
        }
        case "Home": {
          e.preventDefault();
          navigateToRow(0);
          break;
        }
        case "End": {
          e.preventDefault();
          if (rowCount > 0) {
            navigateToRow(rowCount - 1);
          }
          break;
        }
        case "Enter": {
          e.preventDefault();
          const pageId = pageIds[focusedIndex];
          if (pageId) {
            onNavigate?.(`/${workspaceSlug}/${pageId}`);
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
    [focusedIndex, rowCount, navigateToRow, pageIds, workspaceSlug, onNavigate],
  );

  // When a row is clicked/focused via mouse, track it.
  const handleRowFocus = useCallback((index: number) => {
    setFocusedIndex(index);
  }, []);

  // Sync DOM focus when focusedIndex changes.
  useEffect(() => {
    if (focusedIndex === null) return;
    focusRowElement(focusedIndex);
  }, [focusedIndex, focusRowElement]);

  return {
    focusedIndex,
    containerRef,
    handleKeyDown,
    handleRowFocus,
  };
}
