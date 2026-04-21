"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RendererProps, EditorProps } from "./index";

// Checkbox is special: clicking the renderer toggles the value directly.
// The Editor component is identical — both render a clickable checkbox.

function CheckboxCell({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex h-full w-full items-center justify-center"
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center border transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input bg-transparent",
        )}
      >
        {checked && <Check className="size-3" />}
      </span>
    </button>
  );
}

export function CheckboxRenderer({ value }: RendererProps) {
  const checked = value.checked === true;
  // Renderer is non-interactive — display only
  return (
    <div className="flex h-full w-full items-center justify-center">
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center border",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input bg-transparent",
        )}
      >
        {checked && <Check className="size-3" />}
      </span>
    </div>
  );
}

export function CheckboxEditor({ value, onChange, onBlur }: EditorProps) {
  const checked = value.checked === true;
  return (
    <CheckboxCell
      checked={checked}
      onToggle={() => {
        onChange({ checked: !checked });
        onBlur();
      }}
    />
  );
}
