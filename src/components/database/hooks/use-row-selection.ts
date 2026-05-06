import { useCallback, useEffect, useReducer, useRef } from "react";

// ---------------------------------------------------------------------------
// Hook params & return type
// ---------------------------------------------------------------------------

export interface UseRowSelectionParams {
  /** Ordered array of row IDs currently visible in the table. */
  rowIds: string[];
  /** Key that resets selection when it changes (e.g. active view ID). */
  resetKey?: string;
}

export interface UseRowSelectionReturn {
  /** Set of currently selected row IDs. */
  selectedIds: Set<string>;
  /** Whether a specific row is selected. */
  isSelected: (rowId: string) => boolean;
  /** Whether all visible rows are selected. */
  isAllSelected: boolean;
  /** Whether some (but not all) visible rows are selected. */
  isIndeterminate: boolean;
  /** Toggle a single row. When shift is held, selects the range from the last
   *  toggled row to this one. */
  toggle: (rowId: string, shiftKey?: boolean) => void;
  /** Toggle all visible rows (select all / deselect all). */
  toggleAll: () => void;
  /** Clear the entire selection. */
  clear: () => void;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

interface SelectionState {
  ids: Set<string>;
  resetKey: string | undefined;
}

type SelectionAction =
  | { type: "toggle"; rowId: string; shiftKey: boolean; rowIds: string[]; lastIndex: number | null }
  | { type: "toggleAll"; rowIds: string[] }
  | { type: "clear" }
  | { type: "reset"; resetKey: string | undefined }
  | { type: "prune"; visibleIds: Set<string> };

function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case "toggle": {
      const { rowId, shiftKey, rowIds, lastIndex } = action;
      const currentIndex = rowIds.indexOf(rowId);
      if (currentIndex === -1) return state;

      const next = new Set(state.ids);
      if (shiftKey && lastIndex !== null) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        for (let i = start; i <= end; i++) {
          next.add(rowIds[i]);
        }
      } else if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return { ...state, ids: next };
    }
    case "toggleAll": {
      if (state.ids.size === action.rowIds.length) {
        return { ...state, ids: new Set() };
      }
      return { ...state, ids: new Set(action.rowIds) };
    }
    case "clear":
      return state.ids.size === 0 ? state : { ...state, ids: new Set() };
    case "reset":
      return { ids: new Set(), resetKey: action.resetKey };
    case "prune": {
      const { visibleIds } = action;
      let changed = false;
      const next = new Set<string>();
      for (const id of state.ids) {
        if (visibleIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? { ...state, ids: next } : state;
    }
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRowSelection({
  rowIds,
  resetKey,
}: UseRowSelectionParams): UseRowSelectionReturn {
  const [state, dispatch] = useReducer(selectionReducer, {
    ids: new Set<string>(),
    resetKey,
  });

  // Track the last toggled row index for shift+click range selection
  const lastToggledIndex = useRef<number | null>(null);

  // Reset selection when the reset key changes
  useEffect(() => {
    dispatch({ type: "reset", resetKey });
    lastToggledIndex.current = null;
  }, [resetKey]);

  // Prune selection when visible rows change (filtering)
  useEffect(() => {
    dispatch({ type: "prune", visibleIds: new Set(rowIds) });
  }, [rowIds]);

  // Escape key clears selection
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        dispatch({ type: "clear" });
        lastToggledIndex.current = null;
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const selectedIds = state.ids;

  const isSelected = useCallback(
    (rowId: string) => selectedIds.has(rowId),
    [selectedIds],
  );

  const isAllSelected = rowIds.length > 0 && selectedIds.size === rowIds.length;
  const isIndeterminate =
    selectedIds.size > 0 && selectedIds.size < rowIds.length;

  const toggle = useCallback(
    (rowId: string, shiftKey = false) => {
      dispatch({
        type: "toggle",
        rowId,
        shiftKey,
        rowIds,
        lastIndex: lastToggledIndex.current,
      });
      const currentIndex = rowIds.indexOf(rowId);
      if (currentIndex !== -1) {
        lastToggledIndex.current = currentIndex;
      }
    },
    [rowIds],
  );

  const toggleAll = useCallback(() => {
    dispatch({ type: "toggleAll", rowIds });
    lastToggledIndex.current = null;
  }, [rowIds]);

  const clear = useCallback(() => {
    dispatch({ type: "clear" });
    lastToggledIndex.current = null;
  }, []);

  return {
    selectedIds,
    isSelected,
    isAllSelected,
    isIndeterminate,
    toggle,
    toggleAll,
    clear,
  };
}
