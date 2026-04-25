import { memo } from "react";
import { FileText, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DatabaseEmptyStateProps {
  /** Whether filters are currently active on the view */
  hasActiveFilters: boolean;
  /** Callback to clear all active filters */
  onClearFilters?: () => void;
}

/**
 * Shared empty state for all database view types.
 * Shows a filter-aware message when filters are active and no rows match,
 * or the default "No rows yet" message when the database is genuinely empty.
 */
export const DatabaseEmptyState = memo(function DatabaseEmptyState({
  hasActiveFilters,
  onClearFilters,
}: DatabaseEmptyStateProps) {
  if (hasActiveFilters) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-center"
        data-testid="db-empty-state-filtered"
      >
        <FilterX className="mb-3 h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
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
      <FileText className="mb-3 h-10 w-10 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">No rows yet</p>
      <p className="mt-1 text-xs text-muted-foreground/60">
        Click &quot;+ New&quot; below to add a row
      </p>
    </div>
  );
});
