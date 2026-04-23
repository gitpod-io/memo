"use client";

import { useCallback, useState } from "react";
import type { SelectOption } from "@/lib/types";
import type { RendererProps, EditorProps } from "./index";
import { nextOptionColor } from "./index";
import { SelectOptionBadge } from "./select-option-badge";
import { SelectDropdown } from "./select-dropdown";

// ---------------------------------------------------------------------------
// Default status options — seeded when a status property has no options yet.
// ---------------------------------------------------------------------------

export const DEFAULT_STATUS_OPTIONS: SelectOption[] = [
  { id: "status-not-started", name: "Not Started", color: "gray" },
  { id: "status-in-progress", name: "In Progress", color: "blue" },
  { id: "status-done", name: "Done", color: "green" },
];

function getOptions(config: Record<string, unknown>): SelectOption[] {
  if (Array.isArray(config.options) && config.options.length > 0) {
    return config.options as SelectOption[];
  }
  return DEFAULT_STATUS_OPTIONS;
}

function getSelectedId(value: Record<string, unknown>): string | null {
  return typeof value.option_id === "string" ? value.option_id : null;
}

export function StatusRenderer({ value, property }: RendererProps) {
  const options = getOptions(property.config);
  const selectedId = getSelectedId(value);
  if (!selectedId) return null;

  const option = options.find((o) => o.id === selectedId);
  if (!option) return null;

  return <SelectOptionBadge name={option.name} color={option.color} />;
}

export function StatusEditor({
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
