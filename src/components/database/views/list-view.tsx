"use client";

import { memo, useCallback, useMemo } from "react";
import Link from "next/link";
import { Copy, FileText, Plus } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DatabaseEmptyState } from "@/components/database/views/database-empty-state";
import { cn } from "@/lib/utils";
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseViewConfig,
  PropertyType,
  RowValue,
  SelectOption,
} from "@/lib/types";
import { useListKeyboardNavigation } from "./list-keyboard";

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
  /** Called to duplicate a row by its page ID. */
  onDuplicateRow?: (rowId: string) => void;
  /** Called when keyboard Enter navigates to a row. Receives the URL path. */
  onNavigate?: (path: string) => void;
  /** Loading state — shows skeleton. */
  loading?: boolean;
  /** Whether filters are currently active on the view */
  hasActiveFilters?: boolean;
  /** Callback to clear all active filters */
  onClearFilters?: () => void;
}

// ---------------------------------------------------------------------------
// ListView
// ---------------------------------------------------------------------------

export const ListView = memo(function ListView({
  rows,
  properties,
  viewConfig,
  workspaceSlug,
  onAddRow,
  onDuplicateRow,
  onNavigate,
  loading = false,
  hasActiveFilters = false,
  onClearFilters,
}: ListViewProps) {
  // Visible properties configured for this view
  const visibleProperties = useMemo(() => {
    if (viewConfig.visible_properties && viewConfig.visible_properties.length > 0) {
      const visibleSet = new Set(viewConfig.visible_properties);
      return properties.filter((p) => visibleSet.has(p.id));
    }
    return properties;
  }, [properties, viewConfig.visible_properties]);

  const pageIds = useMemo(() => rows.map((r) => r.page.id), [rows]);

  const { focusedIndex, containerRef, handleKeyDown, handleRowFocus } =
    useListKeyboardNavigation({
      rowCount: rows.length,
      workspaceSlug,
      pageIds,
      onNavigate,
    });

  const handleAddRow = useCallback(() => {
    onAddRow?.();
  }, [onAddRow]);

  if (loading) {
    return <ListSkeleton />;
  }

  if (rows.length === 0) {
    return (
      <div className="w-full">
        <DatabaseEmptyState
          hasActiveFilters={hasActiveFilters}
          onClearFilters={onClearFilters}
          onAddRow={onAddRow ? handleAddRow : undefined}
        />
        {onAddRow && (
          <button
            type="button"
            onClick={handleAddRow}
            className="flex w-full items-center gap-1.5 border-t border-overlay-border px-3 py-2 text-sm text-muted-foreground hover:bg-overlay-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        role="list"
        aria-label="Database list"
        onKeyDown={handleKeyDown}
      >
        {rows.map((row, index) => (
          <ListRow
            key={row.page.id}
            row={row}
            index={index}
            visibleProperties={visibleProperties}
            workspaceSlug={workspaceSlug}
            isFocused={focusedIndex === index}
            onRowFocus={handleRowFocus}
            onDuplicateRow={onDuplicateRow}
          />
        ))}
      </div>

      {onAddRow && (
        <button
          type="button"
          onClick={handleAddRow}
          className="flex w-full items-center gap-1.5 border-t border-overlay-border px-3 py-2 text-sm text-muted-foreground hover:bg-overlay-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// ListRow
// ---------------------------------------------------------------------------

interface ListRowProps {
  row: DatabaseRow;
  index: number;
  visibleProperties: DatabaseProperty[];
  workspaceSlug: string;
  isFocused: boolean;
  onRowFocus: (index: number) => void;
  onDuplicateRow?: (rowId: string) => void;
}

function ListRow({
  row,
  index,
  visibleProperties,
  workspaceSlug,
  isFocused,
  onRowFocus,
  onDuplicateRow,
}: ListRowProps) {
  const handleFocus = useCallback(() => {
    onRowFocus(index);
  }, [onRowFocus, index]);

  const link = (
    <Link
      href={`/${workspaceSlug}/${row.page.id}`}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm hover:bg-overlay-hover",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        isFocused && "ring-2 ring-ring ring-offset-2",
      )}
      role="listitem"
      tabIndex={0}
      aria-current={isFocused ? "true" : undefined}
      data-testid="list-row"
      data-list-index={index}
      onFocus={handleFocus}
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
                property={prop}
                propertyType={prop.type}
              />
            );
          })}
        </span>
      )}
    </Link>
  );

  if (!onDuplicateRow) return link;

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        {link}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => onDuplicateRow(row.page.id)}
          data-testid="list-row-context-duplicate"
        >
          <Copy className="h-4 w-4" />
          Duplicate
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ---------------------------------------------------------------------------
// CompactPropertyValue — inline compact renderer for list view
// ---------------------------------------------------------------------------

interface CompactPropertyValueProps {
  value: RowValue | undefined;
  property: DatabaseProperty;
  propertyType: PropertyType;
}

function CompactPropertyValue({ value, property, propertyType }: CompactPropertyValueProps) {
  // Select/multi-select resolve option IDs from property config directly
  switch (propertyType) {
    case "select": {
      const raw = value?.value as Record<string, unknown> | undefined;
      const optionId = typeof raw?.option_id === "string" ? raw.option_id : null;
      if (!optionId) return null;
      const options = getSelectOptions(property.config);
      const option = options.find((o) => o.id === optionId);
      if (!option) return null;
      return <CompactSelectBadge label={option.name} color={option.color} />;
    }

    case "multi_select": {
      const raw = value?.value as Record<string, unknown> | undefined;
      const optionIds = Array.isArray(raw?.option_ids)
        ? (raw.option_ids as string[])
        : [];
      if (optionIds.length === 0) return null;
      const options = getSelectOptions(property.config);
      const optionMap = new Map(options.map((o) => [o.id, o]));
      return (
        <span className="flex items-center gap-1">
          {optionIds.map((id) => {
            const option = optionMap.get(id);
            if (!option) return null;
            return (
              <CompactSelectBadge key={id} label={option.name} color={option.color} />
            );
          })}
        </span>
      );
    }

    default:
      break;
  }

  // Non-select types use the extracted display value string
  const displayValue = extractDisplayValue(value, propertyType);

  if (!displayValue) {
    return null;
  }

  switch (propertyType) {
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
  gray: { bg: "bg-overlay-active", text: "text-foreground" },
  blue: { bg: "bg-blue-500/20", text: "text-blue-400" },
  green: { bg: "bg-green-500/20", text: "text-green-400" },
  yellow: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  orange: { bg: "bg-orange-500/20", text: "text-orange-400" },
  red: { bg: "bg-red-500/20", text: "text-red-400" },
  purple: { bg: "bg-purple-500/20", text: "text-purple-400" },
  pink: { bg: "bg-pink-500/20", text: "text-pink-400" },
  cyan: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
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

function getSelectOptions(config: Record<string, unknown>): SelectOption[] {
  if (Array.isArray(config.options)) {
    return config.options as SelectOption[];
  }
  return [];
}

/** Maps a property type to the key its registry editor/renderer expects. */
function valueKeyForType(propertyType: PropertyType): string {
  switch (propertyType) {
    case "text":
      return "text";
    case "number":
      return "number";
    case "url":
      return "url";
    case "email":
      return "email";
    case "phone":
      return "phone";
    case "checkbox":
      return "checked";
    case "date":
      return "date";
    default:
      return "value";
  }
}

function extractDisplayValue(value: RowValue | undefined, propertyType: PropertyType): string {
  if (!value) return "";

  const raw = value.value;
  if (!raw) return "";

  const key = valueKeyForType(propertyType);
  const typed = raw[key];
  const legacy = raw.value;

  switch (propertyType) {
    case "checkbox": {
      const checked = typed ?? legacy;
      return checked === true ? "true" : checked === false ? "false" : "";
    }
    case "select":
    case "multi_select":
      // Select/multi-select rendering is handled directly by CompactPropertyValue
      // using option IDs from the raw value and the property config.
      return "";
    default: {
      const inner = typed ?? legacy;
      if (typeof inner === "string") return inner;
      if (typeof inner === "number") return String(inner);
      if (inner === null || inner === undefined) return "";
      return String(inner);
    }
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
          <div className="h-4 w-4 animate-pulse bg-overlay-border" />
          <div
            className="h-3 animate-pulse bg-overlay-border"
            style={{ width: `${40 + (i % 3) * 15}%` }}
          />
          <div className="ml-auto flex gap-3">
            <div className="h-3 w-16 animate-pulse bg-overlay-border" />
            <div className="h-3 w-12 animate-pulse bg-overlay-border" />
          </div>
        </div>
      ))}
    </div>
  );
}
