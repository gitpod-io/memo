import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
} from "lucide-react";
import { type FontFamilyKey, FONT_FAMILIES } from "@/components/editor/font-family";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Static representation of the floating toolbar. The actual plugin requires
// Lexical context and DOM selection — stories render the same visual output
// with controlled state.

function getToolbarTooltips(isMac: boolean) {
  const mod = isMac ? "⌘" : "Ctrl+";
  return {
    bold: `Bold ${mod}B`,
    italic: `Italic ${mod}I`,
    underline: `Underline ${mod}U`,
    strikethrough: "Strikethrough",
    code: "Inline code",
    link: `Link ${mod}K`,
  };
}

function FontFamilyDropdown({ value }: { value: FontFamilyKey }) {
  return (
    <select
      value={value}
      onChange={() => {}}
      className="h-11 sm:h-7 bg-transparent text-xs text-muted-foreground hover:text-foreground focus:text-foreground outline-none cursor-pointer px-1.5 appearance-none"
      aria-label="Font family"
    >
      {FONT_FAMILIES.map((f) => (
        <option key={f.key} value={f.key}>
          {f.label}
        </option>
      ))}
    </select>
  );
}

function ToolbarButton({
  active,
  label,
  children,
}: {
  active: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={`flex h-11 w-11 sm:h-7 sm:w-7 items-center justify-center text-sm ${
              active
                ? "bg-overlay-active text-foreground"
                : "text-muted-foreground hover:bg-overlay-hover hover:text-foreground"
            }`}
            aria-label={label}
            aria-pressed={active}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function StaticFloatingToolbar({
  isBold = false,
  isItalic = false,
  isUnderline = false,
  isStrikethrough = false,
  isCode = false,
  isLink = false,
  fontFamily = "monospace" as FontFamilyKey,
  isMac = true,
}: {
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
  isCode?: boolean;
  isLink?: boolean;
  fontFamily?: FontFamilyKey;
  isMac?: boolean;
}) {
  const tooltips = getToolbarTooltips(isMac);
  return (
    <div className="mx-auto max-w-md">
      <div
        className="inline-flex items-center gap-0.5 border border-overlay-border bg-popover p-1 shadow-md"
        role="toolbar"
        aria-label="Text formatting"
      >
        <FontFamilyDropdown value={fontFamily} />
        <div className="mx-0.5 h-4 w-px bg-overlay-border" aria-hidden="true" />
        <ToolbarButton active={isBold} label={tooltips.bold}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton active={isItalic} label={tooltips.italic}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton active={isUnderline} label={tooltips.underline}>
          <Underline className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton active={isStrikethrough} label={tooltips.strikethrough}>
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton active={isCode} label={tooltips.code}>
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton active={isLink} label={tooltips.link}>
          <Link className="h-4 w-4" />
        </ToolbarButton>
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Editor/FloatingToolbar",
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
};

export { meta as default };

type Story = StoryObj;

/** Default state — toolbar visible with no active formats. Hover buttons to see tooltips with keyboard shortcuts. */
export const Default: Story = {
  render: () => <StaticFloatingToolbar />,
};

/** All format buttons active — bold, italic, underline, strikethrough, code, link. */
export const AllFormatsActive: Story = {
  render: () => (
    <StaticFloatingToolbar
      isBold
      isItalic
      isUnderline
      isStrikethrough
      isCode
      isLink
    />
  ),
};

/** Bold and italic active — common formatting combination. */
export const BoldItalicActive: Story = {
  render: () => <StaticFloatingToolbar isBold isItalic />,
};

/** Link button active — cursor is inside a link node. */
export const LinkActive: Story = {
  render: () => <StaticFloatingToolbar isLink />,
};

/** Toolbar shown in context above a text selection. */
export const InContext: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex justify-center">
        <StaticFloatingToolbar isBold />
      </div>
      <p className="text-sm text-foreground">
        The quick brown fox jumps over the{" "}
        <span className="bg-accent/20 font-bold">lazy dog</span>. This
        demonstrates the toolbar appearing above a text selection with bold
        formatting active.
      </p>
    </div>
  ),
};

/** Font family dropdown showing sans-serif selected. */
export const FontSansSerif: Story = {
  render: () => <StaticFloatingToolbar fontFamily="sans-serif" />,
};

/** Font family dropdown showing serif selected. */
export const FontSerif: Story = {
  render: () => <StaticFloatingToolbar fontFamily="serif" />,
};

/** Font family dropdown showing monospace (default) selected. */
export const FontMonospace: Story = {
  render: () => <StaticFloatingToolbar fontFamily="monospace" />,
};

/** Tooltips with Windows/Linux shortcut format (Ctrl+ prefix). */
export const WindowsShortcuts: Story = {
  render: () => <StaticFloatingToolbar isMac={false} />,
};

/** Tooltips with macOS shortcut format (⌘ prefix). */
export const MacShortcuts: Story = {
  render: () => <StaticFloatingToolbar isMac={true} />,
};
