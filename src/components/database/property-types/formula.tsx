"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import {
  evaluateFormula,
  formatFormulaValue,
  type FormulaContext,
  type FormulaValue,
} from "@/lib/formula";
import type { DatabaseProperty, DatabaseRow } from "@/lib/types";
import type { RendererProps } from "./index";

// ---------------------------------------------------------------------------
// FormulaRenderer — displays the computed formula value (read-only)
// ---------------------------------------------------------------------------

export function FormulaRenderer({ value }: RendererProps) {
  const display = typeof value._display === "string" ? value._display : "";
  const error = typeof value._error === "string" ? value._error : null;

  if (error) {
    return (
      <span className="truncate text-sm text-destructive" data-testid="db-cell-renderer-formula">Error</span>
    );
  }

  if (!display) return null;

  return (
    <span className="truncate text-sm text-muted-foreground" data-testid="db-cell-renderer-formula">{display}</span>
  );
}

// ---------------------------------------------------------------------------
// FormulaConfigEditor — expression input with live preview
// ---------------------------------------------------------------------------

export interface FormulaConfigEditorProps {
  expression: string;
  onChange: (expression: string) => void;
  /** Properties in the database (for prop() reference validation). */
  properties: DatabaseProperty[];
  /** Optional first row for live preview. */
  previewRow?: DatabaseRow;
}

export function FormulaConfigEditor({
  expression,
  onChange,
  properties,
  previewRow,
}: FormulaConfigEditorProps) {
  const [localExpression, setLocalExpression] = useState(expression);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external changes
  useEffect(() => {
    setLocalExpression(expression);
  }, [expression]);

  // Build a formula context for preview using the first row
  const previewCtx = useMemo((): FormulaContext | null => {
    if (!previewRow) return null;
    return buildFormulaContext(previewRow, properties);
  }, [previewRow, properties]);

  // Compute preview result
  const preview = useMemo(() => {
    if (!localExpression.trim()) return null;
    const ctx = previewCtx ?? {
      getPropertyValue: () => null,
      getPropertyByName: () => undefined,
    };
    return evaluateFormula(localExpression, ctx);
  }, [localExpression, previewCtx]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalExpression(e.target.value);
    },
    [],
  );

  const handleBlur = useCallback(() => {
    onChange(localExpression);
  }, [localExpression, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onChange(localExpression);
      }
    },
    [localExpression, onChange],
  );

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">
        Formula expression
      </label>
      <Textarea
        ref={textareaRef}
        value={localExpression}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder='e.g. prop("Price") * prop("Quantity")'
        className="min-h-16 font-mono text-xs"
        rows={2}
      />
      {preview && (
        <div className="text-xs">
          <span className="text-muted-foreground">Preview: </span>
          {preview.error ? (
            <span className="text-destructive">{preview.error}</span>
          ) : (
            <span className="text-foreground">
              {formatFormulaValue(preview.value)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: build a FormulaContext from a DatabaseRow + properties
// ---------------------------------------------------------------------------

/**
 * Build a FormulaContext for evaluating formulas against a specific row.
 * Used by both the renderer (in view components) and the config editor preview.
 */
export function buildFormulaContext(
  row: DatabaseRow,
  properties: DatabaseProperty[],
): FormulaContext {
  return {
    getPropertyValue: (propertyName: string): FormulaValue => {
      const prop = properties.find((p) => p.name === propertyName);
      if (!prop) return null;

      const rowValue = row.values[prop.id];
      if (!rowValue) return null;

      return extractFormulaValue(prop.type, rowValue.value);
    },
    getPropertyByName: (propertyName: string) => {
      return properties.find((p) => p.name === propertyName);
    },
  };
}

/**
 * Extract a scalar FormulaValue from a row_values JSONB value object.
 * Maps each property type's storage format to a value the formula engine can use.
 */
function extractFormulaValue(
  type: string,
  value: Record<string, unknown>,
): FormulaValue {
  switch (type) {
    case "text":
      return typeof value.text === "string" ? value.text : null;
    case "number":
      return typeof value.number === "number" ? value.number : null;
    case "checkbox":
      return value.checked === true;
    case "date":
      return typeof value.date === "string" ? value.date : null;
    case "url":
      return typeof value.url === "string" ? value.url : null;
    case "email":
      return typeof value.email === "string" ? value.email : null;
    case "phone":
      return typeof value.phone === "string" ? value.phone : null;
    case "select":
      return typeof value.value === "string" ? value.value : null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// evaluateFormulaForRow — convenience for view components
// ---------------------------------------------------------------------------

/**
 * Evaluate a formula property for a specific row. Returns a value object
 * compatible with the RendererProps interface ({ _display, _error }).
 */
export function evaluateFormulaForRow(
  property: DatabaseProperty,
  row: DatabaseRow,
  allProperties: DatabaseProperty[],
): Record<string, unknown> {
  const expression = property.config.expression;
  if (typeof expression !== "string" || !expression.trim()) {
    return { _display: "", _error: null };
  }

  const ctx = buildFormulaContext(row, allProperties);
  const result = evaluateFormula(expression, ctx);

  return {
    _display: result.error ? null : formatFormulaValue(result.value),
    _error: result.error,
  };
}
