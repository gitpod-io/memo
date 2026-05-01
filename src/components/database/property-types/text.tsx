"use client";

import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import type { RendererProps, EditorProps } from "./index";

export function TextRenderer({ value }: RendererProps) {
  const text = typeof value.text === "string"
    ? value.text
    : typeof value.value === "string" ? value.value : "";
  if (!text) return null;
  return <span className="truncate text-sm">{text}</span>;
}

export function TextEditor({ value, property, onChange, onBlur }: EditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const text = typeof value.text === "string"
    ? value.text
    : typeof value.value === "string" ? value.value : "";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Input
      ref={inputRef}
      value={text}
      onChange={(e) => onChange({ text: e.target.value })}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") {
          onBlur();
        }
      }}
      aria-label={`Edit ${property.name} text property`}
      data-testid="db-cell-editor-text"
      className="h-8 text-sm"
    />
  );
}
