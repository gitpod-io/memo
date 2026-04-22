"use client";

import { useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { RendererProps, EditorProps } from "./index";

export function UrlRenderer({ value }: RendererProps) {
  const url = typeof value.url === "string"
    ? value.url
    : typeof value.value === "string" ? value.value : "";
  if (!url) return null;

  // Display a truncated version of the URL
  let display = url;
  try {
    const parsed = new URL(url);
    display = parsed.hostname + (parsed.pathname !== "/" ? parsed.pathname : "");
  } catch (_e) {
    // Invalid URL — show raw text
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 truncate text-sm text-accent hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="truncate">{display}</span>
      <ExternalLink className="size-3 shrink-0" />
    </a>
  );
}

export function UrlEditor({ value, onChange, onBlur }: EditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const url = typeof value.url === "string"
    ? value.url
    : typeof value.value === "string" ? value.value : "";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Input
      ref={inputRef}
      type="url"
      value={url}
      onChange={(e) => onChange({ url: e.target.value })}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") {
          onBlur();
        }
      }}
      placeholder="https://…"
      className="h-8 text-sm"
    />
  );
}
