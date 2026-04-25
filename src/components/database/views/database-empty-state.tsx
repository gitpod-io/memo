import { memo } from "react";
import { FilterX, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DatabaseEmptyStateProps {
  /** Whether filters are currently active on the view */
  hasActiveFilters: boolean;
  /** Callback to clear all active filters */
  onClearFilters?: () => void;
  /** Callback to add a new row — renders the CTA button when provided */
  onAddRow?: () => void;
}

/**
 * Shared empty state for all database view types.
 * Shows a filter-aware message when filters are active and no rows match,
 * or the default "No rows yet" message when the database is genuinely empty.
 */
export const DatabaseEmptyState = memo(function DatabaseEmptyState({
  hasActiveFilters,
  onClearFilters,
  onAddRow,
}: DatabaseEmptyStateProps) {
  if (hasActiveFilters) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-center"
        data-testid="db-empty-state-filtered"
      >
        <FilterX className="mb-3 h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">
          No rows match the active filters
        </p>
        {onClearFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={onClearFilters}
            data-testid="db-clear-filters-button"
          >
            Clear filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center py-12 text-center"
      data-testid="db-empty-state-no-rows"
    >
      <Table2 className="mb-3 h-12 w-12 text-muted-foreground" />
      <p className="text-lg font-medium">No rows yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Add your first row to get started.
      </p>
      {onAddRow && (
        <Button
          className="mt-3"
          onClick={onAddRow}
          data-testid="db-empty-state-add-row"
        >
          Add a row
        </Button>
      )}
    </div>
  );
});
