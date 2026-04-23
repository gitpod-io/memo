"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PROPERTY_TYPE_ICON } from "@/lib/property-icons";
import type { DatabaseProperty } from "@/lib/types";
import type { SortRule } from "@/lib/database-filters";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SortMenuProps {
  properties: DatabaseProperty[];
  sorts: SortRule[];
  onSortsChange: (sorts: SortRule[]) => void;
}

// ---------------------------------------------------------------------------
// SortMenu — dropdown button that shows active sorts and lets users add/remove
// ---------------------------------------------------------------------------

export function SortMenu({
  properties,
  sorts,
  onSortsChange,
}: SortMenuProps) {
  const [open, setOpen] = useState(false);
  const [pickingProperty, setPickingProperty] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        e.target instanceof Node &&
        !containerRef.current.contains(e.target)
      ) {
        setOpen(false);
        setPickingProperty(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const removeSort = useCallback(
    (index: number) => {
      onSortsChange(sorts.filter((_, i) => i !== index));
    },
    [sorts, onSortsChange],
  );

  const toggleDirection = useCallback(
    (index: number) => {
      const updated = sorts.map((s, i) =>
        i === index
          ? { ...s, direction: s.direction === "asc" ? ("desc" as const) : ("asc" as const) }
          : s,
      );
      onSortsChange(updated);
    },
    [sorts, onSortsChange],
  );

  const addSort = useCallback(
    (propertyId: string) => {
      onSortsChange([...sorts, { property_id: propertyId, direction: "asc" }]);
      setPickingProperty(false);
    },
    [sorts, onSortsChange],
  );

  // Properties not already used in a sort rule
  const availableProperties = properties.filter(
    (p) => !sorts.some((s) => s.property_id === p.id),
  );

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 gap-1 px-2 text-xs",
          sorts.length > 0
            ? "text-foreground"
            : "text-muted-foreground",
        )}
        onClick={() => {
          setOpen((prev) => !prev);
          setPickingProperty(false);
        }}
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
        Sort
        {sorts.length > 0 && (
          <span className="ml-0.5 text-muted-foreground">
            ({sorts.length})
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 border border-border bg-background shadow-md">
          {/* Active sorts */}
          {sorts.length > 0 && (
            <div className="border-b border-border px-1 py-1">
              {sorts.map((sort, index) => {
                const prop = properties.find(
                  (p) => p.id === sort.property_id,
                );
                const propName = prop?.name ?? "Unknown";
                return (
                  <div
                    key={`${sort.property_id}-${index}`}
                    className="flex items-center gap-1.5 px-2 py-1"
                  >
                    <span className="flex-1 truncate text-xs">
                      {propName}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleDirection(index)}
                      className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
                      aria-label={`Sort ${sort.direction === "asc" ? "ascending" : "descending"}`}
                    >
                      {sort.direction === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      <span>{sort.direction === "asc" ? "Asc" : "Desc"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSort(index)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${propName} sort`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add sort */}
          {!pickingProperty && availableProperties.length > 0 && (
            <div className="px-1 py-1">
              <button
                type="button"
                onClick={() => setPickingProperty(true)}
                className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3 w-3" />
                Add sort
              </button>
            </div>
          )}

          {/* Property picker for adding a sort */}
          {pickingProperty && (
            <div className="max-h-48 overflow-y-auto px-1 py-1">
              {availableProperties.map((prop) => {
                const Icon = PROPERTY_TYPE_ICON[prop.type];
                return (
                  <button
                    key={prop.id}
                    type="button"
                    onClick={() => addSort(prop.id)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-overlay-hover"
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{prop.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {sorts.length === 0 && !pickingProperty && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No sorts applied
            </div>
          )}
        </div>
      )}
    </div>
  );
}
