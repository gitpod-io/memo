import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ImageCropDialog } from "./image-crop-dialog";

const meta: Meta<typeof ImageCropDialog> = {
  title: "Editor/ImageCropDialog",
  component: ImageCropDialog,
  args: {
    open: true,
    onOpenChange: fn(),
    onCropComplete: fn(),
  },
  parameters: {
    layout: "centered",
  },
};

export { meta as default };

type Story = StoryObj<typeof ImageCropDialog>;

/** Default open state with a standard landscape photo. */
export const Default: Story = {
  args: {
    src: "https://picsum.photos/id/10/800/600",
  },
};

/** Landscape image — wider aspect ratio, scales to fit 600×400 canvas area. */
export const LandscapeImage: Story = {
  args: {
    src: "https://picsum.photos/id/29/1200/400",
  },
};

/** Portrait image — taller aspect ratio, scales to fit 600×400 canvas area. */
export const PortraitImage: Story = {
  args: {
    src: "https://picsum.photos/id/64/400/800",
  },
};

/** Small image below the canvas maximum — renders at native size without scaling. */
export const SmallImage: Story = {
  args: {
    src: "https://picsum.photos/id/180/200/150",
  },
};
