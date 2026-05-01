import { memo } from "react";

export interface RowCountStatusBarProps {
  /** Number of rows currently displayed (after filtering) */
  filteredCount: number;
  /** Total number of rows (before filtering) */
  totalCount: number;
}

export const RowCountStatusBar = memo(function RowCountStatusBar({
  filteredCount,
  totalCount,
}: RowCountStatusBarProps) {
  const isFiltered = filteredCount !== totalCount;

  return (
    <div className="px-2 py-1.5 text-xs text-muted-foreground" data-testid="db-row-count-status-bar">
      {isFiltered
        ? `${filteredCount} of ${totalCount} rows`
        : `${totalCount} rows`}
    </div>
  );
});
