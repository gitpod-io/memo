import type { Meta, StoryObj } from "@storybook/react";
import { ChevronRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Static mock of CollapsibleContainerNode / CollapsibleTitleNode /
// CollapsibleContentNode for Storybook (no Lexical runtime).
// Mirrors the DOM structure and classes from the real node createDOM() methods.
// ---------------------------------------------------------------------------

interface CollapsibleMockProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
}

function CollapsibleMock({ open, title, children }: CollapsibleMockProps) {
  return (
    <details
      className="mt-3 border border-overlay-border text-sm rounded-sm"
      open={open}
    >
      {/* CollapsibleTitleNode → <summary> */}
      <summary className="flex items-center gap-1.5 p-3 text-sm font-medium text-foreground hover:bg-overlay-hover list-none cursor-pointer">
        <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-overlay-active transition-transform duration-150">
          <ChevronRight
            className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          />
        </span>
        {title}
      </summary>

      {/* CollapsibleContentNode → <div> */}
      <div className="border-t border-overlay-border p-3 text-sm">
        {children}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Storybook meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof CollapsibleMock> = {
  title: "Editor/Collapsible",
  component: CollapsibleMock,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl bg-background p-6 text-foreground">
        <p className="text-sm">
          Some editor content above the collapsible block.
        </p>
        <Story />
        <p className="text-sm mt-2">
          More editor content below the collapsible block.
        </p>
      </div>
    ),
  ],
};

export { meta as default };
type Story = StoryObj<typeof CollapsibleMock>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Collapsed: Story = {
  args: {
    open: false,
    title: "Click to expand",
    children: "This content is hidden when the section is collapsed.",
  },
};

export const Expanded: Story = {
  args: {
    open: true,
    title: "Section title",
    children:
      "This content is visible because the collapsible section is open. Users can click the chevron or summary to toggle visibility.",
  },
};

export const WithNestedContent: Story = {
  args: {
    open: true,
    title: "Project details",
  },
  render: (args) => (
    <CollapsibleMock open={args.open} title={args.title}>
      <div className="space-y-2">
        <p>
          This collapsible contains multiple paragraphs and nested elements to
          demonstrate how richer content renders inside the content area.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>First item in a nested list</li>
          <li>Second item with more detail</li>
          <li>Third item to show list rendering</li>
        </ul>
        <p className="text-muted-foreground">
          Additional context or notes can follow the list.
        </p>
      </div>
    </CollapsibleMock>
  ),
};

export const LongTitle: Story = {
  args: {
    open: false,
    title:
      "This is a very long collapsible title that might wrap to multiple lines depending on the container width",
    children: "Content inside a collapsible with a long title.",
  },
};

export const MultipleCollapsibles: Story = {
  render: () => (
    <div className="space-y-0">
      <CollapsibleMock open={false} title="Getting started">
        Follow these steps to set up your development environment.
      </CollapsibleMock>
      <CollapsibleMock open={true} title="Configuration">
        Edit the config file to customize behavior. The default settings work
        for most use cases.
      </CollapsibleMock>
      <CollapsibleMock open={false} title="Troubleshooting">
        Common issues and their solutions are listed here.
      </CollapsibleMock>
    </div>
  ),
};
