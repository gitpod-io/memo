"use client";

import { useCallback, useEffect, useState } from "react";
import { toPng } from "html-to-image";
import { createClient } from "@/lib/supabase/client";

export interface ScreenshotState {
  /** Data URL of the captured or uploaded screenshot */
  dataUrl: string | null;
  /** Whether a capture or upload is in progress */
  loading: boolean;
  /** Error message if capture or upload failed */
  error: string | null;
}

/**
 * Captures the main content area as a PNG data URL.
 * Targets `main` element to avoid capturing sidebar and feedback form.
 * Returns null if capture fails — callers should handle gracefully.
 */
async function captureViewport(): Promise<string | null> {
  const target = document.querySelector("main");
  if (!target || !(target instanceof HTMLElement)) return null;

  try {
    const dataUrl = await toPng(target, {
      cacheBust: true,
      pixelRatio: 1,
      // Skip the feedback sheet overlay if it's inside main
      filter: (node: HTMLElement) => {
        if (node.getAttribute?.("data-feedback-form")) return false;
        return true;
      },
    });
    return dataUrl;
  } catch (_captureErr) {
    return null;
  }
}

/** Converts a data URL to a Blob for upload. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    buffer[i] = bytes.charCodeAt(i);
  }
  return new Blob([buffer], { type: mime });
}

/**
 * Uploads a screenshot blob to the feedback-screenshots Supabase Storage bucket.
 * Returns the public URL on success, null on failure.
 */
export async function uploadScreenshot(
  blob: Blob,
  userId: string,
): Promise<string | null> {
  const supabase = createClient();
  const path = `${userId}/${Date.now()}.png`;

  const { error } = await supabase.storage
    .from("feedback-screenshots")
    .upload(path, blob, { contentType: "image/png" });

  if (error) return null;

  const {
    data: { publicUrl },
  } = supabase.storage.from("feedback-screenshots").getPublicUrl(path);

  return publicUrl;
}

/**
 * Hook that manages screenshot state for the feedback form.
 * Auto-captures the viewport when `trigger` transitions to true.
 * Provides methods to remove the screenshot or replace it with a file upload.
 */
export function useScreenshot(trigger: boolean) {
  const [state, setState] = useState<ScreenshotState>({
    dataUrl: null,
    loading: false,
    error: null,
  });

  // Auto-capture when trigger becomes true
  useEffect(() => {
    if (!trigger) return;

    let cancelled = false;

    // Delay slightly so the sheet animation doesn't interfere with capture.
    // All setState calls are inside async callbacks (setTimeout / Promise.then),
    // not synchronous in the effect body.
    const timer = setTimeout(() => {
      if (cancelled) return;
      setState({ dataUrl: null, loading: true, error: null });

      captureViewport().then((dataUrl) => {
        if (cancelled) return;
        setState({
          dataUrl,
          loading: false,
          error: dataUrl ? null : "Screenshot capture failed",
        });
      });
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      // Reset state when effect cleans up (trigger becomes false)
      setState({ dataUrl: null, loading: false, error: null });
    };
  }, [trigger]);

  const remove = useCallback(() => {
    setState({ dataUrl: null, loading: false, error: null });
  }, []);

  const replaceWithFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setState((prev) => ({ ...prev, error: "File must be an image" }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const reader = new FileReader();
    reader.onload = () => {
      setState({
        dataUrl: reader.result as string,
        loading: false,
        error: null,
      });
    };
    reader.onerror = () => {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Failed to read file",
      }));
    };
    reader.readAsDataURL(file);
  }, []);

  /** Convert current dataUrl to a Blob for upload. Returns null if no screenshot. */
  const toBlob = useCallback((): Blob | null => {
    if (!state.dataUrl) return null;
    return dataUrlToBlob(state.dataUrl);
  }, [state.dataUrl]);

  return {
    ...state,
    remove,
    replaceWithFile,
    toBlob,
  };
}
