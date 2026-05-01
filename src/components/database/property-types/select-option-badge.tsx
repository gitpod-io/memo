"use client";

import { cn } from "@/lib/utils";
import {
  SELECT_COLOR_STYLES,
  type SelectOptionColor,
} from "./index";

interface SelectOptionBadgeProps {
  name: string;
  color: string;
  className?: string;
}

export function SelectOptionBadge({
  name,
  color,
  className,
}: SelectOptionBadgeProps) {
  const colorKey = color as SelectOptionColor;
  const styles = SELECT_COLOR_STYLES[colorKey] ?? SELECT_COLOR_STYLES.gray;

  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center px-1.5 text-xs font-medium",
        styles.bg,
        styles.text,
        className,
      )}
      data-testid="db-select-option-badge"
    >
      {name}
    </span>
  );
}
