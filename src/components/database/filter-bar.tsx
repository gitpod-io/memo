"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DatabaseProperty } from "@/lib/types";
import {
  getOperatorLabel,
  operatorNeedsValue,
  type FilterOperator,
  type FilterRule,
} from "@/lib/database-filters";
import {
  FilterValueEditor,
  PropertyPicker,
  OperatorPicker,
  getSelectOptions,
} from "./filter-value-editor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterBarProps {
  properties: DatabaseProperty[];
  filters: FilterRule[];
  onFiltersChange: (filters: FilterRule[]) => void;
}

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
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const isDropdownOpen = addState.step !== "closed";

  // Close dropdown and return focus to the "Add filter" button
  const closeDropdown = useCallback(() => {
    setAddState({ step: "closed" });
    setValueInput("");
    requestAnimationFrame(() => {
      addButtonRef.current?.focus();
    });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isDropdownOpen) return;

    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        e.target instanceof Node &&
        !dropdownRef.current.contains(e.target)
      ) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isDropdownOpen, closeDropdown]);

  // Close dropdown on Escape key
  useEffect(() => {
    if (!isDropdownOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeDropdown();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDropdownOpen, closeDropdown]);

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
        // is_empty / is_not_empty / is_checked / is_not_checked — add immediately
        onFiltersChange([
          ...filters,
          {
            property_id: addState.propertyId,
            operator,
            value: null,
          },
        ]);
        closeDropdown();
        return;
      }

      setAddState({
        step: "pick-value",
        propertyId: addState.propertyId,
        operator,
      });
      setValueInput("");
    },
    [addState, filters, onFiltersChange, closeDropdown],
  );

  const commitFilter = useCallback(
    (value: unknown) => {
      if (addState.step !== "pick-value") return;
      onFiltersChange([
        ...filters,
        {
          property_id: addState.propertyId,
          operator: addState.operator,
          value,
        },
      ]);
      closeDropdown();
    },
    [addState, filters, onFiltersChange, closeDropdown],
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

    commitFilter(value);
  }, [addState, valueInput, properties, commitFilter]);

  // Resolve the property for the current pick-value step
  const activeProperty =
    addState.step === "pick-value"
      ? properties.find((p) => p.id === addState.propertyId)
      : undefined;

  // Build descriptive aria-label for the current dropdown step
  const dropdownStepLabel =
    addState.step === "pick-property"
      ? "Choose a property to filter by"
      : addState.step === "pick-operator"
        ? `Choose an operator for ${properties.find((p) => p.id === addState.propertyId)?.name ?? "property"}`
        : addState.step === "pick-value"
          ? `Enter a value for ${properties.find((p) => p.id === addState.propertyId)?.name ?? "property"} filter`
          : undefined;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="toolbar"
      aria-label="Database filters"
      data-testid="db-filter-bar"
      {...(filters.length > 0 ? { "data-has-filters": "true" } : {})}
    >
      {/* Active filter badges */}
      {filters.map((filter, index) => {
        const prop = properties.find((p) => p.id === filter.property_id);
        const propName = prop?.name ?? "Unknown";
        const opLabel = getOperatorLabel(filter.operator);

        let valueLabel = "";
        if (operatorNeedsValue(filter.operator) && filter.value != null) {
          // For select/status/multi_select, resolve option name from config
          if (
            (prop?.type === "select" ||
              prop?.type === "status" ||
              prop?.type === "multi_select") &&
            typeof filter.value === "string"
          ) {
            const options = getSelectOptions(prop.config);
            const opt = options.find((o) => o.id === filter.value);
            valueLabel = ` ${opt?.name ?? String(filter.value)}`;
          } else {
            valueLabel = ` ${String(filter.value)}`;
          }
        }

        const pillDescription = valueLabel
          ? `${propName} ${opLabel}${valueLabel}`
          : `${propName} ${opLabel}`;

        return (
          <Badge
            key={`${filter.property_id}-${filter.operator}-${index}`}
            variant="secondary"
            className="gap-1 text-xs"
            data-testid={`db-filter-pill-${index}`}
            aria-label={pillDescription}
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
          ref={addButtonRef}
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-xs text-muted-foreground"
          data-testid="db-filter-add"
          aria-expanded={isDropdownOpen}
          aria-haspopup="true"
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
            aria-label={dropdownStepLabel}
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
            aria-label={dropdownStepLabel}
          />
        )}

        {/* Step 3: Enter value — type-specific editor */}
        {addState.step === "pick-value" && activeProperty && (
          <FilterValueEditor
            property={activeProperty}
            valueInput={valueInput}
            onValueInputChange={setValueInput}
            onSubmit={handleValueSubmit}
            onSelectValue={commitFilter}
            onClose={closeDropdown}
            aria-label={dropdownStepLabel}
          />
        )}
      </div>
    </div>
  );
}

