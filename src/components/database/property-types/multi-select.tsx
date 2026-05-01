"use client";

import { useCallback, useState } from "react";
import type { SelectOption } from "@/lib/types";
import type { RendererProps, EditorProps } from "./index";
import { nextOptionColor } from "./index";
import { SelectOptionBadge } from "./select-option-badge";
import { SelectDropdown } from "./select-dropdown";

function getOptions(config: Record<string, unknown>): SelectOption[] {
  if (Array.isArray(config.options)) {
    return config.options as SelectOption[];
  }
  return [];
}

function getSelectedIds(value: Record<string, unknown>): string[] {
  if (Array.isArray(value.option_ids)) {
    return value.option_ids as string[];
  }
  return [];
}

export function MultiSelectRenderer({ value, property }: RendererProps) {
  const options = getOptions(property.config);
  const selectedIds = getSelectedIds(value);
  if (selectedIds.length === 0) return null;

  const optionMap = new Map(options.map((o) => [o.id, o]));

  return (
    <div className="flex flex-wrap gap-1">
      {selectedIds.map((id) => {
        const option = optionMap.get(id);
        if (!option) return null;
        return (
          <SelectOptionBadge
            key={id}
            name={option.name}
            color={option.color}
          />
        );
      })}
    </div>
  );
}

export function MultiSelectEditor({
  value,
  property,
  onChange,
  onBlur,
}: EditorProps) {
  const [localOptions, setLocalOptions] = useState<SelectOption[]>(() =>
    getOptions(property.config),
  );
  const selectedIds = getSelectedIds(value);

  const handleSelect = useCallback(
    (optionId: string) => {
      if (!selectedIds.includes(optionId)) {
        onChange({ option_ids: [...selectedIds, optionId] });
      }
    },
    [selectedIds, onChange],
  );

  const handleDeselect = useCallback(
    (optionId: string) => {
      onChange({ option_ids: selectedIds.filter((id) => id !== optionId) });
    },
    [selectedIds, onChange],
  );

  const handleCreate = useCallback(
    (name: string) => {
      const color = nextOptionColor(localOptions.length);
      const newOption: SelectOption = {
        id: crypto.randomUUID(),
        name,
        color,
      };
      const updated = [...localOptions, newOption];
      setLocalOptions(updated);
      // Include _newOptions so the parent can persist the updated config
      onChange({ option_ids: [...selectedIds, newOption.id], _newOptions: updated });
    },
    [localOptions, selectedIds, onChange],
  );

  const handleColorChange = useCallback(
    (optionId: string, color: string) => {
      const updated = localOptions.map((o) =>
        o.id === optionId ? { ...o, color } : o,
      );
      setLocalOptions(updated);
      // Persist the updated options config via _newOptions
      onChange({
        option_ids: selectedIds,
        _newOptions: updated,
      });
    },
    [localOptions, selectedIds, onChange],
  );

  return (
    <div className="w-full" data-testid="db-cell-editor-multi_select" aria-label={`Edit ${property.name} multi-select property`}>
      <SelectDropdown
        options={localOptions}
        selected={selectedIds}
        multi={true}
        onSelect={handleSelect}
        onDeselect={handleDeselect}
        onCreate={handleCreate}
        onClose={onBlur}
        onColorChange={handleColorChange}
      />
    </div>
  );
}
