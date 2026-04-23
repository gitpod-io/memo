"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROPERTY_TYPE_ICON } from "@/lib/property-icons";
import type { DatabaseProperty, SelectOption } from "@/lib/types";
import { SelectOptionBadge } from "./property-types/select-option-badge";
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
// Helpers
// ---------------------------------------------------------------------------

function getSelectOptions(config: Record<string, unknown>): SelectOption[] {
  if (Array.isArray(config.options)) {
    return config.options as SelectOption[];
  }
  return [];
}

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
        // is_empty / is_not_empty / is_checked / is_not_checked — add immediately
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
      setAddState({ step: "closed" });
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

    commitFilter(value);
  }, [addState, valueInput, properties, commitFilter]);

  // Resolve the property for the current pick-value step
  const activeProperty =
    addState.step === "pick-value"
      ? properties.find((p) => p.id === addState.propertyId)
      : undefined;

  return (
    <div className="flex flex-wrap items-center gap-1.5"
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

        {/* Step 3: Enter value — type-specific editor */}
        {addState.step === "pick-value" && activeProperty && (
          <FilterValueEditor
            property={activeProperty}
            valueInput={valueInput}
            onValueInputChange={setValueInput}
            onSubmit={handleValueSubmit}
            onSelectValue={commitFilter}
            onClose={() => {
              setAddState({ step: "closed" });
              setValueInput("");
            }}
          />
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

// ---------------------------------------------------------------------------
// FilterValueEditor — type-specific value input
// ---------------------------------------------------------------------------

function FilterValueEditor({
  property,
  valueInput,
  onValueInputChange,
  onSubmit,
  onSelectValue,
  onClose,
}: {
  property: DatabaseProperty;
  valueInput: string;
  onValueInputChange: (v: string) => void;
  onSubmit: () => void;
  onSelectValue: (value: unknown) => void;
  onClose: () => void;
}) {
  switch (property.type) {
    case "select":
    case "status":
    case "multi_select":
      return (
        <SelectFilterValueEditor
          property={property}
          onSelectValue={onSelectValue}
          onClose={onClose}
        />
      );

    case "date":
    case "created_time":
    case "updated_time":
      return (
        <DateFilterValueEditor
          onSelectValue={onSelectValue}
          onClose={onClose}
        />
      );

    case "number":
      return (
        <TextInputFilterValueEditor
          valueInput={valueInput}
          onValueInputChange={onValueInputChange}
          onSubmit={onSubmit}
          onClose={onClose}
          inputType="number"
          placeholder="Enter number…"
        />
      );

    default:
      return (
        <TextInputFilterValueEditor
          valueInput={valueInput}
          onValueInputChange={onValueInputChange}
          onSubmit={onSubmit}
          onClose={onClose}
          inputType="text"
          placeholder="Enter value…"
        />
      );
  }
}

// ---------------------------------------------------------------------------
// TextInputFilterValueEditor — generic text/number input
// ---------------------------------------------------------------------------

function TextInputFilterValueEditor({
  valueInput,
  onValueInputChange,
  onSubmit,
  onClose,
  inputType,
  placeholder,
}: {
  valueInput: string;
  onValueInputChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  inputType: "text" | "number";
  placeholder: string;
}) {
  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-56 border border-border bg-background p-2 shadow-md">
      <Input
        autoFocus
        value={valueInput}
        onChange={(e) => onValueInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onClose();
        }}
        placeholder={placeholder}
        className="h-7 text-xs"
        type={inputType}
      />
      <Button
        size="sm"
        className="mt-1.5 h-6 w-full text-xs"
        onClick={onSubmit}
      >
        Apply
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SelectFilterValueEditor — dropdown with existing options
// ---------------------------------------------------------------------------

function SelectFilterValueEditor({
  property,
  onSelectValue,
  onClose,
}: {
  property: DatabaseProperty;
  onSelectValue: (value: unknown) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const options = getSelectOptions(property.config);
  const trimmed = query.trim().toLowerCase();
  const filtered = options.filter((opt) =>
    opt.name.toLowerCase().includes(trimmed),
  );

  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-56 border border-border bg-background shadow-md">
      <div className="p-1.5">
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
          placeholder="Search options…"
          className="h-7 text-xs"
        />
      </div>
      <div className="max-h-48 overflow-y-auto px-1 pb-1">
        {filtered.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelectValue(opt.id)}
            className="flex w-full items-center gap-2 px-2 py-1 text-sm hover:bg-white/[0.04]"
          >
            <SelectOptionBadge name={opt.name} color={opt.color} />
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            No options
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DateFilterValueEditor — native date input
// ---------------------------------------------------------------------------

function DateFilterValueEditor({
  onSelectValue,
  onClose,
}: {
  onSelectValue: (value: unknown) => void;
  onClose: () => void;
}) {
  const [dateValue, setDateValue] = useState("");

  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-56 border border-border bg-background p-2 shadow-md">
      <Input
        autoFocus
        type="date"
        value={dateValue}
        onChange={(e) => setDateValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && dateValue) onSelectValue(dateValue);
          if (e.key === "Escape") onClose();
        }}
        className="h-7 text-xs"
      />
      <Button
        size="sm"
        className="mt-1.5 h-6 w-full text-xs"
        onClick={() => {
          if (dateValue) onSelectValue(dateValue);
        }}
      >
        Apply
      </Button>
    </div>
  );
}
