import { memo } from "react";

export interface PageCountStatusBarProps {
  /** Number of pages currently displayed (after filtering) */
  filteredCount: number;
  /** Total number of pages (before filtering) */
  totalCount: number;
}

export const PageCountStatusBar = memo(function PageCountStatusBar({
  filteredCount,
  totalCount,
}: PageCountStatusBarProps) {
  const isFiltered = filteredCount !== totalCount;

  return (
    <div
      className="px-2 py-1.5 text-xs text-muted-foreground"
      data-testid="wh-page-count-status-bar"
    >
      {isFiltered
        ? `${filteredCount} of ${totalCount} pages`
        : `${totalCount} pages`}
    </div>
  );
});
