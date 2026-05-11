import { useCallback, useMemo } from "react";
import { toast } from "@/lib/toast";
import {
  sortRows,
  filterRows,
  type SortRule,
  type FilterRule,
} from "@/lib/database-filters";
import { updateView } from "@/lib/database";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
} from "@/lib/sentry";
import { retryOnNetworkError } from "@/lib/retry";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseView,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Hook params & return type
// ---------------------------------------------------------------------------

export interface UseDatabaseFiltersParams {
  pageId: string;
  activeView: DatabaseView | undefined;
  rows: DatabaseRow[];
  properties: DatabaseProperty[];
  setViews: React.Dispatch<React.SetStateAction<DatabaseView[]>>;
}

export interface UseDatabaseFiltersReturn {
  activeSorts: SortRule[];
  activeFilters: FilterRule[];
  displayedRows: DatabaseRow[];
  handleSortsChange: (newSorts: SortRule[]) => Promise<void>;
  handleFiltersChange: (newFilters: FilterRule[]) => Promise<void>;
  handleSortToggle: (propertyId: string) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDatabaseFilters({
  pageId,
  activeView,
  rows,
  properties,
  setViews,
}: UseDatabaseFiltersParams): UseDatabaseFiltersReturn {
  const activeSorts: SortRule[] = useMemo(
    () => (activeView?.config.sorts as SortRule[] | undefined) ?? [],
    [activeView],
  );

  const activeFilters: FilterRule[] = useMemo(
    () => (activeView?.config.filters as FilterRule[] | undefined) ?? [],
    [activeView],
  );

  // Apply sort and filter to produce the displayed rows
  const displayedRows = useMemo(() => {
    let result = rows;
    if (activeFilters.length > 0) {
      result = filterRows(result, activeFilters, properties);
    }
    if (activeSorts.length > 0) {
      result = sortRows(result, activeSorts, properties);
    }
    return result;
  }, [rows, activeSorts, activeFilters, properties]);

  const handleSortsChange = useCallback(
    async (newSorts: SortRule[]) => {
      if (!activeView) return;
      const newConfig = { ...activeView.config, sorts: newSorts };
      // Optimistic update
      setViews((prev) =>
        prev.map((v) =>
          v.id === activeView.id ? { ...v, config: newConfig } : v,
        ),
      );
      const { error } = await retryOnNetworkError(() =>
        updateView(activeView.id, { config: newConfig }, pageId),
      );
      if (error) {
        if (!isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "database-filters:update-sort");
        }
        toast.error("Failed to update sort", { duration: 8000 });
      }
    },
    [activeView, pageId, setViews],
  );

  const handleFiltersChange = useCallback(
    async (newFilters: FilterRule[]) => {
      if (!activeView) return;
      const newConfig = { ...activeView.config, filters: newFilters };
      // Optimistic update
      setViews((prev) =>
        prev.map((v) =>
          v.id === activeView.id ? { ...v, config: newConfig } : v,
        ),
      );
      const { error } = await retryOnNetworkError(() =>
        updateView(activeView.id, { config: newConfig }, pageId),
      );
      if (error) {
        if (!isInsufficientPrivilegeError(error)) {
          captureSupabaseError(error, "database-filters:update-filter");
        }
        toast.error("Failed to update filter", { duration: 8000 });
      }
    },
    [activeView, pageId, setViews],
  );

  // Column header sort toggle: cycles unsorted → asc → desc → unsorted
  const handleSortToggle = useCallback(
    (propertyId: string) => {
      const existing = activeSorts.find((s) => s.property_id === propertyId);
      let newSorts: SortRule[];
      if (!existing) {
        newSorts = [...activeSorts, { property_id: propertyId, direction: "asc" }];
      } else if (existing.direction === "asc") {
        newSorts = activeSorts.map((s) =>
          s.property_id === propertyId ? { ...s, direction: "desc" as const } : s,
        );
      } else {
        newSorts = activeSorts.filter((s) => s.property_id !== propertyId);
      }
      void handleSortsChange(newSorts);
    },
    [activeSorts, handleSortsChange],
  );

  return {
    activeSorts,
    activeFilters,
    displayedRows,
    handleSortsChange,
    handleFiltersChange,
    handleSortToggle,
  };
}
