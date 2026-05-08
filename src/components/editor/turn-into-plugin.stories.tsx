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

// The TurnIntoPlugin registers the TURN_INTO_COMMAND and defines the block
// type conversion logic. It returns null — the visual menu is rendered by
// TurnIntoMenu (see turn-into-menu.stories.tsx). Stories here show the
// before/after result of block type conversions.

const meta: Meta = {
  title: "Editor/TurnIntoPlugin",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

function BlockTypeLabel({
  icon,
  label,
}: {
  icon: React.ReactElement;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
  );
}

/** Paragraph converted to Heading 1. */
export const ParagraphToHeading1: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-1">
        <BlockTypeLabel icon={<Type className="h-3 w-3" />} label="Before: Paragraph" />
        <p className="text-sm text-foreground">
          This is a paragraph that will be converted.
        </p>
      </div>
      <div className="border-t border-overlay-border" />
      <div className="space-y-1">
        <BlockTypeLabel icon={<Heading1 className="h-3 w-3" />} label="After: Heading 1" />
        <h1 className="text-2xl font-bold text-foreground">
          This is a paragraph that will be converted.
        </h1>
      </div>
    </div>
  ),
};

/** Heading converted to bullet list. */
export const HeadingToBulletList: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-1">
        <BlockTypeLabel icon={<Heading2 className="h-3 w-3" />} label="Before: Heading 2" />
        <h2 className="text-xl font-semibold text-foreground">Section title</h2>
      </div>
      <div className="border-t border-overlay-border" />
      <div className="space-y-1">
        <BlockTypeLabel icon={<List className="h-3 w-3" />} label="After: Bullet List" />
        <ul className="list-disc pl-6 text-sm text-foreground">
          <li>Section title</li>
        </ul>
      </div>
    </div>
  ),
};

/** Paragraph converted to code block. */
export const ParagraphToCodeBlock: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-1">
        <BlockTypeLabel icon={<Type className="h-3 w-3" />} label="Before: Paragraph" />
        <p className="text-sm text-foreground">const x = 42;</p>
      </div>
      <div className="border-t border-overlay-border" />
      <div className="space-y-1">
        <BlockTypeLabel icon={<Code className="h-3 w-3" />} label="After: Code Block" />
        <pre className="rounded-sm bg-muted p-3 text-sm text-foreground">
          <code>const x = 42;</code>
        </pre>
      </div>
    </div>
  ),
};

/** Paragraph converted to blockquote. */
export const ParagraphToQuote: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-1">
        <BlockTypeLabel icon={<Type className="h-3 w-3" />} label="Before: Paragraph" />
        <p className="text-sm text-foreground">
          An important statement worth highlighting.
        </p>
      </div>
      <div className="border-t border-overlay-border" />
      <div className="space-y-1">
        <BlockTypeLabel icon={<Quote className="h-3 w-3" />} label="After: Quote" />
        <blockquote className="border-l-2 border-muted-foreground/30 pl-4 text-sm italic text-muted-foreground">
          An important statement worth highlighting.
        </blockquote>
      </div>
    </div>
  ),
};

/** Available block types for conversion. */
export const AvailableBlockTypes: Story = {
  render: () => (
    <div className="mx-auto max-w-md">
      <div className="rounded-sm border border-overlay-border bg-popover p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">
          Supported block types
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: <Type className="h-4 w-4" />, label: "Paragraph" },
            { icon: <Heading1 className="h-4 w-4" />, label: "Heading 1" },
            { icon: <Heading2 className="h-4 w-4" />, label: "Heading 2" },
            { icon: <Heading3 className="h-4 w-4" />, label: "Heading 3" },
            { icon: <List className="h-4 w-4" />, label: "Bullet List" },
            { icon: <ListOrdered className="h-4 w-4" />, label: "Numbered List" },
            { icon: <CheckSquare className="h-4 w-4" />, label: "To-do List" },
            { icon: <Quote className="h-4 w-4" />, label: "Quote" },
            { icon: <Code className="h-4 w-4" />, label: "Code Block" },
            { icon: <MessageSquare className="h-4 w-4" />, label: "Callout" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
};
