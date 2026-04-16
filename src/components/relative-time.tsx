"use client";

import { useEffect, useReducer } from "react";

interface RelativeTimeProps {
  dateStr: string;
  className?: string;
}

/**
 * Renders a relative time string (e.g. "5m ago") with suppressHydrationWarning
 * to avoid React hydration mismatches. The server and client may compute
 * slightly different values because time advances between SSR and hydration.
 * The interval keeps the display current after mount.
 */
export function RelativeTime({ dateStr, className }: RelativeTimeProps) {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const interval = setInterval(forceUpdate, 60_000);
    return () => clearInterval(interval);
  }, [dateStr]);

  return (
    <span className={className} suppressHydrationWarning>
      {formatRelativeDate(dateStr)}
    </span>
  );
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
