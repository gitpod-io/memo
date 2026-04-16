import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { editorTheme } from "./theme";

/**
 * Regression test for issue #56: arbitrary color values in the editor theme
 * violate the design spec. All colors must use named design tokens
 * (e.g. text-primary, text-muted-foreground) not arbitrary oklch/hex/rgb values.
 */
describe("editorTheme", () => {
  const arbitraryColorPattern =
    /text-\[(?:oklch|rgb|hsl|#)[^\]]*\]|bg-\[(?:oklch|rgb|hsl|#)[^\]]*\]/;

  function collectClassStrings(
    obj: Record<string, unknown>,
    path = ""
  ): Array<{ path: string; value: string }> {
    const results: Array<{ path: string; value: string }> = [];
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      if (typeof value === "string") {
        results.push({ path: currentPath, value });
      } else if (typeof value === "object" && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((item, i) => {
            if (typeof item === "string") {
              results.push({ path: `${currentPath}[${i}]`, value: item });
            }
          });
        } else {
          results.push(
            ...collectClassStrings(
              value as Record<string, unknown>,
              currentPath
            )
          );
        }
      }
    }
    return results;
  }

  it("does not contain arbitrary color values", () => {
    const allClasses = collectClassStrings(
      editorTheme as unknown as Record<string, unknown>
    );
    const violations = allClasses.filter(({ value }) =>
      arbitraryColorPattern.test(value)
    );

    expect(violations).toEqual([]);
  });

  it("paragraph does not override line height", () => {
    expect(editorTheme.paragraph).toBeDefined();
    expect(editorTheme.paragraph).not.toMatch(/leading-/);
  });

  it("blockquote border uses design-spec opacity", () => {
    const quote = editorTheme.quote as string;
    expect(quote).toContain("border-white/[0.06]");
    expect(quote).not.toContain("border-white/[0.12]");
  });
});

/**
 * Regression test for issue #95: checklist checkboxes not visible.
 * Lexical's CheckListPlugin renders checkboxes via CSS ::before pseudo-elements
 * on the theme class names. The theme must include marker classes that the
 * globals.css rules can target.
 */
describe("editorTheme checklist checkbox rendering", () => {
  const listTheme = editorTheme.list as Record<string, string>;

  it("listitemChecked includes the CSS marker class", () => {
    expect(listTheme.listitemChecked).toContain("editor-checklist-checked");
  });

  it("listitemUnchecked includes the CSS marker class", () => {
    expect(listTheme.listitemUnchecked).toContain("editor-checklist-unchecked");
  });

  it("listitemChecked has relative positioning for pseudo-element placement", () => {
    expect(listTheme.listitemChecked).toContain("relative");
  });

  it("listitemUnchecked has relative positioning for pseudo-element placement", () => {
    expect(listTheme.listitemUnchecked).toContain("relative");
  });

  it("listitemChecked applies strikethrough styling", () => {
    expect(listTheme.listitemChecked).toContain("line-through");
  });

  it("globals.css defines ::before rules for checklist marker classes", () => {
    const css = readFileSync(
      resolve(__dirname, "../../app/globals.css"),
      "utf-8"
    );
    expect(css).toContain(".editor-checklist-unchecked::before");
    expect(css).toContain(".editor-checklist-checked::before");
    expect(css).toContain(".editor-checklist-checked::after");
  });
});
