import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { type FontFamilyKey, FONT_FAMILIES } from "@/components/editor/font-family";

function FontFamilyDropdown({
  value,
  onChange,
}: {
  value: FontFamilyKey;
  onChange?: (key: FontFamilyKey) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange?.(e.target.value as FontFamilyKey)}
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

function InteractiveFontDemo() {
  const [font, setFont] = useState<FontFamilyKey>("monospace");

  const fontStyle = (() => {
    switch (font) {
      case "sans-serif":
        return { fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" };
      case "serif":
        return { fontFamily: "Georgia, 'Times New Roman', serif" };
      default:
        return {};
    }
  })();

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-2 border border-overlay-border bg-popover p-2">
        <span className="text-xs text-muted-foreground">Font:</span>
        <FontFamilyDropdown value={font} onChange={setFont} />
      </div>
      <p className="text-sm text-foreground" style={fontStyle}>
        The quick brown fox jumps over the lazy dog. This text changes font
        family based on the dropdown selection above.
      </p>
    </div>
  );
}

const meta: Meta = {
  title: "Editor/FontFamilySelector",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** Default state — monospace selected. */
export const Default: Story = {
  render: () => (
    <div className="inline-flex border border-overlay-border bg-popover p-1">
      <FontFamilyDropdown value="monospace" />
    </div>
  ),
};

/** Sans-serif selected. */
export const SansSerif: Story = {
  render: () => (
    <div className="inline-flex border border-overlay-border bg-popover p-1">
      <FontFamilyDropdown value="sans-serif" />
    </div>
  ),
};

/** Serif selected. */
export const Serif: Story = {
  render: () => (
    <div className="inline-flex border border-overlay-border bg-popover p-1">
      <FontFamilyDropdown value="serif" />
    </div>
  ),
};

/** Interactive demo showing font change applied to text. */
export const Interactive: Story = {
  render: () => <InteractiveFontDemo />,
};
