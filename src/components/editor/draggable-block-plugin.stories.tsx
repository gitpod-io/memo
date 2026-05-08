import type { Meta, StoryObj } from "@storybook/react";
import { GripVertical } from "lucide-react";

// The DraggableBlockPlugin renders a drag handle and turn-into menu on hover
// over editor blocks. It requires Lexical context and DOM positioning — stories
// show the static visual output of the drag handle and drop indicator.

const meta: Meta = {
  title: "Editor/DraggableBlockPlugin",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

function StaticEditorBlock({
  children,
  showHandle = false,
}: {
  children: React.ReactNode;
  showHandle?: boolean;
}) {
  return (
    <div className="relative pl-8">
      {showHandle && (
        <div
          className="memo-draggable-block-menu absolute left-0 top-0.5 flex h-5 w-5 cursor-grab items-center justify-center"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </div>
      )}
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

/** Drag handle visible on block hover. */
export const HandleVisible: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl space-y-2">
      <StaticEditorBlock showHandle>
        <p>
          Hover over a block to see the drag handle on the left. Click and drag
          to reorder blocks.
        </p>
      </StaticEditorBlock>
      <StaticEditorBlock>
        <p>This block does not have the handle visible (not hovered).</p>
      </StaticEditorBlock>
    </div>
  ),
};

/** Multiple blocks with one being dragged — drop indicator shown. */
export const DragInProgress: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl space-y-2">
      <StaticEditorBlock>
        <p>First paragraph block.</p>
      </StaticEditorBlock>
      <div className="memo-drop-indicator h-0.5 bg-accent" />
      <StaticEditorBlock showHandle>
        <p className="opacity-50">This block is being dragged.</p>
      </StaticEditorBlock>
      <StaticEditorBlock>
        <p>Third paragraph block.</p>
      </StaticEditorBlock>
    </div>
  ),
};

/** Handle hidden — block not hovered. */
export const HandleHidden: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl space-y-2">
      <StaticEditorBlock>
        <p>
          The drag handle is hidden when the mouse is not near the block.
        </p>
      </StaticEditorBlock>
      <StaticEditorBlock>
        <p>Move your mouse to the left edge of a block to reveal it.</p>
      </StaticEditorBlock>
    </div>
  ),
};

/** Handle on different block types. */
export const DifferentBlockTypes: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl space-y-3">
      <StaticEditorBlock showHandle>
        <h2 className="text-xl font-semibold">Heading block</h2>
      </StaticEditorBlock>
      <StaticEditorBlock showHandle>
        <p>Paragraph block with some text content.</p>
      </StaticEditorBlock>
      <StaticEditorBlock showHandle>
        <ul className="list-disc pl-5">
          <li>List item one</li>
          <li>List item two</li>
        </ul>
      </StaticEditorBlock>
      <StaticEditorBlock showHandle>
        <blockquote className="border-l-2 border-muted-foreground/30 pl-4 italic text-muted-foreground">
          A blockquote block.
        </blockquote>
      </StaticEditorBlock>
    </div>
  ),
};
