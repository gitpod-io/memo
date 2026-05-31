import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * Global design-spec compliance checks.
 *
 * Scans component source files for common violations of the design spec
 * (.agents/design.md). Catches issues pre-merge that would otherwise be
 * found post-merge by the UI Verifier automation.
 *
 * Excluded: src/components/ui/ (shadcn managed), stories, and test files.
 *
 * Also scans CSS files in src/app/ (e.g., globals.css) for hardcoded color
 * values, excluding CSS variable definitions which legitimately use color
 * values. See #1279.
 */

const COMPONENTS_DIR = join(__dirname);
const UI_DIR = join(COMPONENTS_DIR, "ui");
const GLOBALS_CSS_PATH = join(__dirname, "..", "app", "globals.css");

function collectComponentFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Skip ui/ directory (shadcn managed)
      if (full === UI_DIR) continue;
      results.push(...collectComponentFiles(full));
    } else if (
      full.endsWith(".tsx") &&
      !full.endsWith(".stories.tsx") &&
      !full.endsWith(".test.tsx")
    ) {
      results.push(full);
    }
  }
  return results.sort();
}

function label(filePath: string): string {
  return relative(COMPONENTS_DIR, filePath);
}

/**
 * Matches CSS variable definition lines (e.g., `--border: oklch(...)`)
 * inside :root, [data-theme], or .dark blocks. These legitimately define
 * color token values and must be excluded from hardcoded color checks.
 */
const CSS_VAR_DEFINITION_RE = /^\s*--[\w-]+\s*:/;

/**
 * Matches color functions that wrap a CSS variable reference rather than
 * a hardcoded value, e.g., `hsl(var(--border))`. These are legitimate
 * token usages, not hardcoded colors.
 */
const COLOR_FN_VAR_REF_RE = /\b(?:rgb|rgba|hsl|hsla)\s*\(\s*var\s*\(/gi;

/**
 * Reads a CSS file and returns lines that are NOT CSS variable definitions.
 * Also skips comment lines (starting with * or //).
 * Returns {lines, filePath} for consistent violation reporting.
 */
function collectCssNonVarLines(cssPath: string): { line: string; lineNum: number }[] {
  const content = readFileSync(cssPath, "utf-8");
  const lines = content.split("\n");
  const result: { line: string; lineNum: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    // Skip comments
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
    // Skip CSS variable definitions — they legitimately define token values
    if (CSS_VAR_DEFINITION_RE.test(line)) continue;
    result.push({ line, lineNum: i + 1 });
  }
  return result;
}

// ---------------------------------------------------------------------------
// 1. Rounded corners check
//
// Design spec (Corners section):
//   "Sharp corners by default. Use rounded-none or omit border-radius entirely."
//   Exceptions (rounded-sm only): dropdown menus, popovers, toasts, code blocks.
//   Everything else uses sharp corners.
//
// Allowed: rounded-none, rounded-sm, rounded-full (avatars, color indicators)
// Forbidden: rounded-md, rounded-lg, rounded-xl, rounded-2xl, rounded-3xl,
//            and directional variants unless -none or -sm.
// ---------------------------------------------------------------------------

/**
 * Matches rounded-* classes that are NOT rounded-none, rounded-sm, or rounded-full.
 * rounded-full is allowed for circular elements (avatars, color indicators).
 */
const FORBIDDEN_ROUNDED_SIZED_RE =
  /\brounded(?:-(?:t|b|l|r|tl|tr|bl|br|s|e|ss|se|es|ee))?-(?!none\b|sm\b|full\b)\w+/g;

/**
 * Matches bare `rounded` class (border-radius: 0.25rem) without any size suffix.
 * Design spec requires sharp corners; bare `rounded` violates this.
 */
const FORBIDDEN_ROUNDED_BARE_RE = /\brounded(?!-)\b/g;

describe("design spec: rounded corners", () => {
  const files = collectComponentFiles(COMPONENTS_DIR);

  it("scans at least one component file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("no component uses rounded classes other than rounded-none or rounded-sm", () => {
    const violations: string[] = [];

    for (const filePath of files) {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comments
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;

        for (const match of line.matchAll(FORBIDDEN_ROUNDED_SIZED_RE)) {
          violations.push(
            `${label(filePath)}:${i + 1} — "${match[0]}"`
          );
        }
        for (const match of line.matchAll(FORBIDDEN_ROUNDED_BARE_RE)) {
          violations.push(
            `${label(filePath)}:${i + 1} — "${match[0]}"`
          );
        }
      }
    }

    expect(
      violations,
      `Found ${violations.length} forbidden rounded class(es):\n${violations.join("\n")}`
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. Hardcoded color values check
//
// Design spec (Color section):
//   "Use oklch values via CSS variables. No arbitrary hex values."
//   All colors must come from the token set defined in design.md.
//
// Forbidden in component source:
//   - Hex colors: #fff, #1a2b3c, #1a2b3c80
//   - rgb()/rgba()/hsl()/hsla() functions
//
// Allowed:
//   - Tailwind color utilities that reference tokens (bg-background, text-primary)
// ---------------------------------------------------------------------------

/** Matches hex color values in code (preceded by quote, colon, comma, or space). */
const HEX_COLOR_RE = /(?:['"`]|[:,\s])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

/** Matches rgb/rgba/hsl/hsla function calls. */
const CSS_COLOR_FN_RE = /\b(?:rgb|rgba|hsl|hsla)\s*\(/gi;

/**
 * Files that legitimately use CSS color functions for non-styling purposes:
 * - draggable-block-plugin: Tailwind shadow-lg CSS value applied via JS style
 * - image-crop-dialog: canvas 2D drawing context
 */
const COLOR_FN_ALLOWLIST = [
  "editor/draggable-block-plugin.tsx",
  "editor/image-crop-dialog.tsx",
];

describe("design spec: no hardcoded color values", () => {
  const files = collectComponentFiles(COMPONENTS_DIR);

  it("no component uses hex color values", () => {
    const violations: string[] = [];

    for (const filePath of files) {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;
        if (line.trimStart().startsWith("import ")) continue;

        const matches = line.matchAll(HEX_COLOR_RE);
        for (const match of matches) {
          violations.push(
            `${label(filePath)}:${i + 1} — "${match[0].trim()}"`
          );
        }
      }
    }

    // Also scan globals.css (excluding CSS variable definitions) — see #1279
    const cssLabel = relative(COMPONENTS_DIR, GLOBALS_CSS_PATH);
    for (const { line, lineNum } of collectCssNonVarLines(GLOBALS_CSS_PATH)) {
      for (const match of line.matchAll(HEX_COLOR_RE)) {
        violations.push(
          `${cssLabel}:${lineNum} — "${match[0].trim()}"`
        );
      }
    }

    expect(
      violations,
      `Found ${violations.length} hardcoded hex color(s). Use design tokens instead:\n${violations.join("\n")}`
    ).toEqual([]);
  });

  it("no component uses rgb()/rgba()/hsl()/hsla() color functions", () => {
    const violations: string[] = [];

    for (const filePath of files) {
      const rel = label(filePath);
      if (COLOR_FN_ALLOWLIST.some((allowed) => rel === allowed)) continue;

      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;
        if (line.trimStart().startsWith("import ")) continue;

        const matches = line.matchAll(CSS_COLOR_FN_RE);
        for (const match of matches) {
          violations.push(
            `${label(filePath)}:${i + 1} — "${match[0].trim()}"`
          );
        }
      }
    }

    // Also scan globals.css (excluding CSS variable definitions) — see #1279
    // Skip color functions that wrap CSS variable references (e.g., hsl(var(--border)))
    const cssLabel = relative(COMPONENTS_DIR, GLOBALS_CSS_PATH);
    for (const { line, lineNum } of collectCssNonVarLines(GLOBALS_CSS_PATH)) {
      for (const match of line.matchAll(CSS_COLOR_FN_RE)) {
        // Allow color functions wrapping CSS variables: hsl(var(--token))
        const fromMatch = line.substring(match.index!);
        if (COLOR_FN_VAR_REF_RE.test(fromMatch)) {
          COLOR_FN_VAR_REF_RE.lastIndex = 0;
          continue;
        }
        violations.push(
          `${cssLabel}:${lineNum} — "${match[0].trim()}"`
        );
      }
    }

    expect(
      violations,
      `Found ${violations.length} CSS color function(s). Use design tokens instead:\n${violations.join("\n")}`
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Hardcoded font-family check
//
// Design spec (Typography section):
//   "Default typeface: JetBrains Mono (monospace), loaded via next/font/google
//    with --font-jetbrains-mono CSS variable."
//   Editor supports three font families via the font family selector.
//
// Forbidden: inline font-family declarations in component files.
// Allowed: font-family in the editor's font family feature — allowlisted.
// ---------------------------------------------------------------------------

const FONT_FAMILY_RE = /font-family\s*:/gi;

/** Files that legitimately set font-family for the editor font selector. */
const FONT_FAMILY_ALLOWLIST = [
  "editor/floating-toolbar-plugin.tsx",
  "editor/editor.tsx",
];

describe("design spec: no hardcoded font-family", () => {
  const files = collectComponentFiles(COMPONENTS_DIR);

  it("no component uses inline font-family (use CSS variable instead)", () => {
    const violations: string[] = [];

    for (const filePath of files) {
      const rel = label(filePath);
      if (FONT_FAMILY_ALLOWLIST.some((allowed) => rel === allowed)) continue;

      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;

        const matches = line.matchAll(FONT_FAMILY_RE);
        for (const match of matches) {
          violations.push(
            `${label(filePath)}:${i + 1} — "${match[0].trim()}"`
          );
        }
      }
    }

    expect(
      violations,
      `Found ${violations.length} hardcoded font-family declaration(s). Use the --font-jetbrains-mono CSS variable:\n${violations.join("\n")}`
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. Arbitrary spacing values check
//
// Design spec (Spacing section):
//   "Never use arbitrary spacing values (p-[13px]). Use the scale."
//   The base unit is 4px. Tailwind's default scale is on a 4px grid.
//
// Forbidden: arbitrary value brackets on padding/margin/gap utilities
//   e.g., p-[13px], px-[7rem], my-[2.5em], gap-[11px]
//
// Allowed: Tailwind's standard spacing scale values (p-1, p-2, p-4, etc.)
// ---------------------------------------------------------------------------

/** Matches arbitrary spacing values in brackets for padding, margin, and gap. */
const ARBITRARY_SPACING_RE =
  /\b(?:p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y)-\[[^\]]+\]/g;

describe("design spec: no arbitrary spacing values", () => {
  const files = collectComponentFiles(COMPONENTS_DIR);

  it("no component uses arbitrary spacing brackets (use Tailwind scale)", () => {
    const violations: string[] = [];

    for (const filePath of files) {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;

        const matches = line.matchAll(ARBITRARY_SPACING_RE);
        for (const match of matches) {
          violations.push(
            `${label(filePath)}:${i + 1} — "${match[0]}"`
          );
        }
      }
    }

    expect(
      violations,
      `Found ${violations.length} arbitrary spacing value(s). Use Tailwind's standard scale:\n${violations.join("\n")}`
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. Hardcoded bg-black/* and bg-white/* opacity values
//
// Design spec (Color section, rule):
//   "No hardcoded white/ or black/ opacity values — use overlay and label
//    tokens instead."
//   Use bg-overlay-hover, bg-overlay-backdrop, etc. instead of bg-black/50.
//
// Forbidden: bg-black/N, bg-white/N, bg-black/[0.xx], bg-white/[0.xx]
// Allowed (via allowlist): editor image lightbox (bg-black/90 for dark backdrop)
// ---------------------------------------------------------------------------

/** Matches bg-black/N or bg-white/N opacity patterns (slash or bracket syntax). */
const BG_BLACK_WHITE_OPACITY_RE =
  /\bbg-(?:black|white)\/(?:\d+|\[[\d.]+\])/g;

/**
 * Files that legitimately use bg-black/white opacity for non-token-replaceable
 * purposes (e.g., image lightbox backdrop darker than overlay-backdrop).
 */
const BG_OPACITY_ALLOWLIST = [
  "editor/image-expand-dialog.tsx",
];

describe("design spec: no hardcoded bg-black/white opacity", () => {
  const files = collectComponentFiles(COMPONENTS_DIR);

  it("no component uses bg-black/* or bg-white/* (use overlay tokens)", () => {
    const violations: string[] = [];

    for (const filePath of files) {
      const rel = label(filePath);
      if (BG_OPACITY_ALLOWLIST.some((allowed) => rel === allowed)) continue;

      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;

        for (const match of line.matchAll(BG_BLACK_WHITE_OPACITY_RE)) {
          violations.push(
            `${label(filePath)}:${i + 1} — "${match[0]}"`
          );
        }
      }
    }

    expect(
      violations,
      `Found ${violations.length} hardcoded bg-black/white opacity value(s). Use overlay tokens (bg-overlay-hover, bg-overlay-backdrop, etc.):\n${violations.join("\n")}`
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 6. Hardcoded text-white and text-black
//
// Design spec (Color section):
//   Use label tokens (text-label-faint, text-label-muted, text-label-subtle)
//   or semantic tokens (text-foreground, text-muted-foreground, etc.) instead
//   of text-white or text-black.
//
// Forbidden: text-white, text-black
// Allowed (via allowlist): editor theme configuration, canvas drawing
// ---------------------------------------------------------------------------

const TEXT_WHITE_BLACK_RE = /\btext-(?:white|black)\b/g;

/**
 * Files that legitimately use text-white/text-black for editor theme
 * or canvas drawing where design tokens don't apply.
 */
const TEXT_WHITE_BLACK_ALLOWLIST: string[] = [];

describe("design spec: no hardcoded text-white/text-black", () => {
  const files = collectComponentFiles(COMPONENTS_DIR);

  it("no component uses text-white or text-black (use label/semantic tokens)", () => {
    const violations: string[] = [];

    for (const filePath of files) {
      const rel = label(filePath);
      if (TEXT_WHITE_BLACK_ALLOWLIST.some((allowed) => rel === allowed)) continue;

      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;

        for (const match of line.matchAll(TEXT_WHITE_BLACK_RE)) {
          violations.push(
            `${label(filePath)}:${i + 1} — "${match[0]}"`
          );
        }
      }
    }

    expect(
      violations,
      `Found ${violations.length} hardcoded text-white/text-black usage(s). Use label tokens (text-label-faint, text-label-muted) or semantic tokens (text-foreground, text-primary-foreground):\n${violations.join("\n")}`
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 7. Large text classes outside editor
//
// Design spec (Typography section):
//   "No text-lg or larger outside of headings in the editor."
//   text-lg is used for Heading 3 in the editor, and the design spec
//   prescribes it for specific UI patterns (empty states, error boundaries,
//   calendar headers). These are allowlisted by file.
//
// Forbidden: text-lg, text-xl, text-2xl, text-3xl, text-4xl, text-5xl+
//   in non-editor files without an allowlist entry.
// Allowed: editor/ files (heading styles, callout emoji), and specific
//   non-editor files where the design spec prescribes large text.
// ---------------------------------------------------------------------------

const LARGE_TEXT_RE =
  /\btext-(?:lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g;

/**
 * Files outside editor/ that legitimately use large text per design spec.
 * Each entry documents the design spec reference justifying the usage.
 */
const LARGE_TEXT_ALLOWLIST = [
  // Page title input: design spec "Page title (in editor): text-3xl font-bold"
  "page-title.tsx",
  // Page icon emoji picker trigger: design spec prescribes large emoji display
  "page-icon.tsx",
  // Emoji picker grid items: large emoji for selection
  "emoji-picker.tsx",
  // Workspace home: heading (text-2xl), empty state heading (text-lg) per design spec
  "workspace-home.tsx",
  // Route error boundary: design spec "Heading: text-lg font-medium"
  "route-error.tsx",
  // Database empty state: design spec "Heading: text-lg font-medium, No rows yet"
  "database/views/database-empty-state.tsx",
  // Calendar view: design spec "Header: month name + year (text-lg font-medium)"
  "database/views/calendar-view.tsx",
  // Database error boundary: design spec "Heading: text-lg font-medium"
  "database/database-view-client.tsx",
  // Settings page: heading (text-2xl) for page title
  "settings-page-content.tsx",
];

describe("design spec: no large text outside editor", () => {
  const files = collectComponentFiles(COMPONENTS_DIR);

  it("no component uses text-lg or larger without allowlist (use text-sm for body)", () => {
    const violations: string[] = [];

    for (const filePath of files) {
      const rel = label(filePath);
      // Editor files are always allowed (heading styles, callout emoji)
      if (rel.startsWith("editor/")) continue;
      if (LARGE_TEXT_ALLOWLIST.some((allowed) => rel === allowed)) continue;

      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;

        for (const match of line.matchAll(LARGE_TEXT_RE)) {
          violations.push(
            `${label(filePath)}:${i + 1} — "${match[0]}"`
          );
        }
      }
    }

    expect(
      violations,
      `Found ${violations.length} large text class(es) outside editor. Use text-sm for body text, or add to LARGE_TEXT_ALLOWLIST with design spec reference:\n${violations.join("\n")}`
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Row height maps must enforce 44px mobile touch targets (#1233)
// ---------------------------------------------------------------------------

describe("design spec: row height touch targets", () => {
  it("all row height class maps in table-view.tsx enforce 44px mobile minimum", () => {
    const tableViewPath = join(COMPONENTS_DIR, "database", "views", "table-view.tsx");
    const content = readFileSync(tableViewPath, "utf-8");

    // Find all ROW_HEIGHT*CLASS constant blocks (both fixed and wrap variants).
    // Each compact/default entry must include min-h-[44px] for mobile touch targets.
    const classMapRe = /const (ROW_HEIGHT\w*CLASS)[^{]*\{([^}]+)\}/g;
    const violations: string[] = [];

    for (const match of content.matchAll(classMapRe)) {
      const mapName = match[1];
      const body = match[2];

      for (const size of ["compact", "default"] as const) {
        const lineRe = new RegExp(`${size}:\\s*"([^"]+)"`);
        const lineMatch = body.match(lineRe);
        if (!lineMatch) continue;

        const classes = lineMatch[1];
        if (!classes.includes("min-h-[44px]")) {
          violations.push(
            `${mapName}.${size}: "${classes}" — missing min-h-[44px] for mobile touch target`
          );
        }
      }
    }

    expect(
      violations,
      `Row height maps must enforce ≥44px touch targets on mobile (design spec):\n${violations.join("\n")}`
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 8. Icon-only buttons must have aria-label (#1268, #1229)
//
// Design spec (Accessibility):
//   Buttons that render only an icon (no visible text) must have an aria-label
//   or aria-labelledby attribute so screen readers can announce their purpose.
//
// Detection: <Button with size="icon"|"icon-xs"|"icon-sm"|"icon-lg"
//   These size variants produce square buttons intended for icon-only use.
//   Each occurrence must have aria-label or aria-labelledby on the same JSX
//   element (within the opening tag).
// ---------------------------------------------------------------------------

/**
 * Extracts the full JSX opening tag starting at `startIndex` in `content`.
 * Handles `>` inside attribute values (e.g., arrow functions in onClick)
 * by tracking brace depth.
 */
function extractJsxOpeningTag(content: string, startIndex: number): string {
  let i = startIndex;
  let braceDepth = 0;
  let inString: string | null = null;
  let inTemplateLiteral = false;

  while (i < content.length) {
    const ch = content[i];

    // Track string literals to avoid counting braces/angles inside them
    if (!inTemplateLiteral && (ch === '"' || ch === "'")) {
      if (inString === ch) {
        inString = null;
      } else if (!inString) {
        inString = ch;
      }
      i++;
      continue;
    }
    if (ch === "`") {
      if (!inString) {
        inTemplateLiteral = !inTemplateLiteral;
      }
      i++;
      continue;
    }
    if (inString || inTemplateLiteral) {
      i++;
      continue;
    }

    if (ch === "{") {
      braceDepth++;
    } else if (ch === "}") {
      braceDepth--;
    } else if (ch === ">" && braceDepth === 0) {
      // Check for self-closing />
      return content.substring(startIndex, i + 1);
    }
    i++;
  }
  return content.substring(startIndex);
}

/** Matches the start of a <Button with an icon size variant. */
const ICON_BUTTON_START_RE =
  /<Button\b/g;

/** Checks if a tag string contains an icon size variant. */
const ICON_SIZE_RE =
  /\bsize=["'{]"?(?:icon|icon-xs|icon-sm|icon-lg)["'}]?/;

describe("design spec: icon-only buttons must have aria-label", () => {
  const files = collectComponentFiles(COMPONENTS_DIR);

  it("scans at least one component file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("every icon-sized Button has aria-label or aria-labelledby", () => {
    const violations: string[] = [];

    for (const filePath of files) {
      const content = readFileSync(filePath, "utf-8");

      for (const match of content.matchAll(ICON_BUTTON_START_RE)) {
        const tag = extractJsxOpeningTag(content, match.index);

        // Only check buttons with icon size variants
        if (!ICON_SIZE_RE.test(tag)) continue;

        if (
          tag.includes("aria-label=") ||
          tag.includes("aria-labelledby=")
        ) {
          continue;
        }

        const lineNum =
          content.substring(0, match.index).split("\n").length;
        violations.push(
          `${label(filePath)}:${lineNum} — icon-sized Button missing aria-label`
        );
      }
    }

    expect(
      violations,
      `Found ${violations.length} icon-only Button(s) without aria-label. Add aria-label="<purpose>" to each:\n${violations.join("\n")}`
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 9. Destructive actions must use variant="destructive" (#1268, #1264)
//
// Design spec (Components / AlertDialog):
//   AlertDialogAction elements with delete/remove/destroy labels must use
//   variant="destructive" to visually signal the destructive nature of the
//   action. This prevents accidental clicks and matches user expectations.
//
// Detection: <AlertDialogAction elements whose text content (between opening
//   and closing tags) contains "Delete", "Remove", or "Destroy" (case-
//   insensitive) must have variant="destructive" on the opening tag.
// ---------------------------------------------------------------------------

/**
 * Matches <AlertDialogAction ...>text</AlertDialogAction> blocks.
 * Group 1: opening tag attributes, Group 2: inner text content.
 */
const ALERT_DIALOG_ACTION_RE =
  /<AlertDialogAction\b([^>]*)>([\s\S]*?)<\/AlertDialogAction>/g;

/** Words in the action label that indicate a destructive operation. */
const DESTRUCTIVE_LABEL_RE = /\b(?:delete|remove|destroy|trash|empty\s+trash)\b/i;

describe("design spec: destructive actions must use variant=\"destructive\"", () => {
  const files = collectComponentFiles(COMPONENTS_DIR);

  it("scans at least one component file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("AlertDialogAction with delete/remove/destroy label uses variant=\"destructive\"", () => {
    const violations: string[] = [];

    for (const filePath of files) {
      const content = readFileSync(filePath, "utf-8");

      for (const match of content.matchAll(ALERT_DIALOG_ACTION_RE)) {
        const attrs = match[1];
        const innerText = match[2];

        // Only check actions whose label indicates a destructive operation
        if (!DESTRUCTIVE_LABEL_RE.test(innerText)) continue;

        // Check that variant="destructive" is present in the opening tag
        if (/variant=["'{]"?destructive["'}]?/.test(attrs)) continue;

        const lineNum =
          content.substring(0, match.index).split("\n").length;
        // Extract a readable label from the inner text (strip JSX/whitespace)
        const textLabel = innerText.replace(/\{[^}]*\}/g, "").replace(/\s+/g, " ").trim();
        violations.push(
          `${label(filePath)}:${lineNum} — AlertDialogAction "${textLabel}" missing variant="destructive"`
        );
      }
    }

    expect(
      violations,
      `Found ${violations.length} destructive AlertDialogAction(s) without variant="destructive". Add variant="destructive" to each:\n${violations.join("\n")}`
    ).toEqual([]);
  });
});
