"use client";

import { useMemo } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseViewConfig,
  PropertyType,
  RowValue,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ListViewProps {
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
// ListView
// ---------------------------------------------------------------------------

export function ListView({
  rows,
  properties,
  viewConfig,
  workspaceSlug,
  onAddRow,
  loading = false,
}: ListViewProps) {
  // Visible properties configured for this view
  const visibleProperties = useMemo(() => {
    if (viewConfig.visible_properties && viewConfig.visible_properties.length > 0) {
      const visibleSet = new Set(viewConfig.visible_properties);
      return properties.filter((p) => visibleSet.has(p.id));
    }
    return properties;
  }, [properties, viewConfig.visible_properties]);

  if (loading) {
    return <ListSkeleton />;
  }

  if (rows.length === 0) {
    return (
      <div className="w-full">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No rows yet</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Click &quot;+ New&quot; below to add a row
          </p>
        </div>
        {onAddRow && (
          <button
            type="button"
            onClick={() => onAddRow()}
            className="flex w-full items-center gap-1.5 border-t border-white/[0.06] px-3 py-2 text-sm text-muted-foreground hover:bg-white/[0.04]"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full" role="list" aria-label="Database list">
      {rows.map((row) => (
        <ListRow
          key={row.page.id}
          row={row}
          visibleProperties={visibleProperties}
          workspaceSlug={workspaceSlug}
        />
      ))}

      {onAddRow && (
        <button
          type="button"
          onClick={() => onAddRow()}
          className="flex w-full items-center gap-1.5 border-t border-white/[0.06] px-3 py-2 text-sm text-muted-foreground hover:bg-white/[0.04]"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ListRow
// ---------------------------------------------------------------------------

interface ListRowProps {
  row: DatabaseRow;
  visibleProperties: DatabaseProperty[];
  workspaceSlug: string;
}

function ListRow({ row, visibleProperties, workspaceSlug }: ListRowProps) {
  return (
    <Link
      href={`/${workspaceSlug}/${row.page.id}`}
      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/[0.04]"
      role="listitem"
    >
      {/* Row icon */}
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-base">
        {row.page.icon ? (
          row.page.icon
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
      </span>

      {/* Title */}
      <span className="flex-1 truncate">
        {row.page.title || "Untitled"}
      </span>

      {/* Visible properties */}
      {visibleProperties.length > 0 && (
        <span className="flex shrink-0 items-center gap-3">
          {visibleProperties.map((prop) => {
            const cellValue = row.values[prop.id];
            return (
              <CompactPropertyValue
                key={prop.id}
                value={cellValue}
                propertyType={prop.type}
              />
            );
          })}
        </span>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// CompactPropertyValue — inline compact renderer for list view
// ---------------------------------------------------------------------------

interface CompactPropertyValueProps {
  value: RowValue | undefined;
  propertyType: PropertyType;
}

function CompactPropertyValue({ value, propertyType }: CompactPropertyValueProps) {
  const displayValue = extractDisplayValue(value, propertyType);

  if (!displayValue) {
    return null;
  }

  switch (propertyType) {
    case "select": {
      const color = (value?.value as Record<string, unknown>)?.color as string | undefined;
      return <CompactSelectBadge label={displayValue} color={color} />;
    }

    case "multi_select": {
      const items = (value?.value as Record<string, unknown>)?.items as
        | { value: string; color?: string }[]
        | undefined;
      if (!items || items.length === 0) return null;
      return (
        <span className="flex items-center gap-1">
          {items.map((item, i) => (
            <CompactSelectBadge key={i} label={item.value} color={item.color} />
          ))}
        </span>
      );
    }

    case "checkbox": {
      const checked = value?.value?.value === true;
      return (
        <span
          className={cn(
            "flex h-3.5 w-3.5 items-center justify-center border",
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-transparent",
          )}
        >
          {checked && (
            <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 6L5 8.5L9.5 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      );
    }

    case "url":
      return (
        <span className="max-w-32 truncate text-xs text-accent">
          {displayValue}
        </span>
      );

    case "email":
      return (
        <span className="max-w-32 truncate text-xs text-accent">
          {displayValue}
        </span>
      );

    case "date":
      return (
        <span className="text-xs text-muted-foreground">
          {formatDate(displayValue)}
        </span>
      );

    case "number":
      return (
        <span className="text-xs tabular-nums text-muted-foreground">
          {displayValue}
        </span>
      );

    case "created_time":
    case "updated_time":
      return (
        <span className="text-xs text-muted-foreground">
          {formatDate(displayValue)}
        </span>
      );

    default:
      return (
        <span className="max-w-32 truncate text-xs text-muted-foreground">
          {displayValue}
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// CompactSelectBadge
// ---------------------------------------------------------------------------

const SELECT_COLORS: Record<string, { bg: string; text: string }> = {
  gray: { bg: "bg-white/[0.08]", text: "text-foreground" },
  blue: { bg: "bg-blue-500/20", text: "text-blue-400" },
  green: { bg: "bg-green-500/20", text: "text-green-400" },
  yellow: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  orange: { bg: "bg-orange-500/20", text: "text-orange-400" },
  red: { bg: "bg-red-500/20", text: "text-red-400" },
  purple: { bg: "bg-purple-500/20", text: "text-purple-400" },
  pink: { bg: "bg-pink-500/20", text: "text-pink-400" },
};

function CompactSelectBadge({ label, color }: { label: string; color?: string }) {
  const colorStyle = SELECT_COLORS[color ?? "gray"] ?? SELECT_COLORS.gray;
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 text-xs",
        colorStyle.bg,
        colorStyle.text,
      )}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractDisplayValue(value: RowValue | undefined, propertyType: PropertyType): string {
  if (!value) return "";

  const raw = value.value;
  if (!raw) return "";

  const inner = raw.value;

  switch (propertyType) {
    case "checkbox":
      return inner === true ? "true" : inner === false ? "false" : "";
    case "multi_select":
      return (raw.items as { value: string }[] | undefined)
        ?.map((i) => i.value)
        .join(", ") ?? "";
    default:
      if (typeof inner === "string") return inner;
      if (typeof inner === "number") return String(inner);
      if (inner === null || inner === undefined) return "";
      return String(inner);
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (_e) {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// ListSkeleton
// ---------------------------------------------------------------------------

function ListSkeleton() {
  return (
    <div className="w-full">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2">
          <div className="h-4 w-4 animate-pulse bg-white/[0.06]" />
          <div
            className="h-3 animate-pulse bg-white/[0.06]"
            style={{ width: `${40 + (i % 3) * 15}%` }}
          />
          <div className="ml-auto flex gap-3">
            <div className="h-3 w-16 animate-pulse bg-white/[0.06]" />
            <div className="h-3 w-12 animate-pulse bg-white/[0.06]" />
          </div>
        </div>
      ))}
    </div>
  );
}
