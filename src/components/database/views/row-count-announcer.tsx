"use client";

import { memo, useEffect, useRef, useState } from "react";

export interface RowCountAnnouncerProps {
  /** Number of rows currently displayed (after filtering) */
  filteredCount: number;
  /** Total number of rows (before filtering) */
  totalCount: number;
}

function formatAnnouncement(filtered: number, total: number): string {
  return filtered !== total
    ? `Showing ${filtered} of ${total} rows`
    : `Showing ${total} rows`;
}

/**
 * Screen-reader-only live region that announces row count changes after
 * filter/sort operations. Debounced by 300ms to avoid rapid-fire
 * announcements during typing in filter inputs.
 */
export const RowCountAnnouncer = memo(function RowCountAnnouncer({
  filteredCount,
  totalCount,
}: RowCountAnnouncerProps) {
  const [announcement, setAnnouncement] = useState("");
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the initial render — no need to announce the starting count.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const text = formatAnnouncement(filteredCount, totalCount);
    const timer = setTimeout(() => {
      setAnnouncement(text);
    }, 300);

    return () => clearTimeout(timer);
  }, [filteredCount, totalCount]);

  return (
    <span className="sr-only" aria-live="polite" role="status">
      {announcement}
    </span>
  );
});
