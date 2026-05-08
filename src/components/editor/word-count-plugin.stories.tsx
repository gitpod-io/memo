import type { Meta, StoryObj } from "@storybook/react";
import { formatWordCountDisplay } from "@/lib/word-count";

// The WordCountPlugin displays a word count and estimated reading time below
// the editor. It requires Lexical context — stories show the static visual
// output for different word counts.

const meta: Meta = {
  title: "Editor/WordCountPlugin",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

function StaticWordCount({ wordCount }: { wordCount: number }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mt-8 text-xs text-muted-foreground">
        {formatWordCountDisplay(wordCount)}
      </div>
    </div>
  );
}

/** Empty document — zero words. */
export const Empty: Story = {
  render: () => <StaticWordCount wordCount={0} />,
};

/** Short document — a few words. */
export const ShortDocument: Story = {
  render: () => <StaticWordCount wordCount={42} />,
};

/** Medium document — a few hundred words. */
export const MediumDocument: Story = {
  render: () => <StaticWordCount wordCount={350} />,
};

/** Long document — over a thousand words. */
export const LongDocument: Story = {
  render: () => <StaticWordCount wordCount={2500} />,
};

/** Word count shown in context below editor content. */
export const InContext: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <div className="space-y-3 text-sm text-foreground">
        <h1 className="text-2xl font-bold">Document Title</h1>
        <p>
          This is a sample paragraph to show how the word count appears below
          the editor content. The count updates as you type.
        </p>
        <p>
          Each paragraph contributes to the total word count. Code blocks are
          excluded from the count.
        </p>
      </div>
      <div className="mt-8 text-xs text-muted-foreground">
        {formatWordCountDisplay(38)}
      </div>
    </div>
  ),
};
