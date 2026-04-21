"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROPERTY_TYPE_ICON } from "@/lib/property-icons";
import type { DatabaseProperty } from "@/lib/types";
import {
  getOperatorsForType,
  getOperatorLabel,
  operatorNeedsValue,
  type FilterOperator,
  type FilterRule,
} from "@/lib/database-filters";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FilterBarProps {
  properties: DatabaseProperty[];
  filters: FilterRule[];
  onFiltersChange: (filters: FilterRule[]) => void;
}

// ---------------------------------------------------------------------------
// Add-filter flow state
// ---------------------------------------------------------------------------

type AddFilterStep =
  | { step: "closed" }
  | { step: "pick-property" }
  | { step: "pick-operator"; propertyId: string }
  | { step: "pick-value"; propertyId: string; operator: FilterOperator };

// ---------------------------------------------------------------------------
// FilterBar
// ---------------------------------------------------------------------------

export function FilterBar({
  properties,
  filters,
  onFiltersChange,
}: FilterBarProps) {
  const [addState, setAddState] = useState<AddFilterStep>({ step: "closed" });
  const [valueInput, setValueInput] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (addState.step === "closed") return;

    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        e.target instanceof Node &&
        !dropdownRef.current.contains(e.target)
      ) {
        setAddState({ step: "closed" });
        setValueInput("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [addState.step]);

  const removeFilter = useCallback(
    (index: number) => {
      onFiltersChange(filters.filter((_, i) => i !== index));
    },
    [filters, onFiltersChange],
  );

  const handlePropertySelect = useCallback((propertyId: string) => {
    setAddState({ step: "pick-operator", propertyId });
  }, []);

  const handleOperatorSelect = useCallback(
    (operator: FilterOperator) => {
      if (addState.step !== "pick-operator") return;

      if (!operatorNeedsValue(operator)) {
        // is_empty / is_not_empty — add filter immediately
        onFiltersChange([
          ...filters,
          {
            property_id: addState.propertyId,
            operator,
            value: null,
          },
        ]);
        setAddState({ step: "closed" });
        return;
      }

      setAddState({
        step: "pick-value",
        propertyId: addState.propertyId,
        operator,
      });
      setValueInput("");
    },
    [addState, filters, onFiltersChange],
  );

  const handleValueSubmit = useCallback(() => {
    if (addState.step !== "pick-value") return;
    const trimmed = valueInput.trim();
    if (!trimmed) return;

    // Coerce to number for number properties
    const prop = properties.find((p) => p.id === addState.propertyId);
    let value: unknown = trimmed;
    if (prop?.type === "number") {
      const n = Number(trimmed);
      if (!Number.isNaN(n)) value = n;
    }
    if (prop?.type === "checkbox") {
      value = trimmed === "true" || trimmed === "1";
    }

    onFiltersChange([
      ...filters,
      {
        property_id: addState.propertyId,
        operator: addState.operator,
        value,
      },
    ]);
    setAddState({ step: "closed" });
    setValueInput("");
  }, [addState, valueInput, filters, onFiltersChange, properties]);

  // Don't render the bar if there are no filters and the add flow is closed
  if (filters.length === 0 && addState.step === "closed") {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-muted p-2">
      {/* Active filter badges */}
      {filters.map((filter, index) => {
        const prop = properties.find((p) => p.id === filter.property_id);
        const propName = prop?.name ?? "Unknown";
        const opLabel = getOperatorLabel(filter.operator);
        const valueLabel = operatorNeedsValue(filter.operator)
          ? ` ${String(filter.value ?? "")}`
          : "";

        return (
          <Badge
            key={`${filter.property_id}-${filter.operator}-${index}`}
            variant="secondary"
            className="gap-1 text-xs"
          >
            <span>{propName}</span>
            <span className="text-muted-foreground">{opLabel}</span>
            {valueLabel && <span>{valueLabel}</span>}
            <button
              type="button"
              onClick={() => removeFilter(index)}
              className="ml-0.5 text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${propName} filter`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}

      {/* Add filter button + dropdown */}
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-xs text-muted-foreground"
          onClick={() =>
            setAddState((prev) =>
              prev.step === "closed"
                ? { step: "pick-property" }
                : { step: "closed" },
            )
          }
        >
          <Plus className="h-3 w-3" />
          Add filter
        </Button>

        {/* Step 1: Pick property */}
        {addState.step === "pick-property" && (
          <PropertyPicker
            properties={properties}
            onSelect={handlePropertySelect}
          />
        )}

        {/* Step 2: Pick operator */}
        {addState.step === "pick-operator" && (
          <OperatorPicker
            propertyType={
              properties.find((p) => p.id === addState.propertyId)?.type ??
              "text"
            }
            onSelect={handleOperatorSelect}
          />
        )}

        {/* Step 3: Enter value */}
        {addState.step === "pick-value" && (
          <div className="absolute left-0 top-full z-50 mt-1 w-56 border border-border bg-background p-2 shadow-md">
            <Input
              autoFocus
              value={valueInput}
              onChange={(e) => setValueInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleValueSubmit();
                if (e.key === "Escape") {
                  setAddState({ step: "closed" });
                  setValueInput("");
                }
              }}
              placeholder="Enter value…"
              className="h-7 text-xs"
              type={
                properties.find((p) => p.id === addState.propertyId)?.type ===
                "number"
                  ? "number"
                  : "text"
              }
            />
            <Button
              size="sm"
              className="mt-1.5 h-6 w-full text-xs"
              onClick={handleValueSubmit}
            >
              Apply
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PropertyPicker dropdown
// ---------------------------------------------------------------------------

function PropertyPicker({
  properties,
  onSelect,
}: {
  properties: DatabaseProperty[];
  onSelect: (propertyId: string) => void;
}) {
  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-56 border border-border bg-background py-1 shadow-md">
      {properties.map((prop) => {
        const Icon = PROPERTY_TYPE_ICON[prop.type];
        return (
          <button
            key={prop.id}
            type="button"
            onClick={() => onSelect(prop.id)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-white/[0.04]"
          >
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{prop.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OperatorPicker dropdown
// ---------------------------------------------------------------------------

function OperatorPicker({
  propertyType,
  onSelect,
}: {
  propertyType: DatabaseProperty["type"];
  onSelect: (operator: FilterOperator) => void;
}) {
  const operators = getOperatorsForType(propertyType);

  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-48 border border-border bg-background py-1 shadow-md">
      {operators.map((op) => (
        <button
          key={op}
          type="button"
          onClick={() => onSelect(op)}
          className={cn(
            "flex w-full items-center px-3 py-1.5 text-sm hover:bg-white/[0.04]",
          )}
        >
          {getOperatorLabel(op)}
        </button>
      ))}
    </div>
  );
}
