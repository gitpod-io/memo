import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ImageExpandDialog } from "./image-expand-dialog";

const SAMPLE_LANDSCAPE = "https://picsum.photos/id/10/800/600";
const SAMPLE_LARGE = "https://picsum.photos/id/15/2400/1600";

const meta: Meta<typeof ImageExpandDialog> = {
  title: "Editor/ImageExpandDialog",
  component: ImageExpandDialog,
  parameters: {
    layout: "centered",
  },
  args: {
    open: true,
    src: SAMPLE_LANDSCAPE,
    onOpenChange: fn(),
  },
};

export { meta as default };

type Story = StoryObj<typeof ImageExpandDialog>;

/** Default open state with a landscape sample image. */
export const Default: Story = {};

/** Large image wider than the viewport — should be constrained by max-w/max-h. */
export const LargeImage: Story = {
  args: {
    src: SAMPLE_LARGE,
  },
};
