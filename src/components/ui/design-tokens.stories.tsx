import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Design System/Tokens",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function Swatch({
  name,
  cssVar,
  oklch,
}: {
  name: string;
  cssVar: string;
  oklch: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-10 w-10 shrink-0 border border-overlay-border"
        style={{ backgroundColor: `var(${cssVar})` }}
      />
      <div className="flex flex-col">
        <span className="text-xs font-medium text-foreground">{name}</span>
        <span className="text-xs text-muted-foreground">
          {cssVar} · {oklch}
        </span>
      </div>
    </div>
  );
}

function SwatchGroup({
  title,
  tokens,
}: {
  title: string;
  tokens: { name: string; cssVar: string; oklch: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-medium uppercase tracking-widest text-label-faint">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        {tokens.map((t) => (
          <Swatch key={t.cssVar} {...t} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Colors                                                            */
/* ------------------------------------------------------------------ */

export const Colors: Story = {
  render: () => (
    <div className="flex max-w-3xl flex-col gap-8">
      <SwatchGroup
        title="Backgrounds"
        tokens={[
          { name: "background", cssVar: "--background", oklch: "oklch(0.13 0.008 255)" },
          { name: "card", cssVar: "--card", oklch: "oklch(0.16 0.008 255)" },
          { name: "popover", cssVar: "--popover", oklch: "oklch(0.16 0.008 255)" },
          { name: "muted", cssVar: "--muted", oklch: "oklch(0.22 0.012 255)" },
          { name: "secondary", cssVar: "--secondary", oklch: "oklch(0.22 0.012 255)" },
        ]}
      />
      <SwatchGroup
        title="Foregrounds"
        tokens={[
          { name: "foreground", cssVar: "--foreground", oklch: "oklch(0.87 0.01 255)" },
          { name: "card-foreground", cssVar: "--card-foreground", oklch: "oklch(0.87 0.01 255)" },
          { name: "popover-foreground", cssVar: "--popover-foreground", oklch: "oklch(0.87 0.01 255)" },
          { name: "muted-foreground", cssVar: "--muted-foreground", oklch: "oklch(0.55 0.012 255)" },
          { name: "secondary-foreground", cssVar: "--secondary-foreground", oklch: "oklch(0.87 0.01 255)" },
          { name: "primary-foreground", cssVar: "--primary-foreground", oklch: "oklch(0.13 0.008 255)" },
          { name: "accent-foreground", cssVar: "--accent-foreground", oklch: "oklch(0.87 0.01 255)" },
        ]}
      />
      <SwatchGroup
        title="Accents & Actions"
        tokens={[
          { name: "primary", cssVar: "--primary", oklch: "oklch(0.74 0.032 248)" },
          { name: "accent", cssVar: "--accent", oklch: "oklch(0.60 0.06 248)" },
          { name: "destructive", cssVar: "--destructive", oklch: "oklch(0.55 0.2 25)" },
          { name: "ring", cssVar: "--ring", oklch: "oklch(0.60 0.06 248)" },
        ]}
      />
      <SwatchGroup
        title="Borders & Inputs"
        tokens={[
          { name: "border", cssVar: "--border", oklch: "oklch(0.22 0.012 255)" },
          { name: "input", cssVar: "--input", oklch: "oklch(0.22 0.012 255)" },
        ]}
      />
      <SwatchGroup
        title="Sidebar"
        tokens={[
          { name: "sidebar", cssVar: "--sidebar", oklch: "oklch(0.16 0.008 255)" },
          { name: "sidebar-foreground", cssVar: "--sidebar-foreground", oklch: "oklch(0.87 0.01 255)" },
          { name: "sidebar-primary", cssVar: "--sidebar-primary", oklch: "oklch(0.74 0.032 248)" },
          { name: "sidebar-primary-foreground", cssVar: "--sidebar-primary-foreground", oklch: "oklch(0.13 0.008 255)" },
          { name: "sidebar-accent", cssVar: "--sidebar-accent", oklch: "oklch(0.22 0.012 255)" },
          { name: "sidebar-accent-foreground", cssVar: "--sidebar-accent-foreground", oklch: "oklch(0.87 0.01 255)" },
          { name: "sidebar-border", cssVar: "--sidebar-border", oklch: "oklch(0.22 0.012 255)" },
          { name: "sidebar-ring", cssVar: "--sidebar-ring", oklch: "oklch(0.60 0.06 248)" },
        ]}
      />
      <SwatchGroup
        title="Charts"
        tokens={[
          { name: "chart-1", cssVar: "--chart-1", oklch: "oklch(0.74 0.032 248)" },
          { name: "chart-2", cssVar: "--chart-2", oklch: "oklch(0.60 0.06 248)" },
          { name: "chart-3", cssVar: "--chart-3", oklch: "oklch(0.55 0.012 255)" },
          { name: "chart-4", cssVar: "--chart-4", oklch: "oklch(0.40 0.012 255)" },
          { name: "chart-5", cssVar: "--chart-5", oklch: "oklch(0.30 0.012 255)" },
        ]}
      />
      <SwatchGroup
        title="Overlays (theme-adaptive)"
        tokens={[
          { name: "overlay-subtle", cssVar: "--overlay-subtle", oklch: "white 2% / black 2%" },
          { name: "overlay-hover", cssVar: "--overlay-hover", oklch: "white 4% / black 4%" },
          { name: "overlay-border", cssVar: "--overlay-border", oklch: "white 6% / black 8%" },
          { name: "overlay-active", cssVar: "--overlay-active", oklch: "white 8% / black 6%" },
          { name: "overlay-strong", cssVar: "--overlay-strong", oklch: "white 12% / black 12%" },
          { name: "overlay-heavy", cssVar: "--overlay-heavy", oklch: "white 20% / black 20%" },
        ]}
      />
      <SwatchGroup
        title="Labels (theme-adaptive)"
        tokens={[
          { name: "label-faint", cssVar: "--label-faint", oklch: "white 30% / dark 40%" },
          { name: "label-muted", cssVar: "--label-muted", oklch: "white 50% / dark 55%" },
          { name: "label-subtle", cssVar: "--label-subtle", oklch: "white 70% / dark 70%" },
        ]}
      />
    </div>
  ),
};

/* ------------------------------------------------------------------ */
/*  Syntax Highlighting                                               */
/* ------------------------------------------------------------------ */

export const SyntaxHighlighting: Story = {
  render: () => (
    <div className="flex max-w-3xl flex-col gap-3">
      <h3 className="text-xs font-medium uppercase tracking-widest text-label-faint">
        Code Colors
      </h3>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        <Swatch name="keyword (purple)" cssVar="--code-keyword" oklch="oklch(0.65 0.12 300)" />
        <Swatch name="string (green)" cssVar="--code-string" oklch="oklch(0.70 0.12 150)" />
        <Swatch name="constant (red-orange)" cssVar="--code-constant" oklch="oklch(0.65 0.15 25)" />
        <Swatch name="type (yellow)" cssVar="--code-type" oklch="oklch(0.75 0.08 80)" />
        <Swatch name="builtin (cyan)" cssVar="--code-builtin" oklch="oklch(0.70 0.08 200)" />
      </div>
      <div className="mt-4 bg-muted p-4 text-sm">
        <pre>
          <code>
            <span style={{ color: "var(--code-keyword)" }}>const</span>{" "}
            <span className="text-foreground">greeting</span>{" "}
            <span style={{ color: "var(--code-keyword)" }}>=</span>{" "}
            <span style={{ color: "var(--code-string)" }}>&quot;Hello, world&quot;</span>
            <span className="text-muted-foreground">;</span>
            {"\n"}
            <span style={{ color: "var(--code-keyword)" }}>const</span>{" "}
            <span className="text-foreground">count</span>{" "}
            <span style={{ color: "var(--code-keyword)" }}>=</span>{" "}
            <span style={{ color: "var(--code-constant)" }}>42</span>
            <span className="text-muted-foreground">;</span>
            {"\n"}
            <span style={{ color: "var(--code-keyword)" }}>type</span>{" "}
            <span style={{ color: "var(--code-type)" }}>Result</span>{" "}
            <span style={{ color: "var(--code-keyword)" }}>=</span>{" "}
            <span style={{ color: "var(--code-builtin)" }}>Promise</span>
            <span className="text-muted-foreground">{"<"}</span>
            <span style={{ color: "var(--code-type)" }}>string</span>
            <span className="text-muted-foreground">{">"}</span>
            <span className="text-muted-foreground">;</span>
          </code>
        </pre>
      </div>
    </div>
  ),
};

/* ------------------------------------------------------------------ */
/*  Typography                                                        */
/* ------------------------------------------------------------------ */

export const Typography: Story = {
  render: () => (
    <div className="flex max-w-3xl flex-col gap-6">
      <h3 className="text-xs font-medium uppercase tracking-widest text-label-faint">
        Typography Scale
      </h3>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 border-b border-overlay-border pb-4">
          <span className="text-3xl font-bold text-foreground">
            Page title — text-3xl font-bold
          </span>
          <span className="text-xs text-muted-foreground">
            30px · Used for the page title in the editor
          </span>
        </div>
        <div className="flex flex-col gap-1 border-b border-overlay-border pb-4">
          <span className="text-2xl font-semibold text-foreground">
            Heading 1 — text-2xl font-semibold
          </span>
          <span className="text-xs text-muted-foreground">
            24px · Top-level section headings
          </span>
        </div>
        <div className="flex flex-col gap-1 border-b border-overlay-border pb-4">
          <span className="text-xl font-semibold text-foreground">
            Heading 2 — text-xl font-semibold
          </span>
          <span className="text-xs text-muted-foreground">
            20px · Sub-section headings
          </span>
        </div>
        <div className="flex flex-col gap-1 border-b border-overlay-border pb-4">
          <span className="text-lg font-medium text-foreground">
            Heading 3 — text-lg font-medium
          </span>
          <span className="text-xs text-muted-foreground">
            18px · Minor headings
          </span>
        </div>
        <div className="flex flex-col gap-1 border-b border-overlay-border pb-4">
          <span className="text-sm font-normal text-foreground">
            Body text — text-sm font-normal
          </span>
          <span className="text-xs text-muted-foreground">
            14px · All body content, paragraphs, list items
          </span>
        </div>
        <div className="flex flex-col gap-1 border-b border-overlay-border pb-4">
          <span className="text-sm font-medium text-foreground">
            UI label — text-sm font-medium
          </span>
          <span className="text-xs text-muted-foreground">
            14px · Sidebar items, buttons, form labels
          </span>
        </div>
        <div className="flex flex-col gap-1 border-b border-overlay-border pb-4">
          <span className="text-xs font-normal text-muted-foreground">
            Secondary text — text-xs text-muted-foreground
          </span>
          <span className="text-xs text-muted-foreground">
            12px · Timestamps, metadata, descriptions
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-normal text-foreground">
            Inline <code className="bg-muted px-1.5 py-0.5 text-sm">code</code> — text-sm on bg-muted
          </span>
          <span className="text-xs text-muted-foreground">
            14px · Distinguished by background, not font change
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-col gap-1">
        <h3 className="text-xs font-medium uppercase tracking-widest text-label-faint">
          Section Label Convention
        </h3>
        <span className="text-xs font-normal uppercase tracking-widest text-label-faint">
          Workspaces
        </span>
        <span className="text-xs text-muted-foreground">
          text-xs tracking-widest uppercase text-label-faint
        </span>
      </div>
    </div>
  ),
};

/* ------------------------------------------------------------------ */
/*  Spacing                                                           */
/* ------------------------------------------------------------------ */

function SpacingBox({
  label,
  pxValue,
  tailwindClass,
}: {
  label: string;
  pxValue: number;
  tailwindClass: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="shrink-0 bg-accent"
        style={{ width: pxValue, height: pxValue, minWidth: 4, minHeight: 4 }}
      />
      <div className="flex flex-col">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">
          {pxValue}px · {tailwindClass}
        </span>
      </div>
    </div>
  );
}

export const Spacing: Story = {
  render: () => (
    <div className="flex max-w-3xl flex-col gap-6">
      <h3 className="text-xs font-medium uppercase tracking-widest text-label-faint">
        Spacing Scale
      </h3>
      <div className="flex flex-col gap-4">
        <SpacingBox label="Inline element gap (icon + label)" pxValue={8} tailwindClass="gap-2" />
        <SpacingBox label="Between form fields" pxValue={12} tailwindClass="gap-3" />
        <SpacingBox label="Section padding" pxValue={16} tailwindClass="p-4" />
        <SpacingBox label="Page-level padding" pxValue={24} tailwindClass="p-6" />
        <SpacingBox label="Between major sections" pxValue={32} tailwindClass="gap-8" />
      </div>
      <div className="mt-2 flex flex-col gap-3">
        <h3 className="text-xs font-medium uppercase tracking-widest text-label-faint">
          Key Dimensions
        </h3>
        <div className="flex flex-col gap-2 text-xs text-muted-foreground">
          <span>Sidebar width: 240px (w-60)</span>
          <span>Editor max-width: 720px (max-w-3xl)</span>
          <span>Touch target minimum: 44px (mobile)</span>
        </div>
      </div>
    </div>
  ),
};

/* ------------------------------------------------------------------ */
/*  Corners                                                           */
/* ------------------------------------------------------------------ */

export const Corners: Story = {
  render: () => (
    <div className="flex max-w-3xl flex-col gap-6">
      <h3 className="text-xs font-medium uppercase tracking-widest text-label-faint">
        Corner Radius Rules
      </h3>
      <p className="text-xs text-muted-foreground">
        --radius: 0rem. Sharp corners by default. rounded-sm only for explicit
        exceptions.
      </p>
      <div className="grid grid-cols-2 gap-8">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-widest text-label-faint">
            Default (sharp)
          </span>
          <div className="flex flex-col gap-3">
            <div className="flex h-9 items-center justify-center border border-overlay-border bg-primary px-4 text-sm font-medium text-primary-foreground">
              Button
            </div>
            <div className="flex h-9 items-center border border-overlay-border bg-background px-3 text-sm text-muted-foreground">
              Input
            </div>
            <div className="border border-overlay-border bg-card p-4 text-sm">
              Card / Dialog
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-widest text-label-faint">
            Exceptions (rounded-sm)
          </span>
          <div className="flex flex-col gap-3">
            <div className="rounded-sm border border-overlay-border bg-popover p-3 text-sm shadow-md">
              Dropdown / Popover
            </div>
            <div className="rounded-sm border border-overlay-border bg-popover p-3 text-sm shadow-md">
              Toast notification
            </div>
            <div className="rounded-sm bg-muted p-4 text-sm">
              Code block
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
};
