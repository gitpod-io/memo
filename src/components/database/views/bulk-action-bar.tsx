"use client";

import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BulkActionBarProps {
  /** Number of currently selected rows. */
  selectedCount: number;
  /** Called when the user clicks "Delete N rows". */
  onBulkDelete: () => void;
  /** Called when the user dismisses the action bar. */
  onClear: () => void;
}

export function BulkActionBar({
  selectedCount,
  onBulkDelete,
  onClear,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 border border-overlay-border bg-background px-4 py-2 shadow-lg"
      role="toolbar"
      aria-label="Bulk actions"
      data-testid="db-bulk-action-bar"
    >
      <span className="text-sm text-muted-foreground" data-testid="db-bulk-selection-count">
        {selectedCount} row{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <Button
        variant="destructive"
        size="sm"
        onClick={onBulkDelete}
        data-testid="db-bulk-delete-button"
      >
        <Trash2 className="h-4 w-4" />
        Delete {selectedCount} row{selectedCount !== 1 ? "s" : ""}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClear}
        aria-label="Clear selection"
        data-testid="db-bulk-clear-selection"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
