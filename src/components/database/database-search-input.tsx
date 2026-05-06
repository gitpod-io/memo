"use client";

import { useCallback, useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DatabaseSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// DatabaseSearchInput
// ---------------------------------------------------------------------------

export function DatabaseSearchInput({
  value,
  onChange,
  className,
}: DatabaseSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = useCallback(() => {
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        if (value) {
          e.preventDefault();
          e.stopPropagation();
          handleClear();
        }
      }
    },
    [value, handleClear],
  );

  return (
    <div className={cn("relative flex items-center", className)}>
      <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search..."
        aria-label="Search database rows by title"
        data-testid="db-search-input"
        className={cn(
          "h-7 w-40 bg-transparent pl-7 pr-7 text-xs text-foreground",
          "border border-transparent placeholder:text-muted-foreground",
          "outline-none transition-colors",
          "focus:border-border focus:bg-background",
        )}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          data-testid="db-search-clear"
          className="absolute right-1.5 flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
