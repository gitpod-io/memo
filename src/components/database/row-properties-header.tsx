"use client";

import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateProperty, updateRowValue } from "@/lib/database";
import {
  captureSupabaseError,
  isInsufficientPrivilegeError,
} from "@/lib/sentry";
import type { DatabaseProperty, DatabaseRow, PropertyType, RowValue } from "@/lib/types";
import { getPropertyTypeConfig } from "@/components/database/property-types";
import { evaluateFormulaForRow } from "@/components/database/property-types/formula";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLAPSED_LIMIT = 5;

const COMPUTED_TYPES: ReadonlySet<PropertyType> = new Set([
  "created_time",
  "updated_time",
  "created_by",
]);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RowPropertiesHeaderProps {
  pageId: string;
  properties: DatabaseProperty[];
  values: Record<string, RowValue>;
  pageCreatedAt: string;
  pageUpdatedAt: string;
  pageCreatedBy: string;
}

// ---------------------------------------------------------------------------
// Computed value helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getComputedDisplayValue(
  type: PropertyType,
  pageCreatedAt: string,
  pageUpdatedAt: string,
  pageCreatedBy: string,
): string {
  switch (type) {
    case "created_time":
      return formatDate(pageCreatedAt);
    case "updated_time":
      return formatDate(pageUpdatedAt);
    case "created_by":
      return pageCreatedBy;
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// ComputedValueDisplay — read-only display for computed properties
// ---------------------------------------------------------------------------

function ComputedValueDisplay({ displayValue }: { displayValue: string }) {
  return (
    <span className="text-sm text-muted-foreground">{displayValue}</span>
  );
}

// ---------------------------------------------------------------------------
// PropertyValueCell — editable cell for a single property
// ---------------------------------------------------------------------------

interface PropertyValueCellProps {
  pageId: string;
  property: DatabaseProperty;
  rowValue: RowValue | undefined;
  allProperties: DatabaseProperty[];
  row: DatabaseRow;
  pageCreatedAt: string;
  pageUpdatedAt: string;
  pageCreatedBy: string;
}

function PropertyValueCell({
  pageId,
  property,
  rowValue,
  allProperties,
  row,
  pageCreatedAt,
  pageUpdatedAt,
  pageCreatedBy,
}: PropertyValueCellProps) {
  const [editing, setEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState<Record<string, unknown>>(
    () => rowValue?.value ?? {},
  );
  const [pendingNewOptions, setPendingNewOptions] = useState<
    Array<{ id: string; name: string; color: string }> | null
  >(null);

  const isComputed = COMPUTED_TYPES.has(property.type);
  const config = getPropertyTypeConfig(property.type);

  const handleChange = useCallback((newValue: Record<string, unknown>) => {
    // Extract _newOptions so we can persist them on blur
    if (newValue._newOptions) {
      setPendingNewOptions(
        newValue._newOptions as Array<{ id: string; name: string; color: string }>,
      );
    }
    const { _newOptions: _, ...clean } = newValue;
    setCurrentValue(clean);
  }, []);

  const handleBlur = useCallback(async () => {
    setEditing(false);

    // Persist new options to property config first
    if (pendingNewOptions) {
      const { error: configError } = await updateProperty(property.id, {
        config: { options: pendingNewOptions },
      });
      if (configError && !isInsufficientPrivilegeError(configError)) {
        captureSupabaseError(configError, "row-properties-header:save-options");
      }
      setPendingNewOptions(null);
    }

    // Persist the row value (already stripped of _newOptions)
    const { error } = await updateRowValue(pageId, property.id, currentValue);
    if (error && !isInsufficientPrivilegeError(error)) {
      captureSupabaseError(error, "row-properties-header:save");
    }
  }, [pageId, property.id, currentValue, pendingNewOptions]);

  // Computed properties are always read-only
  if (isComputed) {
    const displayValue = getComputedDisplayValue(
      property.type,
      pageCreatedAt,
      pageUpdatedAt,
      pageCreatedBy,
    );
    return <ComputedValueDisplay displayValue={displayValue} />;
  }

  // Formula properties are read-only — evaluate and display
  if (property.type === "formula") {
    const formulaValue = evaluateFormulaForRow(property, row, allProperties);
    if (formulaValue._error) {
      return <span className="text-sm text-destructive">Error</span>;
    }
    const display = typeof formulaValue._display === "string" ? formulaValue._display : "";
    return <ComputedValueDisplay displayValue={display} />;
  }

  // No config for this property type — show raw value
  if (!config) {
    const raw = currentValue.value ?? currentValue.text ?? "";
    return (
      <span className="text-sm text-muted-foreground">
        {typeof raw === "string" ? raw : String(raw)}
      </span>
    );
  }

  if (editing && config.Editor) {
    const Editor = config.Editor;
    return (
      <div className="min-w-0 flex-1">
        <Editor
          value={currentValue}
          property={property}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      </div>
    );
  }

  const Renderer = config.Renderer;
  const hasValue = Object.keys(currentValue).length > 0;

  return (
    <button
      type="button"
      className={cn(
        "min-w-0 text-left",
        hasValue ? "cursor-text" : "cursor-text",
      )}
      onClick={() => setEditing(true)}
    >
      {hasValue ? (
        <Renderer value={currentValue} property={property} />
      ) : (
        <span className="text-sm text-muted-foreground">Empty</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// RowPropertiesHeader
// ---------------------------------------------------------------------------

export function RowPropertiesHeader({
  pageId,
  properties,
  values,
  pageCreatedAt,
  pageUpdatedAt,
  pageCreatedBy,
}: RowPropertiesHeaderProps) {
  const [expanded, setExpanded] = useState(false);

  if (properties.length === 0) return null;

  const needsCollapse = properties.length > COLLAPSED_LIMIT;
  const visibleProperties =
    needsCollapse && !expanded
      ? properties.slice(0, COLLAPSED_LIMIT)
      : properties;
  const hiddenCount = properties.length - COLLAPSED_LIMIT;

  return (
    <div className="mb-4 border-b border-overlay-border pb-4">
      <div className="space-y-1.5">
        {visibleProperties.map((property) => {
          // Build a minimal DatabaseRow for formula evaluation
          const row: DatabaseRow = {
            page: {
              id: pageId,
              title: "",
              icon: null,
              cover_url: null,
              created_at: pageCreatedAt,
              updated_at: pageUpdatedAt,
              created_by: pageCreatedBy,
            },
            values,
          };
          return (
            <div key={property.id} className="flex items-start gap-4">
              <span className="w-32 shrink-0 text-right text-xs text-muted-foreground leading-6">
                {property.name}
              </span>
              <div className="min-w-0 flex-1 leading-6">
                <PropertyValueCell
                  pageId={pageId}
                  property={property}
                  rowValue={values[property.id]}
                  allProperties={properties}
                  row={row}
                  pageCreatedAt={pageCreatedAt}
                  pageUpdatedAt={pageUpdatedAt}
                  pageCreatedBy={pageCreatedBy}
                />
              </div>
            </div>
          );
        })}
      </div>

      {needsCollapse && (
        <button
          type="button"
          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-none"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? (
            <>
              <ChevronDown className="h-3 w-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronRight className="h-3 w-3" />
              Show {hiddenCount} more
            </>
          )}
        </button>
      )}
    </div>
  );
}
