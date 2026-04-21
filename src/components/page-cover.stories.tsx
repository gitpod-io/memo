import type { Meta, StoryObj } from "@storybook/react";
import { ImagePlus, Replace, ImageOff } from "lucide-react";

// PageCover depends on Supabase for upload/save.
// These stories render the visual states with static markup.

const meta: Meta = {
  title: "Components/PageCover",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

// Inline 1x1 teal SVG to avoid external network requests in visual regression tests
const PLACEHOLDER_COVER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='400'%3E%3Crect fill='%23234' width='1200' height='400'/%3E%3C/svg%3E";

export const WithCover: Story = {
  render: () => (
    <div className="group/cover relative -mx-6 -mt-6 mb-6">
      <div className="relative h-[200px] w-full overflow-hidden">
        <img
          src={PLACEHOLDER_COVER}
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </div>
      <div className="absolute right-4 top-4 flex gap-1 opacity-100">
        <button className="flex h-7 items-center gap-1.5 bg-background/80 px-2 text-xs text-muted-foreground backdrop-blur-sm hover:bg-background/90 hover:text-foreground">
          Cover
        </button>
      </div>
    </div>
  ),
};

export const WithCoverMenuOpen: Story = {
  render: () => (
    <div className="group/cover relative -mx-6 -mt-6 mb-6">
      <div className="relative h-[200px] w-full overflow-hidden">
        <img
          src={PLACEHOLDER_COVER}
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </div>
      <div className="absolute right-4 top-4 flex gap-1 opacity-100">
        <button className="flex h-7 items-center gap-1.5 bg-background/80 px-2 text-xs text-muted-foreground backdrop-blur-sm hover:bg-background/90 hover:text-foreground">
          Cover
        </button>
      </div>
      {/* Static representation of the dropdown menu */}
      <div className="absolute right-4 top-12 z-50 min-w-32 bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
        <div className="flex cursor-default items-center gap-1.5 px-1.5 py-1 text-sm hover:bg-accent hover:text-accent-foreground">
          <Replace className="h-4 w-4" />
          Change cover
        </div>
        <div className="flex cursor-default items-center gap-1.5 px-1.5 py-1 text-sm text-destructive hover:bg-destructive/10">
          <ImageOff className="h-4 w-4" />
          Remove cover
        </div>
      </div>
    </div>
  ),
};

export const WithoutCover: Story = {
  render: () => (
    <div className="mb-1 opacity-100">
      <button
        className="flex min-h-11 items-center gap-1 rounded-sm px-1.5 text-xs text-muted-foreground hover:bg-white/[0.04] sm:min-h-7"
        aria-label="Add cover image"
      >
        <ImagePlus className="h-3.5 w-3.5" />
        <span>Add cover</span>
      </button>
    </div>
  ),
};

export const Uploading: Story = {
  render: () => (
    <div className="mb-1 opacity-100">
      <button
        className="flex min-h-11 items-center gap-1 rounded-sm px-1.5 text-xs text-muted-foreground hover:bg-white/[0.04] sm:min-h-7"
        aria-label="Add cover image"
        disabled
      >
        <ImagePlus className="h-3.5 w-3.5" />
        <span>Uploading…</span>
      </button>
    </div>
  ),
};
