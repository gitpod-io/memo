"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SelectOption } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { SelectOptionBadge } from "./select-option-badge";

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
}

export function SelectDropdown({
  options,
  selected,
  multi,
  onSelect,
  onDeselect,
  onCreate,
  onClose,
}: SelectDropdownProps) {
  const [query, setQuery] = useState("");
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

  return (
    <div
      ref={containerRef}
      className="w-56 border border-border bg-background shadow-md"
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
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleOptionClick(opt.id)}
              className={cn(
                "flex w-full items-center gap-2 px-2 py-1 text-sm",
                "hover:bg-white/[0.04]",
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
              <SelectOptionBadge name={opt.name} color={opt.color} />
              {!multi && isSelected && (
                <Check className="ml-auto size-3.5 text-accent" />
              )}
            </button>
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
            className="flex w-full items-center gap-2 px-2 py-1 text-sm hover:bg-white/[0.04]"
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
