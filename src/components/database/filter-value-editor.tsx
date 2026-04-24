"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROPERTY_TYPE_ICON } from "@/lib/property-icons";
import type { DatabaseProperty, SelectOption } from "@/lib/types";
import {
  getOperatorsForType,
  getOperatorLabel,
  type FilterOperator,
} from "@/lib/database-filters";
import { SelectOptionBadge } from "./property-types/select-option-badge";
import { DatePicker } from "./property-types/date";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getSelectOptions(
  config: Record<string, unknown>,
): SelectOption[] {
  if (Array.isArray(config.options)) {
    return config.options as SelectOption[];
  }
  return [];
}

// ---------------------------------------------------------------------------
// FilterValueEditor — type-specific value input
// ---------------------------------------------------------------------------

export interface FilterValueEditorProps {
  property: DatabaseProperty;
  valueInput: string;
  onValueInputChange: (v: string) => void;
  onSubmit: () => void;
  onSelectValue: (value: unknown) => void;
  onClose: () => void;
}

export function FilterValueEditor({
  property,
  valueInput,
  onValueInputChange,
  onSubmit,
  onSelectValue,
  onClose,
}: FilterValueEditorProps) {
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
    <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-sm border border-border bg-background p-2 shadow-md">
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
    <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-sm border border-border bg-background shadow-md">
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
            className="flex w-full items-center gap-2 px-2 py-1 text-sm hover:bg-overlay-hover"
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
// DateFilterValueEditor — custom DatePicker calendar
// ---------------------------------------------------------------------------

function DateFilterValueEditor({
  onSelectValue,
  onClose,
}: {
  onSelectValue: (value: unknown) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute left-0 top-full z-50 mt-1">
      <DatePicker
        selectedDate={null}
        onSelect={(iso) => onSelectValue(iso)}
        onClose={onClose}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PropertyPicker dropdown
// ---------------------------------------------------------------------------

export function PropertyPicker({
  properties,
  onSelect,
}: {
  properties: DatabaseProperty[];
  onSelect: (propertyId: string) => void;
}) {
  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-sm border border-border bg-background py-1 shadow-md">
      {properties.map((prop) => {
        const Icon = PROPERTY_TYPE_ICON[prop.type];
        return (
          <button
            key={prop.id}
            type="button"
            onClick={() => onSelect(prop.id)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-overlay-hover"
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

export function OperatorPicker({
  propertyType,
  onSelect,
}: {
  propertyType: DatabaseProperty["type"];
  onSelect: (operator: FilterOperator) => void;
}) {
  const operators = getOperatorsForType(propertyType);

  return (
    <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-sm border border-border bg-background py-1 shadow-md">
      {operators.map((op) => (
        <button
          key={op}
          type="button"
          onClick={() => onSelect(op)}
          className={cn(
            "flex w-full items-center px-3 py-1.5 text-sm hover:bg-overlay-hover",
          )}
        >
          {getOperatorLabel(op)}
        </button>
      ))}
    </div>
  );
}
