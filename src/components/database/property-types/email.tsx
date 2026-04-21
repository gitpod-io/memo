"use client";

import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import type { RendererProps, EditorProps } from "./index";

export function EmailRenderer({ value }: RendererProps) {
  const email = typeof value.email === "string" ? value.email : "";
  if (!email) return null;

  return (
    <a
      href={`mailto:${email}`}
      className="truncate text-sm text-accent hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {email}
    </a>
  );
}

export function EmailEditor({ value, onChange, onBlur }: EditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const email = typeof value.email === "string" ? value.email : "";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Input
      ref={inputRef}
      type="email"
      value={email}
      onChange={(e) => onChange({ email: e.target.value })}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") {
          onBlur();
        }
      }}
      placeholder="name@example.com"
      className="h-8 text-sm"
    />
  );
}
