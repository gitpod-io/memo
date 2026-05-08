import type { Meta, StoryObj } from "@storybook/react";

// The ImageNode is a Lexical DecoratorNode that renders images with alignment,
// caption, and resize handles. It requires Lexical context — stories show the
// static visual output of the image node in different states.

const meta: Meta = {
  title: "Editor/ImageNode",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

const PLACEHOLDER_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='250'%3E%3Crect fill='%23374151' width='400' height='250'/%3E%3Ctext fill='%239CA3AF' x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-size='14'%3ESample Image%3C/text%3E%3C/svg%3E";

function StaticImageNode({
  src = PLACEHOLDER_SRC,
  alt = "Sample image",
  alignment = "center",
  caption,
  selected = false,
  showResizeHandles = false,
}: {
  src?: string;
  alt?: string;
  alignment?: "left" | "center" | "right";
  caption?: string;
  selected?: boolean;
  showResizeHandles?: boolean;
}) {
  const alignmentClass =
    alignment === "left"
      ? "items-start"
      : alignment === "right"
        ? "items-end"
        : "items-center";

  return (
    <div className={`mx-auto max-w-2xl mt-3 flex flex-col ${alignmentClass}`}>
      <div className="relative inline-block">
        <img
          src={src}
          alt={alt}
          className={`max-w-full ${selected ? "ring-2 ring-accent" : ""}`}
          draggable={false}
        />
        {showResizeHandles && (
          <>
            <div className="absolute -bottom-1.5 -right-1.5 h-3 w-3 bg-accent cursor-se-resize" />
            <div className="absolute -bottom-1.5 -left-1.5 h-3 w-3 bg-accent cursor-sw-resize" />
            <div className="absolute -top-1.5 -right-1.5 h-3 w-3 bg-accent cursor-ne-resize" />
            <div className="absolute -top-1.5 -left-1.5 h-3 w-3 bg-accent cursor-nw-resize" />
          </>
        )}
      </div>
      {caption ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {caption}
        </p>
      ) : (
        selected && (
          <p className="mt-2 cursor-pointer text-center text-xs text-muted-foreground hover:text-foreground">
            Add a caption
          </p>
        )
      )}
    </div>
  );
}

/** Default image — center aligned, not selected. */
export const Default: Story = {
  render: () => <StaticImageNode />,
};

/** Selected image with accent ring and resize handles. */
export const Selected: Story = {
  render: () => <StaticImageNode selected showResizeHandles />,
};

/** Image with a caption. */
export const WithCaption: Story = {
  render: () => (
    <StaticImageNode caption="A descriptive caption for this image." />
  ),
};

/** Left-aligned image. */
export const LeftAligned: Story = {
  render: () => <StaticImageNode alignment="left" />,
};

/** Right-aligned image. */
export const RightAligned: Story = {
  render: () => <StaticImageNode alignment="right" />,
};

/** Selected image with caption and resize handles. */
export const SelectedWithCaption: Story = {
  render: () => (
    <StaticImageNode
      selected
      showResizeHandles
      caption="Click to edit this caption."
    />
  ),
};
