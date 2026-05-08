import type { Meta, StoryObj } from "@storybook/react";
import { ImageIcon, Upload } from "lucide-react";

// The ImagePlugin handles INSERT_IMAGE_COMMAND, drag-and-drop image uploads,
// and file validation. It returns null — stories show the visual states of
// image upload interactions.

const meta: Meta = {
  title: "Editor/ImagePlugin",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** Drag-and-drop overlay shown when dragging an image file over the editor. */
export const DragOverlay: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <div className="relative rounded-sm border-2 border-dashed border-accent bg-accent/5 p-12">
        <div className="flex flex-col items-center gap-3 text-center">
          <Upload className="h-8 w-8 text-accent" />
          <p className="text-sm font-medium text-foreground">
            Drop image to upload
          </p>
          <p className="text-xs text-muted-foreground">
            PNG, JPEG, GIF, WebP, or SVG — max 5 MB
          </p>
        </div>
      </div>
    </div>
  ),
};

/** Upload in progress — placeholder shown while image uploads. */
export const UploadInProgress: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <div className="mt-3 flex flex-col items-center">
        <div className="relative inline-block">
          <div className="flex h-48 w-72 items-center justify-center rounded bg-muted">
            <div className="flex flex-col items-center gap-2">
              <ImageIcon className="h-6 w-6 animate-pulse text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Uploading…</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
};

/** Upload error — file too large or unsupported type. */
export const UploadError: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">
          Image is too large. Maximum size is 5 MB.
        </p>
      </div>
    </div>
  ),
};

/** Supported file types reference. */
export const SupportedTypes: Story = {
  render: () => (
    <div className="mx-auto max-w-md">
      <div className="rounded-sm border border-overlay-border bg-popover p-4">
        <h3 className="text-sm font-medium text-foreground mb-2">
          Supported image types
        </h3>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {["PNG", "JPEG", "GIF", "WebP", "SVG"].map((type) => (
            <li key={type} className="flex items-center gap-2">
              <ImageIcon className="h-3 w-3" />
              {type}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Maximum file size: 5 MB
        </p>
      </div>
    </div>
  ),
};
