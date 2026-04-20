"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { lazyCaptureException } from "@/lib/capture";
import { toast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { uploadImage } from "@/components/editor/image-plugin";

interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropDialogProps {
  src: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCropComplete: (newSrc: string) => void;
}

export function ImageCropDialog({
  src,
  open,
  onOpenChange,
  onCropComplete,
}: ImageCropDialogProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<CropRegion | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [displayScale, setDisplayScale] = useState(1);

  // Load image when dialog opens
  useEffect(() => {
    if (!open) {
      setCrop(null);
      setImageLoaded(false);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      toast.error("Failed to load image for cropping", { duration: 8000 });
      onOpenChange(false);
    };
    img.src = src;
  }, [open, src, onOpenChange]);

  // Draw image and crop overlay on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Scale image to fit within the dialog (max 600x400 display)
    const maxW = 600;
    const maxH = 400;
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    setDisplayScale(scale);

    const displayW = Math.round(img.naturalWidth * scale);
    const displayH = Math.round(img.naturalHeight * scale);

    canvas.width = displayW;
    canvas.height = displayH;

    // Draw image
    ctx.drawImage(img, 0, 0, displayW, displayH);

    // Draw crop overlay
    if (crop) {
      // Darken outside crop region
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, displayW, displayH);

      // Clear crop region to show original image
      ctx.clearRect(crop.x, crop.y, crop.width, crop.height);
      ctx.drawImage(
        img,
        crop.x / scale,
        crop.y / scale,
        crop.width / scale,
        crop.height / scale,
        crop.x,
        crop.y,
        crop.width,
        crop.height
      );

      // Draw crop border
      ctx.strokeStyle = "oklch(0.60 0.06 248)";
      ctx.lineWidth = 2;
      ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);
    }
  }, [imageLoaded, crop, displayScale]);

  const getCanvasCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = getCanvasCoords(e);
      setDragStart(coords);
      setIsDragging(true);
      setCrop(null);
    },
    [getCanvasCoords]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging || !dragStart) return;
      const coords = getCanvasCoords(e);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const x = Math.max(0, Math.min(dragStart.x, coords.x));
      const y = Math.max(0, Math.min(dragStart.y, coords.y));
      const width = Math.min(
        Math.abs(coords.x - dragStart.x),
        canvas.width - x
      );
      const height = Math.min(
        Math.abs(coords.y - dragStart.y),
        canvas.height - y
      );

      if (width > 10 && height > 10) {
        setCrop({ x, y, width, height });
      }
    },
    [isDragging, dragStart, getCanvasCoords]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleApplyCrop = useCallback(async () => {
    const img = imageRef.current;
    if (!img || !crop) return;

    setIsSaving(true);

    try {
      // Convert display coordinates to actual image coordinates
      const scale = displayScale;
      const srcX = Math.round(crop.x / scale);
      const srcY = Math.round(crop.y / scale);
      const srcW = Math.round(crop.width / scale);
      const srcH = Math.round(crop.height / scale);

      // Create a canvas with the cropped region
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = srcW;
      cropCanvas.height = srcH;
      const ctx = cropCanvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get canvas context");

      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        cropCanvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Failed to create image blob"));
          },
          "image/png",
          0.95
        );
      });

      // Upload cropped image
      const file = new File([blob], `cropped-${Date.now()}.png`, {
        type: "image/png",
      });
      const result = await uploadImage(file);

      if (result.error !== null) {
        toast.error(result.error, { duration: 8000 });
        return;
      }

      onCropComplete(result.url);
    } catch (error) {
      lazyCaptureException(error);
      toast.error("Failed to crop image", { duration: 8000 });
    } finally {
      setIsSaving(false);
    }
  }, [crop, displayScale, onCropComplete]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center">
          {imageLoaded ? (
            <canvas
              ref={canvasRef}
              className="cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Loading image...
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApplyCrop}
            disabled={!crop || isSaving}
          >
            {isSaving ? "Saving..." : "Apply Crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
