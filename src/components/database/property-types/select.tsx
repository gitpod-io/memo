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

function getSelectedId(value: Record<string, unknown>): string | null {
  return typeof value.option_id === "string" ? value.option_id : null;
}

export function SelectRenderer({ value, property }: RendererProps) {
  const options = getOptions(property.config);
  const selectedId = getSelectedId(value);
  if (!selectedId) return null;

  const option = options.find((o) => o.id === selectedId);
  if (!option) return null;

  return <SelectOptionBadge name={option.name} color={option.color} />;
}

export function SelectEditor({
  value,
  property,
  onChange,
  onBlur,
}: EditorProps) {
  const [localOptions, setLocalOptions] = useState<SelectOption[]>(() =>
    getOptions(property.config),
  );
  const selectedId = getSelectedId(value);
  const selected = selectedId ? [selectedId] : [];

  const handleSelect = useCallback(
    (optionId: string) => {
      onChange({ option_id: optionId });
    },
    [onChange],
  );

  const handleDeselect = useCallback(() => {
    onChange({ option_id: null });
  }, [onChange]);

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
      onChange({ option_id: newOption.id, _newOptions: updated });
    },
    [localOptions, onChange],
  );

  const handleColorChange = useCallback(
    (optionId: string, color: string) => {
      const updated = localOptions.map((o) =>
        o.id === optionId ? { ...o, color } : o,
      );
      setLocalOptions(updated);
      // Persist the updated options config via _newOptions
      const currentId = getSelectedId(value);
      onChange({
        option_id: currentId,
        _newOptions: updated,
      });
    },
    [localOptions, value, onChange],
  );

  return (
    <div className="w-full">
      <SelectDropdown
        options={localOptions}
        selected={selected}
        multi={false}
        onSelect={handleSelect}
        onDeselect={handleDeselect}
        onCreate={handleCreate}
        onClose={onBlur}
        onColorChange={handleColorChange}
      />
    </div>
  );
}
