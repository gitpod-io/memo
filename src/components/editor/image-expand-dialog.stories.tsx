import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ImageExpandDialog } from "./image-expand-dialog";

const meta: Meta<typeof ImageExpandDialog> = {
  title: "Editor/ImageExpandDialog",
  component: ImageExpandDialog,
  args: {
    open: true,
    onOpenChange: fn(),
  },
  parameters: {
    layout: "fullscreen",
  },
};

export { meta as default };

type Story = StoryObj<typeof ImageExpandDialog>;

/** Lightbox overlay with a standard landscape photo. */
export const Default: Story = {
  args: {
    src: "https://picsum.photos/id/10/800/600",
  },
};

/** Image wider than the viewport — constrained by max-w-[90vw]. */
export const LargeImage: Story = {
  args: {
    src: "https://picsum.photos/id/15/2400/1600",
  },
};
