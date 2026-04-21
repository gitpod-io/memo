"use client";

import { useCallback } from "react";
import {
  Calendar,
  Columns3,
  LayoutGrid,
  List,
  Plus,
  Table2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DatabaseView, DatabaseViewType } from "@/lib/types";

// ---------------------------------------------------------------------------
// View type → icon mapping
// ---------------------------------------------------------------------------

const VIEW_TYPE_ICON: Record<
  DatabaseViewType,
  React.ComponentType<{ className?: string }>
> = {
  table: Table2,
  board: Columns3,
  list: List,
  calendar: Calendar,
  gallery: LayoutGrid,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ViewTabsProps {
  views: DatabaseView[];
  activeViewId: string;
  onViewChange: (viewId: string) => void;
  /** Stub handler for the "+" button — full implementation in a later issue. */
  onAddView?: () => void;
}

// ---------------------------------------------------------------------------
// ViewTabs
// ---------------------------------------------------------------------------

export function ViewTabs({
  views,
  activeViewId,
  onViewChange,
  onAddView,
}: ViewTabsProps) {
  const handleTabClick = useCallback(
    (viewId: string) => {
      if (viewId !== activeViewId) {
        onViewChange(viewId);
      }
    },
    [activeViewId, onViewChange],
  );

  return (
    <div className="flex items-center border-b border-white/[0.06]">
      <div className="flex items-center gap-0 overflow-x-auto">
        {views.map((view) => {
          const Icon = VIEW_TYPE_ICON[view.type];
          const isActive = view.id === activeViewId;

          return (
            <button
              key={view.id}
              type="button"
              onClick={() => handleTabClick(view.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm transition-colors",
                isActive
                  ? "border-b-2 border-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{view.name}</span>
            </button>
          );
        })}
      </div>
      {onAddView && (
        <button
          type="button"
          onClick={onAddView}
          className="ml-1 flex shrink-0 items-center p-2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Add view"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
