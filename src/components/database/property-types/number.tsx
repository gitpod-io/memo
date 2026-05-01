"use client";

import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import type { RendererProps, EditorProps } from "./index";

type NumberFormat = "number" | "currency" | "percent";

function formatNumber(raw: unknown, format: NumberFormat): string {
  const num = typeof raw === "number" ? raw : Number(raw);
  if (Number.isNaN(num)) return "";

  switch (format) {
    case "currency":
      return num.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      });
    case "percent":
      return num.toLocaleString("en-US", {
        style: "percent",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    default:
      return num.toLocaleString("en-US");
  }
}

export function NumberRenderer({ value, property }: RendererProps) {
  const raw = value.number ?? value.value;
  if (raw === undefined || raw === null || raw === "") return null;

  const format = (property.config.format as NumberFormat) ?? "number";
  const formatted = formatNumber(raw, format);
  if (!formatted) return null;

  return (
    <span className="block truncate text-right text-sm tabular-nums">
      {formatted}
    </span>
  );
}

export function NumberEditor({ value, property, onChange, onBlur }: EditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const raw = value.number ?? value.value;
  const numStr =
    raw !== undefined && raw !== null && raw !== "" ? String(raw) : "";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Input
      ref={inputRef}
      type="number"
      value={numStr}
      onChange={(e) => {
        const val = e.target.value;
        onChange({ number: val === "" ? null : Number(val) });
      }}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") {
          onBlur();
        }
      }}
      aria-label={`Edit ${property.name} number property`}
      data-testid="cell-editor-number"
      className="h-8 text-right text-sm tabular-nums"
    />
  );
}
