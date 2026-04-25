"use client";

import { memo, useCallback, useMemo } from "react";
import Link from "next/link";
import { ImageIcon, Plus } from "lucide-react";
import { DatabaseEmptyState } from "@/components/database/views/database-empty-state";
import { cn } from "@/lib/utils";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseViewConfig,
} from "@/lib/types";
import { useGalleryKeyboardNavigation } from "./gallery-keyboard";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CARD_SIZE_CLASS: Record<NonNullable<DatabaseViewConfig["card_size"]>, string> = {
  small: "h-40",
  medium: "h-52",
  large: "h-64",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GalleryViewProps {
  rows: DatabaseRow[];
  properties: DatabaseProperty[];
  viewConfig: DatabaseViewConfig;
  workspaceSlug: string;
  /** Called when a new row should be added. */
  onAddRow?: () => void;
  /** Called when keyboard Enter navigates to a card. Receives the URL path. */
  onNavigate?: (path: string) => void;
  /** Loading state — shows skeleton. */
  loading?: boolean;
  /** Whether filters are currently active on the view */
  hasActiveFilters?: boolean;
  /** Callback to clear all active filters */
  onClearFilters?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the first image URL for a row's cover.
 * If `cover_property` is set in the view config, look for the first image URL
 * in that files property's value. Otherwise, fall back to `page.cover_url`.
 */
function getCoverUrl(
  row: DatabaseRow,
  coverPropertyId: string | null | undefined,
): string | null {
  if (coverPropertyId) {
    const rv = row.values[coverPropertyId];
    if (rv?.value) {
      // Files property stores an array of file objects with url field
      const files = rv.value.files;
      if (Array.isArray(files) && files.length > 0) {
        // rv.value is Record<string, unknown> — cast to access url, guarded by typeof check below
        const first = files[0] as { url?: string };
        if (typeof first.url === "string") return first.url;
      }
      // Also check for a direct url field
      if (typeof rv.value.url === "string") return rv.value.url;
    }
  }
  return row.page.cover_url ?? null;
}

// ---------------------------------------------------------------------------
// GalleryView
// ---------------------------------------------------------------------------

export const GalleryView = memo(function GalleryView({
  rows,
  viewConfig,
  workspaceSlug,
  onAddRow,
  onNavigate,
  loading = false,
  hasActiveFilters = false,
  onClearFilters,
}: GalleryViewProps) {
  const cardSize = viewConfig.card_size ?? "medium";
  const cardSizeClass = CARD_SIZE_CLASS[cardSize];
  const coverPropertyId = viewConfig.cover_property ?? null;

  const pageIds = useMemo(() => rows.map((r) => r.page.id), [rows]);

  const { focusedIndex, containerRef, handleKeyDown, handleCardFocus } =
    useGalleryKeyboardNavigation({
      cardCount: rows.length,
      workspaceSlug,
      pageIds,
      onNavigate,
    });

  const handleAddRow = useCallback(() => {
    onAddRow?.();
  }, [onAddRow]);

  if (loading) {
    return <GallerySkeleton cardSizeClass={cardSizeClass} />;
  }

  if (rows.length === 0 && hasActiveFilters) {
    return (
      <DatabaseEmptyState
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
      />
    );
  }

  if (rows.length === 0 && !onAddRow) {
    return (
      <DatabaseEmptyState
        hasActiveFilters={false}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
      role="list"
      aria-label="Database gallery"
      data-testid="db-gallery-container"
      onKeyDown={handleKeyDown}
    >
      {rows.map((row, index) => (
        <GalleryCard
          key={row.page.id}
          row={row}
          index={index}
          coverPropertyId={coverPropertyId}
          cardSizeClass={cardSizeClass}
          workspaceSlug={workspaceSlug}
          isFocused={focusedIndex === index}
          onCardFocus={handleCardFocus}
        />
      ))}
      {onAddRow && (
        <button
          type="button"
          onClick={handleAddRow}
          aria-label="Add new page"
          className={cn(
            "flex items-center justify-center border border-dashed border-overlay-strong bg-muted/50",
            "text-muted-foreground hover:border-overlay-heavy hover:text-foreground",
            cardSizeClass,
          )}
        >
          <Plus className="h-5 w-5" />
        </button>
      )}
      {rows.length === 0 && onAddRow && (
        <div className="col-span-full">
          <DatabaseEmptyState
            hasActiveFilters={false}
          />
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// GalleryCard
// ---------------------------------------------------------------------------

interface GalleryCardProps {
  row: DatabaseRow;
  index: number;
  coverPropertyId: string | null;
  cardSizeClass: string;
  workspaceSlug: string;
  isFocused: boolean;
  onCardFocus: (index: number) => void;
}

function GalleryCard({
  row,
  index,
  coverPropertyId,
  cardSizeClass,
  workspaceSlug,
  isFocused,
  onCardFocus,
}: GalleryCardProps) {
  const title = row.page.title || "Untitled";
  const coverUrl = useMemo(
    () => getCoverUrl(row, coverPropertyId),
    [row, coverPropertyId],
  );

  const handleFocus = useCallback(() => {
    onCardFocus(index);
  }, [onCardFocus, index]);

  return (
    <Link
      href={`/${workspaceSlug}/${row.page.id}`}
      tabIndex={0}
      role="listitem"
      aria-label={title}
      data-testid={`db-gallery-card-${row.page.id}`}
      data-gallery-index={index}
      onFocus={handleFocus}
      className={cn(
        "group/card flex flex-col overflow-hidden border border-overlay-border bg-muted",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        isFocused && "ring-2 ring-ring ring-offset-2",
        cardSizeClass,
      )}
    >
      {/* Cover area */}
      <div className="relative flex-1">
        {coverUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- Cover URLs from arbitrary user domains */
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Title */}
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-medium">{title}</p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// GallerySkeleton
// ---------------------------------------------------------------------------

function GallerySkeleton({ cardSizeClass }: { cardSizeClass: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex flex-col overflow-hidden border border-overlay-border bg-muted",
            cardSizeClass,
          )}
        >
          <div className="flex-1 animate-pulse bg-overlay-hover" />
          <div className="p-3">
            <div className="h-4 w-3/4 animate-pulse bg-overlay-border" />
          </div>
        </div>
      ))}
    </div>
  );
}
