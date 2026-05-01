"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RenamePropertyDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the dialog open state changes (e.g. Escape, overlay click). */
  onOpenChange: (open: boolean) => void;
  /** The current property name, used as the initial input value. */
  propertyName: string;
  /** Called with the trimmed new name when the user confirms. */
  onRename: (newName: string) => void;
}

/**
 * Inner form that remounts each time the dialog opens, so `propertyName`
 * seeds `useState` without needing an effect to reset it.
 */
function RenameForm({
  propertyName,
  onRename,
  onCancel,
}: {
  propertyName: string;
  onRename: (newName: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(propertyName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-select input text on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.select();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === propertyName) {
      onCancel();
      return;
    }
    onRename(trimmed);
  }, [value, propertyName, onRename, onCancel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>Rename property</DialogTitle>
        <DialogDescription>
          Enter a new name for this property.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="property-name">Name</Label>
        <Input
          ref={inputRef}
          id="property-name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          data-testid="db-rename-property-input"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} data-testid="db-rename-property-cancel">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={value.trim() === "" || value.trim() === propertyName}
          data-testid="db-rename-property-confirm"
        >
          Rename
        </Button>
      </DialogFooter>
    </>
  );
}

export function RenamePropertyDialog({
  open,
  onOpenChange,
  propertyName,
  onRename,
}: RenamePropertyDialogProps) {
  const handleRename = useCallback(
    (newName: string) => {
      onRename(newName);
      onOpenChange(false);
    },
    [onRename, onOpenChange],
  );

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} data-testid="db-rename-property-dialog">
        {open && (
          <RenameForm
            propertyName={propertyName}
            onRename={handleRename}
            onCancel={handleCancel}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
