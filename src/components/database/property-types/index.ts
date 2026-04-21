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
  gray: { bg: "bg-white/[0.08]", text: "text-foreground" },
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
  Editor: React.FC<EditorProps>;
}

const registry: Partial<Record<PropertyType, PropertyTypeConfig>> = {
  text: { Renderer: TextRenderer, Editor: TextEditor },
  number: { Renderer: NumberRenderer, Editor: NumberEditor },
  select: { Renderer: SelectRenderer, Editor: SelectEditor },
  multi_select: { Renderer: MultiSelectRenderer, Editor: MultiSelectEditor },
  checkbox: { Renderer: CheckboxRenderer, Editor: CheckboxEditor },
  date: { Renderer: DateRenderer, Editor: DateEditor },
  url: { Renderer: UrlRenderer, Editor: UrlEditor },
  email: { Renderer: EmailRenderer, Editor: EmailEditor },
  phone: { Renderer: PhoneRenderer, Editor: PhoneEditor },
  person: { Renderer: PersonRenderer, Editor: PersonEditor },
};

/**
 * Look up the renderer and editor for a property type.
 * Returns undefined for types not yet implemented (person, files, relation, formula, computed).
 */
export function getPropertyTypeConfig(
  type: PropertyType,
): PropertyTypeConfig | undefined {
  return registry[type];
}
