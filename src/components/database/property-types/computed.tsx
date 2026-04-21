"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RendererProps } from "./index";

// ---------------------------------------------------------------------------
// Timestamp formatting — relative for recent, absolute for older
// ---------------------------------------------------------------------------

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

function formatTimestamp(iso: string): { label: string; full: string } {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return { label: iso, full: iso };

  const full = date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const diff = Date.now() - date.getTime();

  if (diff < MINUTE) return { label: "Just now", full };
  if (diff < HOUR) {
    const mins = Math.floor(diff / MINUTE);
    return { label: `${mins}m ago`, full };
  }
  if (diff < DAY) {
    const hrs = Math.floor(diff / HOUR);
    return { label: `${hrs}h ago`, full };
  }
  if (diff < 7 * DAY) {
    const days = Math.floor(diff / DAY);
    return { label: `${days}d ago`, full };
  }

  const label = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return { label, full };
}

// ---------------------------------------------------------------------------
// CreatedTimeRenderer
// ---------------------------------------------------------------------------

export function CreatedTimeRenderer({ value }: RendererProps) {
  const iso = typeof value.created_at === "string" ? value.created_at : "";
  if (!iso) return null;

  const { label, full } = formatTimestamp(iso);

  return (
    <Tooltip>
      <TooltipTrigger className="truncate text-sm text-muted-foreground">
        {label}
      </TooltipTrigger>
      <TooltipContent>{full}</TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// UpdatedTimeRenderer
// ---------------------------------------------------------------------------

export function UpdatedTimeRenderer({ value }: RendererProps) {
  const iso = typeof value.updated_at === "string" ? value.updated_at : "";
  if (!iso) return null;

  const { label, full } = formatTimestamp(iso);

  return (
    <Tooltip>
      <TooltipTrigger className="truncate text-sm text-muted-foreground">
        {label}
      </TooltipTrigger>
      <TooltipContent>{full}</TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// CreatedByRenderer
// ---------------------------------------------------------------------------

interface CreatorInfo {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (
    (parts[0][0]?.toUpperCase() ?? "") +
    (parts[parts.length - 1][0]?.toUpperCase() ?? "")
  );
}

export function CreatedByRenderer({ value, property }: RendererProps) {
  const userId = typeof value.created_by === "string" ? value.created_by : "";
  if (!userId) return null;

  // Resolve from _members cache on property config (same pattern as PersonRenderer)
  const members = property.config._members as CreatorInfo[] | undefined;
  const creator = members?.find((m) => m.id === userId);

  if (!creator) {
    return (
      <span className="truncate text-sm text-muted-foreground">Unknown</span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger className="flex items-center gap-1.5">
        {creator.avatar_url ? (
          <img
            src={creator.avatar_url}
            alt={creator.display_name}
            width={20}
            height={20}
            className="shrink-0 rounded-full object-cover"
            style={{ width: 20, height: 20 }}
          />
        ) : (
          <span
            className="flex shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground"
            style={{ width: 20, height: 20 }}
          >
            {getInitials(creator.display_name)}
          </span>
        )}
        <span className="truncate text-sm">{creator.display_name}</span>
      </TooltipTrigger>
      <TooltipContent>{creator.display_name}</TooltipContent>
    </Tooltip>
  );
}
