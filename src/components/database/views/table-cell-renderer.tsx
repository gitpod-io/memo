import { cn } from "@/lib/utils";
import type {
  DatabaseProperty,
  PropertyType,
  RowValue,
} from "@/lib/types";
import {
  formatDate,
  getSelectOptions,
} from "@/components/database/views/table-defaults";

// ---------------------------------------------------------------------------
// SelectBadge
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

export function SelectBadge({ label, color }: { label: string; color?: string }) {
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
// CellRenderer — renders the display value based on property type
// ---------------------------------------------------------------------------

export interface CellRendererProps {
  value: RowValue | undefined;
  property: DatabaseProperty;
  propertyType: PropertyType;
  displayValue: string;
}

export function CellRenderer({ value, property, propertyType, displayValue }: CellRendererProps) {
  switch (propertyType) {
    case "select":
    case "status": {
      const raw = value?.value as Record<string, unknown> | undefined;
      const optionId = typeof raw?.option_id === "string" ? raw.option_id : null;
      if (!optionId) return null;
      const options = getSelectOptions(property.config, propertyType);
      const option = options.find((o) => o.id === optionId);
      if (!option) return null;
      return <SelectBadge label={option.name} color={option.color} />;
    }

    case "multi_select": {
      const raw = value?.value as Record<string, unknown> | undefined;
      const optionIds = Array.isArray(raw?.option_ids)
        ? (raw.option_ids as string[])
        : [];
      if (optionIds.length === 0) return null;
      const options = getSelectOptions(property.config, propertyType);
      const optionMap = new Map(options.map((o) => [o.id, o]));
      return (
        <div className="flex flex-wrap gap-1">
          {optionIds.map((id) => {
            const option = optionMap.get(id);
            if (!option) return null;
            return (
              <SelectBadge key={id} label={option.name} color={option.color} />
            );
          })}
        </div>
      );
    }

    default:
      break;
  }

  // Non-select types require a displayValue string
  if (!displayValue) {
    return null;
  }

  switch (propertyType) {
    case "url":
      return (
        <a
          href={displayValue}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-sm text-accent hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {displayValue}
        </a>
      );

    case "email":
      return (
        <a
          href={`mailto:${displayValue}`}
          className="truncate text-sm text-accent hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {displayValue}
        </a>
      );

    case "number":
      return (
        <span className="truncate text-sm text-foreground tabular-nums text-right w-full">
          {displayValue}
        </span>
      );

    case "date":
      return (
        <span className="truncate text-sm text-foreground">
          {formatDate(displayValue)}
        </span>
      );

    case "created_time":
    case "updated_time":
      return (
        <span className="truncate text-sm text-muted-foreground">
          {formatDate(displayValue)}
        </span>
      );

    case "formula":
      return (
        <span className="truncate text-sm text-muted-foreground">
          {displayValue}
        </span>
      );

    default:
      return (
        <span className="truncate text-sm text-foreground">
          {displayValue}
        </span>
      );
  }
}
