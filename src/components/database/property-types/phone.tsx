"use client";

import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import type { RendererProps, EditorProps } from "./index";

/** Basic phone formatting: inserts dashes for US-style 10-digit numbers. */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  // Return as-is for international or non-standard formats
  return raw;
}

export function PhoneRenderer({ value }: RendererProps) {
  const phone = typeof value.phone === "string"
    ? value.phone
    : typeof value.value === "string" ? value.value : "";
  if (!phone) return null;

  return <span className="truncate text-sm">{formatPhone(phone)}</span>;
}

export function PhoneEditor({ value, property, onChange, onBlur }: EditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const phone = typeof value.phone === "string"
    ? value.phone
    : typeof value.value === "string" ? value.value : "";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Input
      ref={inputRef}
      type="tel"
      value={phone}
      onChange={(e) => onChange({ phone: e.target.value })}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") {
          onBlur();
        }
      }}
      aria-label={`Edit ${property.name} phone property`}
      data-testid="cell-editor-phone"
      placeholder="+1 (555) 000-0000"
      className="h-8 text-sm"
    />
  );
}
