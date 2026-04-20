"use client";

import type { JSX } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface ImageExpandDialogProps {
  src: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageExpandDialog({
  src,
  open,
  onOpenChange,
}: ImageExpandDialogProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] max-w-[90vw] items-center justify-center bg-black/90 p-0 sm:max-w-[90vw]"
        showCloseButton
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- User-uploaded image displayed in lightbox */}
        <img
          src={src}
          alt="Expanded view"
          className="max-h-[85vh] max-w-full object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
