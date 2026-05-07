"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface BulkActionBarProps {
  /** Number of currently selected rows. */
  selectedCount: number;
  /** Called when the user confirms bulk deletion. */
  onBulkDelete: () => void;
  /** Called when the user dismisses the action bar. */
  onClear: () => void;
}

export function BulkActionBar({
  selectedCount,
  onBulkDelete,
  onClear,
}: BulkActionBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (selectedCount === 0) return null;

  const rowLabel = selectedCount === 1 ? "row" : "rows";

  return (
    <>
      <div
        className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 border border-overlay-border bg-background px-4 py-2 shadow-lg"
        role="toolbar"
        aria-label="Bulk actions"
        data-testid="db-bulk-action-bar"
      >
        <span className="text-sm text-muted-foreground" data-testid="db-bulk-selection-count">
          {selectedCount} {rowLabel} selected
        </span>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          data-testid="db-bulk-delete-button"
        >
          <Trash2 className="h-4 w-4" />
          Delete {selectedCount} {rowLabel}
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

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmOpen(false);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedCount} {rowLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedCount === 1
                ? "This row and its page content will be moved to trash."
                : `These ${selectedCount} rows and their page content will be moved to trash.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setConfirmOpen(false)}
              data-testid="db-bulk-delete-cancel"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                onBulkDelete();
              }}
              data-testid="db-bulk-delete-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
