import type { Meta, StoryObj } from "@storybook/react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Download,
  Crop,
} from "lucide-react";

// The FloatingImageToolbarPlugin renders a toolbar above selected images with
// alignment, expand, download, and crop actions. It requires Lexical context —
// stories show the static visual output of the toolbar.

const meta: Meta = {
  title: "Editor/FloatingImageToolbar",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

function ToolbarButton({
  active = false,
  label,
  children,
}: {
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`flex h-11 w-11 sm:h-7 sm:w-7 items-center justify-center ${
        active
          ? "bg-overlay-active text-foreground"
          : "text-muted-foreground hover:bg-overlay-hover hover:text-foreground"
      }`}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function StaticImageToolbar({
  alignment = "center",
}: {
  alignment?: "left" | "center" | "right";
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-sm border border-overlay-border bg-popover px-1 py-0.5 shadow-md">
      <ToolbarButton active={alignment === "left"} label="Align left">
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton active={alignment === "center"} label="Align center">
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton active={alignment === "right"} label="Align right">
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>
      <div className="mx-0.5 h-4 w-px bg-overlay-border" />
      <ToolbarButton label="Expand image">
        <Maximize2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Download image">
        <Download className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Crop image">
        <Crop className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

/** Toolbar with center alignment active (default). */
export const CenterAligned: Story = {
  render: () => (
    <div className="mx-auto max-w-md space-y-2">
      <StaticImageToolbar alignment="center" />
      <div className="flex justify-center">
        <div className="h-40 w-64 rounded bg-muted ring-2 ring-accent" />
      </div>
    </div>
  ),
};

/** Toolbar with left alignment active. */
export const LeftAligned: Story = {
  render: () => (
    <div className="mx-auto max-w-md space-y-2">
      <StaticImageToolbar alignment="left" />
      <div className="flex justify-start">
        <div className="h-40 w-64 rounded bg-muted ring-2 ring-accent" />
      </div>
    </div>
  ),
};

/** Toolbar with right alignment active. */
export const RightAligned: Story = {
  render: () => (
    <div className="mx-auto max-w-md space-y-2">
      <div className="flex justify-end">
        <StaticImageToolbar alignment="right" />
      </div>
      <div className="flex justify-end">
        <div className="h-40 w-64 rounded bg-muted ring-2 ring-accent" />
      </div>
    </div>
  ),
};

/** Toolbar shown in context above a selected image. */
export const InContext: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl space-y-4">
      <p className="text-sm text-foreground">
        Some text content above the image.
      </p>
      <div className="flex flex-col items-center gap-2">
        <StaticImageToolbar alignment="center" />
        <div className="relative">
          <img
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23374151' width='400' height='200'/%3E%3Ctext fill='%239CA3AF' x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-size='14'%3ESample Image%3C/text%3E%3C/svg%3E"
            alt="Sample"
            className="rounded ring-2 ring-accent"
          />
        </div>
      </div>
      <p className="text-sm text-foreground">
        Some text content below the image.
      </p>
    </div>
  ),
};
