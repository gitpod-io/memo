import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ImageCropDialog } from "./image-crop-dialog";

// Static sample images from picsum.photos (deterministic by ID)
const SAMPLE_LANDSCAPE = "https://picsum.photos/id/10/800/600";
const SAMPLE_PORTRAIT = "https://picsum.photos/id/11/600/900";
const SAMPLE_SMALL = "https://picsum.photos/id/12/30/30";

const meta: Meta<typeof ImageCropDialog> = {
  title: "Editor/ImageCropDialog",
  component: ImageCropDialog,
  parameters: {
    layout: "centered",
  },
  args: {
    open: true,
    src: SAMPLE_LANDSCAPE,
    onOpenChange: fn(),
    onCropComplete: fn(),
  },
};

export { meta as default };

type Story = StoryObj<typeof ImageCropDialog>;

/** Default open state with a landscape image. Canvas renders at ≤600×400. */
export const Default: Story = {};

/** Portrait image — canvas height is the constraining dimension. */
export const PortraitImage: Story = {
  args: {
    src: SAMPLE_PORTRAIT,
  },
};

/** Landscape image (same as Default, explicit for completeness). */
export const LandscapeImage: Story = {
  args: {
    src: SAMPLE_LANDSCAPE,
  },
};

/**
 * Very small image (30×30). The canvas displays at native size since it's
 * already below the 600×400 max. Drawing a crop region larger than 10×10
 * display pixels is difficult, demonstrating the minimum-size edge case.
 */
export const SmallImage: Story = {
  args: {
    src: SAMPLE_SMALL,
  },
};
