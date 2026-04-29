/**
 * Font family options for the editor toolbar.
 *
 * Each entry maps a user-facing label to a CSS font-family value.
 * "Monospace" is the default (JetBrains Mono) and uses an empty string
 * to indicate "no inline style override" — the editor's base font applies.
 */

export type FontFamilyKey = "sans-serif" | "serif" | "monospace";

export interface FontFamilyOption {
  key: FontFamilyKey;
  label: string;
  /** CSS font-family value. Empty string means "use editor default (monospace)". */
  cssValue: string;
}

export const FONT_FAMILIES: FontFamilyOption[] = [
  {
    key: "sans-serif",
    label: "Sans-serif",
    cssValue: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  },
  {
    key: "serif",
    label: "Serif",
    cssValue: "Georgia, 'Times New Roman', serif",
  },
  {
    key: "monospace",
    label: "Monospace",
    cssValue: "",
  },
];

/** Map a CSS font-family value back to a FontFamilyKey. */
export function fontFamilyKeyFromCSS(css: string): FontFamilyKey {
  if (!css) return "monospace";
  const lower = css.toLowerCase();
  if (lower.includes("inter") || lower.includes("sans-serif")) return "sans-serif";
  if (lower.includes("georgia") || lower.includes("serif")) return "serif";
  return "monospace";
}

/** Get the CSS value for a given font family key. */
export function fontFamilyCSSFromKey(key: FontFamilyKey): string {
  const option = FONT_FAMILIES.find((f) => f.key === key);
  return option?.cssValue ?? "";
}
