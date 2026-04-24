"use client";

import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import type { ErrorInfo, ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { computePosition, flip, shift, offset } from "@floating-ui/react";
import { lazyCaptureException } from "@/lib/capture";
import { cn } from "@/lib/utils";
import type {
  DatabaseProperty,
  PropertyType,
  RowValue,
} from "@/lib/types";
import { getPropertyTypeConfig } from "@/components/database/property-types";
import { CellRenderer } from "@/components/database/views/table-cell-renderer";
import {
  valueKeyForType,
  extractDisplayValue,
} from "@/components/database/views/table-defaults";

// ---------------------------------------------------------------------------
// Property types whose editors render floating panels (calendars, dropdowns)
// that must escape the table's overflow-x-auto clipping context via a portal.
// ---------------------------------------------------------------------------

const PORTALED_EDITOR_TYPES: ReadonlySet<PropertyType> = new Set([
  "date",
  "select",
  "multi_select",
  "status",
]);

// ---------------------------------------------------------------------------
// TableCell
// ---------------------------------------------------------------------------

export interface TableCellProps {
  rowId: string;
  propertyId: string;
  property: DatabaseProperty;
  propertyType: PropertyType;
  value: RowValue | undefined;
  /** Synthetic value for computed types (created_time, updated_time, created_by). */
  computedValue?: Record<string, unknown>;
  isEditing: boolean;
  isFocused: boolean;
  rowHeightClass: string;
  rowIndex: number;
  colIndex: number;
  onStartEditing: (rowId: string, propertyId: string) => void;
  onKeyDown: (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => void;
  onBlur: (rowId: string, propertyId: string, newValue: Record<string, unknown>) => void;
  onFocus: (rowIndex: number, colIndex: number) => void;
}

export function TableCell({
  rowId,
  propertyId,
  property,
  propertyType,
  value,
  computedValue,
  isEditing,
  isFocused,
  rowHeightClass,
  rowIndex,
  colIndex,
  onStartEditing,
  onKeyDown,
  onBlur,
  onFocus,
}: TableCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const displayValue = extractDisplayValue(value, propertyType);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Read-only property types don't support editing
  const isReadOnly = propertyType === "formula" ||
    propertyType === "created_time" ||
    propertyType === "updated_time" ||
    propertyType === "created_by";

  if (isEditing && !isReadOnly) {
    // Types with specialized editors use the registry Editor component.
    // Simple text-input types (text, number, url, email, phone) use a plain <input>.
    const config = getPropertyTypeConfig(propertyType);
    const hasRegistryEditor =
      config?.Editor &&
      propertyType !== "text" &&
      propertyType !== "number" &&
      propertyType !== "url" &&
      propertyType !== "email" &&
      propertyType !== "phone";

    if (hasRegistryEditor) {
      return (
        <RegistryEditorCell
          rowId={rowId}
          propertyId={propertyId}
          property={property}
          propertyType={propertyType}
          value={value}
          rowHeightClass={rowHeightClass}
          onBlur={onBlur}
        />
      );
    }

    return (
      <div
        className={cn(
          "flex items-center border-b border-overlay-border p-0",
          rowHeightClass,
        )}
        role="gridcell"
      >
        <input
          ref={inputRef}
          type={propertyType === "number" ? "number" : "text"}
          defaultValue={displayValue}
          className="h-full w-full bg-transparent px-2 text-sm text-foreground outline-none ring-2 ring-inset ring-accent"
          onKeyDown={(e) => onKeyDown(e, rowIndex, colIndex)}
          onBlur={(e) => {
            try {
              const key = valueKeyForType(propertyType);
              const raw = e.target.value;
              const parsed = propertyType === "number"
                ? (raw === "" ? null : Number(raw))
                : raw;
              onBlur(rowId, propertyId, { [key]: parsed });
            } catch (err) {
              lazyCaptureException(
                err instanceof Error ? err : new Error(String(err)),
                {
                  extra: {
                    operation: "table-view:cell-edit-save",
                    rowId,
                    propertyId,
                    propertyType,
                  },
                  level: "warning",
                },
              );
              toast.error("Failed to save cell edit", { duration: 8000 });
            }
          }}
        />
      </div>
    );
  }

  // Checkbox type: toggle on click
  if (propertyType === "checkbox") {
    const raw = value?.value;
    const checked = raw?.checked === true || raw?.value === true;
    return (
      <div
        className={cn(
          "flex items-center justify-center border-b border-overlay-border p-2 hover:bg-overlay-subtle",
          isFocused && "ring-1 ring-inset ring-ring",
          rowHeightClass,
        )}
        role="gridcell"
        data-row={rowIndex}
        data-col={colIndex}
        tabIndex={isFocused ? 0 : -1}
        onFocus={() => onFocus(rowIndex, colIndex)}
      >
        <button
          type="button"
          onClick={() => {
            try {
              onBlur(rowId, propertyId, { checked: !checked });
            } catch (err) {
              lazyCaptureException(
                err instanceof Error ? err : new Error(String(err)),
                {
                  extra: {
                    operation: "table-view:checkbox-toggle",
                    rowId,
                    propertyId,
                  },
                  level: "warning",
                },
              );
              toast.error("Failed to save cell edit", { duration: 8000 });
            }
          }}
          className={cn(
            "flex h-4 w-4 items-center justify-center border",
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-transparent",
          )}
          aria-label={checked ? "Uncheck" : "Check"}
        >
          {checked && (
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 6L5 8.5L9.5 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>
    );
  }

  // Computed types use registry renderers with synthesized values
  if (computedValue) {
    const config = getPropertyTypeConfig(propertyType);
    if (config) {
      const { Renderer } = config;
      return (
        <div
          className={cn(
            "flex items-center border-b border-overlay-border p-2",
            "cursor-default",
            isFocused && "ring-1 ring-inset ring-ring",
            rowHeightClass,
          )}
          role="gridcell"
          data-row={rowIndex}
          data-col={colIndex}
          tabIndex={isFocused ? 0 : -1}
          onFocus={() => onFocus(rowIndex, colIndex)}
        >
          <Renderer value={computedValue} property={property} />
        </div>
      );
    }
  }

  return (
    <div
      className={cn(
        "flex items-center border-b border-overlay-border p-2 hover:bg-overlay-subtle",
        isReadOnly ? "cursor-default" : "cursor-text",
        isFocused && "ring-1 ring-inset ring-ring",
        rowHeightClass,
      )}
      role="gridcell"
      data-row={rowIndex}
      data-col={colIndex}
      tabIndex={isFocused ? 0 : -1}
      onClick={isReadOnly ? undefined : () => onStartEditing(rowId, propertyId)}
      onFocus={() => onFocus(rowIndex, colIndex)}
    >
      <CellRenderer
        value={value}
        property={property}
        propertyType={propertyType}
        displayValue={displayValue}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CellEditorErrorBoundary — catches rendering errors in cell editors so a
// single broken editor doesn't crash the entire table. Renders a fallback
// message and reports the error to Sentry.
// ---------------------------------------------------------------------------

interface CellEditorErrorBoundaryProps {
  children: ReactNode;
  rowHeightClass: string;
}

interface CellEditorErrorBoundaryState {
  hasError: boolean;
}

class CellEditorErrorBoundary extends Component<
  CellEditorErrorBoundaryProps,
  CellEditorErrorBoundaryState
> {
  constructor(props: CellEditorErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): CellEditorErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    lazyCaptureException(error, {
      extra: {
        operation: "table-view:cell-editor-render",
        componentStack: info.componentStack ?? "",
      },
      level: "warning",
    });
    toast.error("Cell editor failed to render", { duration: 8000 });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className={cn(
            "flex items-center border-b border-overlay-border px-2 text-xs text-muted-foreground",
            this.props.rowHeightClass,
          )}
          role="gridcell"
        >
          Error
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// RegistryEditorCell — wraps a registry Editor, tracks value changes via ref,
// and commits the latest value on blur so onChange→onBlur sequences work.
// For date/select/multi_select, renders the editor in a portal positioned
// relative to the cell so it is not clipped by the table overflow.
// ---------------------------------------------------------------------------

interface RegistryEditorCellProps {
  rowId: string;
  propertyId: string;
  property: DatabaseProperty;
  propertyType: PropertyType;
  value: RowValue | undefined;
  rowHeightClass: string;
  onBlur: (rowId: string, propertyId: string, newValue: Record<string, unknown>) => void;
}

function RegistryEditorCell({
  rowId,
  propertyId,
  property,
  propertyType,
  value,
  rowHeightClass,
  onBlur,
}: RegistryEditorCellProps) {
  const config = getPropertyTypeConfig(propertyType);
  const Editor = config!.Editor!;
  const latestValue = useRef<Record<string, unknown>>(value?.value ?? {});
  const cellRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const needsPortal = PORTALED_EDITOR_TYPES.has(propertyType);

  const handleChange = useCallback(
    (newValue: Record<string, unknown>) => {
      try {
        latestValue.current = newValue;
        onBlur(rowId, propertyId, newValue);
      } catch (err) {
        lazyCaptureException(
          err instanceof Error ? err : new Error(String(err)),
          {
            extra: {
              operation: "table-view:registry-editor-change",
              rowId,
              propertyId,
              propertyType,
            },
            level: "warning",
          },
        );
        toast.error("Failed to save cell edit", { duration: 8000 });
      }
    },
    [rowId, propertyId, propertyType, onBlur],
  );

  const handleBlur = useCallback(() => {
    try {
      onBlur(rowId, propertyId, latestValue.current);
    } catch (err) {
      lazyCaptureException(
        err instanceof Error ? err : new Error(String(err)),
        {
          extra: {
            operation: "table-view:registry-editor-blur",
            rowId,
            propertyId,
            propertyType,
          },
          level: "warning",
        },
      );
      toast.error("Failed to save cell edit", { duration: 8000 });
    }
  }, [rowId, propertyId, propertyType, onBlur]);

  // Position the portaled editor below the cell anchor
  useLayoutEffect(() => {
    if (!needsPortal) return;
    const anchor = cellRef.current;
    const floating = floatingRef.current;
    if (!anchor || !floating) return;

    void computePosition(anchor, floating, {
      placement: "bottom-start",
      middleware: [offset(2), flip({ padding: 8 }), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      floating.style.left = `${x}px`;
      floating.style.top = `${y}px`;
    });
  });

  if (needsPortal) {
    return (
      <>
        <div
          ref={cellRef}
          className={cn(
            "border-b border-overlay-border",
            rowHeightClass,
          )}
          role="gridcell"
        />
        {createPortal(
          <CellEditorErrorBoundary rowHeightClass={rowHeightClass}>
            <div
              ref={floatingRef}
              className="absolute z-50"
              style={{ left: 0, top: 0 }}
            >
              <Editor
                value={value?.value ?? {}}
                property={property}
                onChange={handleChange}
                onBlur={handleBlur}
              />
            </div>
          </CellEditorErrorBoundary>,
          document.body,
        )}
      </>
    );
  }

  return (
    <CellEditorErrorBoundary rowHeightClass={rowHeightClass}>
      <div
        className={cn(
          "relative border-b border-overlay-border",
          rowHeightClass,
        )}
        role="gridcell"
      >
        <Editor
          value={value?.value ?? {}}
          property={property}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      </div>
    </CellEditorErrorBoundary>
  );
}
