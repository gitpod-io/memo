import type { Meta, StoryObj } from "@storybook/react";
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Quote,
  MessageSquare,
} from "lucide-react";

const meta: Meta = {
  title: "Editor/TurnIntoMenu",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

interface MenuOption {
  label: string;
  icon: React.ReactElement;
}

function StaticTurnIntoMenu({
  options,
  highlightedIndex = -1,
  title = "Turn into",
}: {
  options: MenuOption[];
  highlightedIndex?: number;
  title?: string;
}) {
  return (
    <div className="mx-auto max-w-xs">
      <div className="max-h-[300px] w-56 overflow-y-auto rounded-sm border border-overlay-border bg-popover p-1 shadow-md">
        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
          {title}
        </div>
        {options.map((option, index) => (
          <button
            key={option.label}
            type="button"
            className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm outline-none ${
              highlightedIndex === index
                ? "bg-overlay-active text-foreground"
                : "text-muted-foreground hover:bg-overlay-hover"
            }`}
            role="option"
            aria-selected={highlightedIndex === index}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground">
              {option.icon}
            </span>
            <span className="text-sm font-medium text-foreground">
              {option.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const paragraphTargets: MenuOption[] = [
  { label: "Heading 1", icon: <Heading1 className="h-4 w-4" /> },
  { label: "Heading 2", icon: <Heading2 className="h-4 w-4" /> },
  { label: "Heading 3", icon: <Heading3 className="h-4 w-4" /> },
  { label: "Bullet List", icon: <List className="h-4 w-4" /> },
  { label: "Numbered List", icon: <ListOrdered className="h-4 w-4" /> },
  { label: "To-do List", icon: <CheckSquare className="h-4 w-4" /> },
  { label: "Quote", icon: <Quote className="h-4 w-4" /> },
  { label: "Code Block", icon: <Code className="h-4 w-4" /> },
  { label: "Callout", icon: <MessageSquare className="h-4 w-4" /> },
];

/** All targets available when the source block is a paragraph. */
export const FromParagraph: Story = {
  render: () => (
    <StaticTurnIntoMenu options={paragraphTargets} title="Turn into" />
  ),
};

/** Highlighted state — Heading 1 is focused. */
export const WithHighlight: Story = {
  render: () => (
    <StaticTurnIntoMenu
      options={paragraphTargets}
      highlightedIndex={0}
      title="Turn into"
    />
  ),
};

const headingTargets: MenuOption[] = [
  { label: "Paragraph", icon: <Type className="h-4 w-4" /> },
  { label: "Heading 2", icon: <Heading2 className="h-4 w-4" /> },
  { label: "Heading 3", icon: <Heading3 className="h-4 w-4" /> },
  { label: "Quote", icon: <Quote className="h-4 w-4" /> },
];

/** Targets available when the source block is a Heading 1. */
export const FromHeading1: Story = {
  render: () => (
    <StaticTurnIntoMenu options={headingTargets} title="Turn into" />
  ),
};

const listTargets: MenuOption[] = [
  { label: "Numbered List", icon: <ListOrdered className="h-4 w-4" /> },
  { label: "To-do List", icon: <CheckSquare className="h-4 w-4" /> },
  { label: "Paragraph", icon: <Type className="h-4 w-4" /> },
];

/** Targets available when the source block is a bullet list. */
export const FromBulletList: Story = {
  render: () => (
    <StaticTurnIntoMenu options={listTargets} title="Turn into" />
  ),
};

const codeTargets: MenuOption[] = [
  { label: "Paragraph", icon: <Type className="h-4 w-4" /> },
];

/** Targets available when the source block is a code block. */
export const FromCodeBlock: Story = {
  render: () => (
    <StaticTurnIntoMenu options={codeTargets} title="Turn into" />
  ),
};

/** Empty state when no transformations are available. */
export const NoTransformations: Story = {
  render: () => (
    <div className="mx-auto max-w-xs">
      <div className="max-h-[300px] w-56 overflow-y-auto rounded-sm border border-overlay-border bg-popover p-1 shadow-md">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          No transformations available
        </div>
      </div>
    </div>
  ),
};
