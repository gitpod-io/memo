"use client";

import { memo, useEffect, useRef, useState } from "react";

export interface PageCountAnnouncerProps {
  /** Number of pages currently displayed (after filtering) */
  filteredCount: number;
  /** Total number of pages (before filtering) */
  totalCount: number;
}

function formatAnnouncement(filtered: number, total: number): string {
  return filtered !== total
    ? `Showing ${filtered} of ${total} pages`
    : `Showing ${total} pages`;
}

/**
 * Screen-reader-only live region that announces page count changes after
 * filter operations. Debounced by 300ms to avoid rapid-fire announcements
 * during typing in the filter input.
 */
export const PageCountAnnouncer = memo(function PageCountAnnouncer({
  filteredCount,
  totalCount,
}: PageCountAnnouncerProps) {
  const [announcement, setAnnouncement] = useState("");
  const isFirstRender = useRef(true);

  useEffect(() => {
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
    <span
      className="sr-only"
      aria-live="polite"
      role="status"
      data-testid="wh-page-count-announcer"
    >
      {announcement}
    </span>
  );
});
