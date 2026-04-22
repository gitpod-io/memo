"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { ImageIcon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseViewConfig,
} from "@/lib/types";

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
  /** Loading state — shows skeleton. */
  loading?: boolean;
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

export function GalleryView({
  rows,
  viewConfig,
  workspaceSlug,
  onAddRow,
  loading = false,
}: GalleryViewProps) {
  const cardSize = viewConfig.card_size ?? "medium";
  const cardSizeClass = CARD_SIZE_CLASS[cardSize];
  const coverPropertyId = viewConfig.cover_property ?? null;

  const handleAddRow = useCallback(() => {
    onAddRow?.();
  }, [onAddRow]);

  if (loading) {
    return <GallerySkeleton cardSizeClass={cardSizeClass} />;
  }

  if (rows.length === 0 && !onAddRow) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No pages in this gallery
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {rows.map((row) => (
        <GalleryCard
          key={row.page.id}
          row={row}
          coverPropertyId={coverPropertyId}
          cardSizeClass={cardSizeClass}
          workspaceSlug={workspaceSlug}
        />
      ))}
      {onAddRow && (
        <button
          type="button"
          onClick={handleAddRow}
          className={cn(
            "flex items-center justify-center border border-dashed border-white/[0.12] bg-muted/50",
            "text-muted-foreground hover:border-white/[0.2] hover:text-foreground",
            "transition-colors",
            cardSizeClass,
          )}
        >
          <Plus className="h-5 w-5" />
        </button>
      )}
      {rows.length === 0 && onAddRow && (
        <div className="col-span-full flex h-32 items-center justify-center text-sm text-muted-foreground">
          No pages yet — click + to add one
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GalleryCard
// ---------------------------------------------------------------------------

interface GalleryCardProps {
  row: DatabaseRow;
  coverPropertyId: string | null;
  cardSizeClass: string;
  workspaceSlug: string;
}

function GalleryCard({
  row,
  coverPropertyId,
  cardSizeClass,
  workspaceSlug,
}: GalleryCardProps) {
  const title = row.page.title || "Untitled";
  const coverUrl = useMemo(
    () => getCoverUrl(row, coverPropertyId),
    [row, coverPropertyId],
  );

  return (
    <Link
      href={`/${workspaceSlug}/${row.page.id}`}
      className={cn(
        "group/card flex flex-col overflow-hidden border border-white/[0.06] bg-muted",
        cardSizeClass,
      )}
    >
      {/* Cover area */}
      <div className="relative flex-1">
        {coverUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
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
            "flex flex-col overflow-hidden border border-white/[0.06] bg-muted",
            cardSizeClass,
          )}
        >
          <div className="flex-1 animate-pulse bg-white/[0.04]" />
          <div className="p-3">
            <div className="h-4 w-3/4 animate-pulse bg-white/[0.06]" />
          </div>
        </div>
      ))}
    </div>
  );
}
