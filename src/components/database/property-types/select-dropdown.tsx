"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SelectOption } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { SelectOptionBadge } from "./select-option-badge";
import {
  SELECT_OPTION_COLORS,
  SELECT_COLOR_STYLES,
  type SelectOptionColor,
} from "./index";

interface SelectDropdownProps {
  options: SelectOption[];
  /** Currently selected option IDs. */
  selected: string[];
  /** Whether multiple options can be selected. */
  multi: boolean;
  onSelect: (optionId: string) => void;
  onDeselect: (optionId: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
  /** Called when an option's color is changed. */
  onColorChange?: (optionId: string, color: string) => void;
}

export function SelectDropdown({
  options,
  selected,
  multi,
  onSelect,
  onDeselect,
  onCreate,
  onClose,
  onColorChange,
}: SelectDropdownProps) {
  const [query, setQuery] = useState("");
  const [colorPickerOptionId, setColorPickerOptionId] = useState<string | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target;
      if (
        containerRef.current &&
        target instanceof Node &&
        !containerRef.current.contains(target)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const trimmed = query.trim().toLowerCase();
  const filtered = options.filter((opt) =>
    opt.name.toLowerCase().includes(trimmed),
  );
  const exactMatch = options.some(
    (opt) => opt.name.toLowerCase() === trimmed,
  );
  const showCreate = trimmed.length > 0 && !exactMatch;

  const selectedSet = new Set(selected);

  function handleOptionClick(optionId: string) {
    if (selectedSet.has(optionId)) {
      onDeselect(optionId);
    } else {
      onSelect(optionId);
    }
    if (!multi) {
      onClose();
    }
  }

  function handleCreate() {
    const name = query.trim();
    if (name) {
      onCreate(name);
      setQuery("");
      if (!multi) {
        onClose();
      }
    }
  }

  const handleColorDotClick = useCallback(
    (e: React.MouseEvent, optionId: string) => {
      e.stopPropagation();
      setColorPickerOptionId((prev) =>
        prev === optionId ? null : optionId,
      );
    },
    [],
  );

  const handleColorSelect = useCallback(
    (optionId: string, color: SelectOptionColor) => {
      onColorChange?.(optionId, color);
      setColorPickerOptionId(null);
    },
    [onColorChange],
  );

  return (
    <div
      ref={containerRef}
      className="w-56 rounded-sm border border-border bg-background shadow-md"
    >
      <div className="p-1.5">
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onClose();
            }
            if (e.key === "Enter" && showCreate) {
              handleCreate();
            }
          }}
          placeholder="Search or create…"
          className="h-7 text-xs"
        />
      </div>
      <div className="max-h-48 overflow-y-auto px-1 pb-1">
        {filtered.map((opt) => {
          const isSelected = selectedSet.has(opt.id);
          const showColorPicker = colorPickerOptionId === opt.id;
          return (
            <div key={opt.id}>
              <button
                type="button"
                onClick={() => handleOptionClick(opt.id)}
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-1 text-sm",
                  "hover:bg-overlay-hover",
                )}
              >
                {multi && (
                  <span
                    className={cn(
                      "flex size-3.5 shrink-0 items-center justify-center border",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input",
                    )}
                  >
                    {isSelected && <Check className="size-2.5" />}
                  </span>
                )}
                {onColorChange && (
                  <ColorDot
                    color={opt.color}
                    onClick={(e) => handleColorDotClick(e, opt.id)}
                  />
                )}
                <SelectOptionBadge name={opt.name} color={opt.color} />
                {!multi && isSelected && (
                  <Check className="ml-auto size-3.5 text-accent" />
                )}
              </button>
              {showColorPicker && (
                <ColorPicker
                  currentColor={opt.color}
                  onSelect={(color) => handleColorSelect(opt.id, color)}
                />
              )}
            </div>
          );
        })}
        {filtered.length === 0 && !showCreate && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            No options
          </p>
        )}
        {showCreate && (
          <button
            type="button"
            onClick={handleCreate}
            className="flex w-full items-center gap-2 px-2 py-1 text-sm hover:bg-overlay-hover"
          >
            <Plus className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Create</span>
            <SelectOptionBadge name={query.trim()} color="gray" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ColorDot — clickable color indicator next to each option
// ---------------------------------------------------------------------------

function ColorDot({
  color,
  onClick,
}: {
  color: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const styles = SELECT_COLOR_STYLES[color as SelectOptionColor] ?? SELECT_COLOR_STYLES.gray;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full",
        styles.bg,
        "hover:ring-1 hover:ring-accent",
      )}
      aria-label="Change color"
    >
      <span className={cn("size-2 rounded-full", styles.bg)} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// ColorPicker — inline palette for changing an option's color
// ---------------------------------------------------------------------------

function ColorPicker({
  currentColor,
  onSelect,
}: {
  currentColor: string;
  onSelect: (color: SelectOptionColor) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 px-3 py-1.5">
      {SELECT_OPTION_COLORS.map((color) => {
        const styles = SELECT_COLOR_STYLES[color];
        const isActive = color === currentColor;
        return (
          <button
            key={color}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(color);
            }}
            className={cn(
              "flex size-5 items-center justify-center rounded-full",
              styles.bg,
              isActive && "ring-1 ring-accent",
              "hover:ring-1 hover:ring-accent",
            )}
            aria-label={`Color: ${color}`}
          >
            {isActive && <Check className="size-2.5 text-foreground" />}
          </button>
        );
      })}
    </div>
  );
}
