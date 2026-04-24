"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Check } from "lucide-react";
import type { DatabaseProperty, DatabaseViewType } from "@/lib/types";

// ---------------------------------------------------------------------------
// ViewConfigDropdown — toolbar dropdown for selecting a property (group_by, date_property)
// ---------------------------------------------------------------------------

export interface ViewConfigDropdownProps {
  label: string;
  selectedId: string | null;
  options: DatabaseProperty[];
  onSelect: (propertyId: string) => void;
}

export function ViewConfigDropdown({
  label,
  selectedId,
  options,
  onSelect,
}: ViewConfigDropdownProps) {
  const selectedName = options.find((p) => p.id === selectedId)?.name;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-overlay-border hover:text-foreground"
        data-testid={`view-config-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {label}: {selectedName ?? "None"}
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No matching properties
          </div>
        ) : (
          options.map((prop) => (
            <DropdownMenuItem
              key={prop.id}
              onClick={() => onSelect(prop.id)}
              className="gap-2 text-xs"
            >
              {prop.id === selectedId && <Check className="size-3" />}
              {prop.id !== selectedId && <span className="size-3" />}
              {prop.name}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Coming Soon placeholder for non-table view types
// ---------------------------------------------------------------------------

export function ComingSoonPlaceholder({ viewType }: { viewType: DatabaseViewType }) {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
      {viewType.charAt(0).toUpperCase() + viewType.slice(1)} view coming soon
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

export function DatabaseSkeleton() {
  return (
    <div className="space-y-3">
      {/* View tabs skeleton */}
      <div className="flex items-center gap-2 border-b border-overlay-border pb-2">
        <div className="h-5 w-20 animate-pulse bg-muted" />
        <div className="h-5 w-20 animate-pulse bg-muted" />
        <div className="h-5 w-20 animate-pulse bg-muted" />
      </div>
      {/* Table skeleton */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="h-8 w-1/4 animate-pulse bg-muted" />
          <div className="h-8 w-1/4 animate-pulse bg-muted" />
          <div className="h-8 w-1/4 animate-pulse bg-muted" />
          <div className="h-8 w-1/4 animate-pulse bg-muted" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <div className="h-10 w-1/4 animate-pulse bg-muted" />
            <div className="h-10 w-1/4 animate-pulse bg-muted" />
            <div className="h-10 w-1/4 animate-pulse bg-muted" />
            <div className="h-10 w-1/4 animate-pulse bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
