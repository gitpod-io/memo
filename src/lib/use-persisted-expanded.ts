"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY_PREFIX = "memo:tree-expanded:";
const DEBOUNCE_MS = 300;

function readFromStorage(workspaceId: string): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + workspaceId);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((v): v is string => typeof v === "string"));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

function writeToStorage(workspaceId: string, ids: Set<string>): void {
  try {
    localStorage.setItem(
      STORAGE_KEY_PREFIX + workspaceId,
      JSON.stringify([...ids]),
    );
  } catch {
    // Private browsing or quota exceeded — silently ignore
  }
}

/**
 * Manages expand/collapse state for a page tree, persisted to localStorage
 * per workspace. Returns the same API shape as useState<Set<string>>.
 *
 * - Initializes from localStorage when workspaceId becomes available (no flicker).
 * - Debounces writes to localStorage on state changes.
 * - Provides a helper to remove deleted page IDs from persisted state.
 */
export function usePersistedExpanded(workspaceId: string | null) {
  const [expanded, setExpandedRaw] = useState<Set<string>>(() => {
    if (!workspaceId) return new Set<string>();
    return readFromStorage(workspaceId);
  });

  // Track previous workspaceId to detect workspace switches during render.
  const [prevWorkspaceId, setPrevWorkspaceId] = useState(workspaceId);

  // When workspaceId changes, reload from storage. Uses the "setState during
  // render" pattern recommended by React to avoid cascading effects.
  if (workspaceId !== prevWorkspaceId) {
    setPrevWorkspaceId(workspaceId);
    const restored = workspaceId
      ? readFromStorage(workspaceId)
      : new Set<string>();
    setExpandedRaw(restored);
  }

  // Debounced persist whenever expanded changes.
  useEffect(() => {
    if (!workspaceId) return;

    const timer = setTimeout(() => {
      writeToStorage(workspaceId, expanded);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [expanded, workspaceId]);

  // Stable setter that accepts a value or updater function.
  const setExpanded = useCallback(
    (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setExpandedRaw((prev) =>
        typeof updater === "function" ? updater(prev) : updater,
      );
    },
    [],
  );

  // Remove a set of page IDs from persisted state (call after delete).
  const removeFromPersisted = useCallback(
    (idsToRemove: Set<string>) => {
      setExpandedRaw((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const id of idsToRemove) {
          if (next.delete(id)) changed = true;
        }
        return changed ? next : prev;
      });
    },
    [],
  );

  return { expanded, setExpanded, removeFromPersisted };
}
