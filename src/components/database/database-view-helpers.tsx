"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Check, Rows3, LayoutGrid, ImageIcon } from "lucide-react";
import type { DatabaseProperty, DatabaseViewConfig, DatabaseViewType } from "@/lib/types";

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
// RowHeightToggle — toolbar dropdown for selecting table row density
// ---------------------------------------------------------------------------

const ROW_HEIGHT_OPTIONS: {
  value: NonNullable<DatabaseViewConfig["row_height"]>;
  label: string;
}[] = [
  { value: "compact", label: "Compact" },
  { value: "default", label: "Default" },
  { value: "tall", label: "Tall" },
];

export interface RowHeightToggleProps {
  value: NonNullable<DatabaseViewConfig["row_height"]>;
  onChange: (height: NonNullable<DatabaseViewConfig["row_height"]>) => void;
}

export function RowHeightToggle({ value, onChange }: RowHeightToggleProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-overlay-border hover:text-foreground"
        data-testid="row-height-toggle"
        aria-label="Row height"
      >
        <Rows3 className="size-3.5" />
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {ROW_HEIGHT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className="gap-2 text-xs"
            data-testid={`row-height-option-${option.value}`}
          >
            {option.value === value ? (
              <Check className="size-3" />
            ) : (
              <span className="size-3" />
            )}
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// GalleryCardSizeDropdown — toolbar dropdown for selecting gallery card size
// ---------------------------------------------------------------------------

const CARD_SIZE_OPTIONS: { value: NonNullable<DatabaseViewConfig["card_size"]>; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

export interface GalleryCardSizeDropdownProps {
  cardSize: NonNullable<DatabaseViewConfig["card_size"]>;
  onCardSizeChange: (size: NonNullable<DatabaseViewConfig["card_size"]>) => void;
}

export function GalleryCardSizeDropdown({
  cardSize,
  onCardSizeChange,
}: GalleryCardSizeDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-overlay-border hover:text-foreground"
        data-testid="gallery-card-size"
      >
        <LayoutGrid className="size-3.5" />
        Card size
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={cardSize}
          onValueChange={(value) =>
            onCardSizeChange(value as NonNullable<DatabaseViewConfig["card_size"]>)
          }
        >
          {CARD_SIZE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              closeOnClick
              className="text-xs"
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// GalleryCoverDropdown — toolbar dropdown for selecting gallery cover property
// ---------------------------------------------------------------------------

export interface GalleryCoverDropdownProps {
  selectedId: string | null;
  options: DatabaseProperty[];
  onSelect: (propertyId: string | null) => void;
}

export function GalleryCoverDropdown({
  selectedId,
  options,
  onSelect,
}: GalleryCoverDropdownProps) {
  const selectedName = options.find((p) => p.id === selectedId)?.name;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-overlay-border hover:text-foreground"
        data-testid="gallery-cover-property"
      >
        <ImageIcon className="size-3.5" />
        Cover: {selectedName ?? "None"}
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={() => onSelect(null)}
          className="gap-2 text-xs"
        >
          {selectedId === null ? <Check className="size-3" /> : <span className="size-3" />}
          None
        </DropdownMenuItem>
        {options.map((prop) => (
          <DropdownMenuItem
            key={prop.id}
            onClick={() => onSelect(prop.id)}
            className="gap-2 text-xs"
          >
            {prop.id === selectedId ? <Check className="size-3" /> : <span className="size-3" />}
            {prop.name}
          </DropdownMenuItem>
        ))}
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
