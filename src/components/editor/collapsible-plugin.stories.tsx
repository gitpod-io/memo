import type { Meta, StoryObj } from "@storybook/react";
import { ChevronRight } from "lucide-react";

// The CollapsiblePlugin registers INSERT_COLLAPSIBLE_COMMAND and handles
// Enter key behavior inside collapsible nodes. It returns null — stories
// show the visual output of collapsible/toggle blocks.

const meta: Meta = {
  title: "Editor/CollapsiblePlugin",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

function StaticCollapsible({
  title,
  open,
  children,
}: {
  title: string;
  open: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-sm border border-overlay-border">
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-overlay-hover"
          aria-expanded={open}
        >
          <ChevronRight
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
          {title}
        </button>
        {open && (
          <div className="border-t border-overlay-border px-3 py-2 pl-9 text-sm text-foreground">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

/** Collapsed toggle — content hidden, chevron pointing right. */
export const Collapsed: Story = {
  render: () => (
    <StaticCollapsible title="Click to expand" open={false} />
  ),
};

/** Expanded toggle — content visible, chevron rotated down. */
export const Expanded: Story = {
  render: () => (
    <StaticCollapsible title="Toggle section" open>
      This content is visible when the toggle is expanded. You can add any
      block content inside a collapsible section.
    </StaticCollapsible>
  ),
};

/** Nested collapsible toggles. */
export const Nested: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl space-y-2">
      <div className="rounded-sm border border-overlay-border">
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-overlay-hover"
          aria-expanded={true}
        >
          <ChevronRight className="h-4 w-4 rotate-90 text-muted-foreground" />
          Outer toggle
        </button>
        <div className="border-t border-overlay-border px-3 py-2 pl-9 text-sm text-foreground">
          <p className="mb-2">Outer content with a nested toggle below:</p>
          <div className="rounded-sm border border-overlay-border">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-overlay-hover"
              aria-expanded={false}
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              Inner toggle (collapsed)
            </button>
          </div>
        </div>
      </div>
    </div>
  ),
};

/** Empty toggle — just created, no content yet. */
export const EmptyExpanded: Story = {
  render: () => (
    <StaticCollapsible title="" open>
      <span className="text-muted-foreground">Type content here…</span>
    </StaticCollapsible>
  ),
};
