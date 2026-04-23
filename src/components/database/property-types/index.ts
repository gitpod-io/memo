// Property type registry — maps each PropertyType to its Renderer and Editor components.
// View components use getPropertyTypeConfig() to render cells without knowing type details.

import type { DatabaseProperty, PropertyType } from "@/lib/types";
import { TextRenderer, TextEditor } from "./text";
import { NumberRenderer, NumberEditor } from "./number";
import { SelectRenderer, SelectEditor } from "./select";
import { MultiSelectRenderer, MultiSelectEditor } from "./multi-select";
import { CheckboxRenderer, CheckboxEditor } from "./checkbox";
import { DateRenderer, DateEditor } from "./date";
import { UrlRenderer, UrlEditor } from "./url";
import { EmailRenderer, EmailEditor } from "./email";
import { PhoneRenderer, PhoneEditor } from "./phone";
import { PersonRenderer, PersonEditor } from "./person";
import { FilesRenderer, FilesEditor } from "./files";
import {
  CreatedTimeRenderer,
  UpdatedTimeRenderer,
  CreatedByRenderer,
} from "./computed";
import { RelationRenderer, RelationEditor } from "./relation";
import { FormulaRenderer } from "./formula";
import { StatusRenderer, StatusEditor } from "./status";

// ---------------------------------------------------------------------------
// Shared prop interfaces
// ---------------------------------------------------------------------------

export interface RendererProps {
  value: Record<string, unknown>;
  property: DatabaseProperty;
}

export interface EditorProps {
  value: Record<string, unknown>;
  property: DatabaseProperty;
  onChange: (value: Record<string, unknown>) => void;
  onBlur: () => void;
}

// ---------------------------------------------------------------------------
// Select option color palette (matches .agents/design.md)
// ---------------------------------------------------------------------------

export const SELECT_OPTION_COLORS = [
  "gray",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
  "pink",
  "cyan",
] as const;

export type SelectOptionColor = (typeof SELECT_OPTION_COLORS)[number];

export const SELECT_COLOR_STYLES: Record<
  SelectOptionColor,
  { bg: string; text: string }
> = {
  gray: { bg: "bg-overlay-active", text: "text-foreground" },
  blue: { bg: "bg-blue-500/20", text: "text-blue-400" },
  green: { bg: "bg-green-500/20", text: "text-green-400" },
  yellow: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  orange: { bg: "bg-orange-500/20", text: "text-orange-400" },
  red: { bg: "bg-red-500/20", text: "text-red-400" },
  purple: { bg: "bg-purple-500/20", text: "text-purple-400" },
  pink: { bg: "bg-pink-500/20", text: "text-pink-400" },
  cyan: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
};

/** Cycle through the palette based on the current number of options. */
export function nextOptionColor(existingCount: number): SelectOptionColor {
  return SELECT_OPTION_COLORS[existingCount % SELECT_OPTION_COLORS.length];
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export interface PropertyTypeConfig {
  Renderer: React.FC<RendererProps>;
  /** null for read-only computed types (created_time, updated_time, created_by). */
  Editor: React.FC<EditorProps> | null;
}

const registry: Partial<Record<PropertyType, PropertyTypeConfig>> = {
  text: { Renderer: TextRenderer, Editor: TextEditor },
  number: { Renderer: NumberRenderer, Editor: NumberEditor },
  select: { Renderer: SelectRenderer, Editor: SelectEditor },
  multi_select: { Renderer: MultiSelectRenderer, Editor: MultiSelectEditor },
  status: { Renderer: StatusRenderer, Editor: StatusEditor },
  checkbox: { Renderer: CheckboxRenderer, Editor: CheckboxEditor },
  date: { Renderer: DateRenderer, Editor: DateEditor },
  url: { Renderer: UrlRenderer, Editor: UrlEditor },
  email: { Renderer: EmailRenderer, Editor: EmailEditor },
  phone: { Renderer: PhoneRenderer, Editor: PhoneEditor },
  person: { Renderer: PersonRenderer, Editor: PersonEditor },
  files: { Renderer: FilesRenderer, Editor: FilesEditor },
  formula: { Renderer: FormulaRenderer, Editor: null },
  created_time: { Renderer: CreatedTimeRenderer, Editor: null },
  updated_time: { Renderer: UpdatedTimeRenderer, Editor: null },
  created_by: { Renderer: CreatedByRenderer, Editor: null },
  relation: { Renderer: RelationRenderer, Editor: RelationEditor },
};

/**
 * Look up the renderer and editor for a property type.
 * Returns undefined for types not yet implemented.
 * Computed types (created_time, updated_time, created_by) have Editor: null.
 */
export function getPropertyTypeConfig(
  type: PropertyType,
): PropertyTypeConfig | undefined {
  return registry[type];
}

// ---------------------------------------------------------------------------
// Property type groups — for property type picker dropdowns
// ---------------------------------------------------------------------------

/** Standard editable property types. */
export const STANDARD_PROPERTY_TYPES: readonly PropertyType[] = [
  "text",
  "number",
  "select",
  "multi_select",
  "status",
  "checkbox",
  "date",
  "url",
  "email",
  "phone",
  "person",
  "files",
] as const;

/** Auto-derived read-only property types shown under "Advanced" in type pickers. */
export const ADVANCED_PROPERTY_TYPES: readonly PropertyType[] = [
  "relation",
  "formula",
  "created_time",
  "updated_time",
  "created_by",
] as const;

// ---------------------------------------------------------------------------
// Computed type helpers
// ---------------------------------------------------------------------------

/** Property types that derive values from page metadata, not row_values. */
const COMPUTED_TYPES: ReadonlySet<PropertyType> = new Set([
  "created_time",
  "updated_time",
  "created_by",
]);

export function isComputedType(type: PropertyType): boolean {
  return COMPUTED_TYPES.has(type);
}

/**
 * Build a synthetic value object for computed property types from page metadata.
 * View components call this instead of reading from row_values.
 */
export function buildComputedValue(
  type: PropertyType,
  page: { created_at: string; updated_at: string; created_by: string },
): Record<string, unknown> {
  switch (type) {
    case "created_time":
      return { created_at: page.created_at };
    case "updated_time":
      return { updated_at: page.updated_at };
    case "created_by":
      return { created_by: page.created_by };
    default:
      return {};
  }
}
