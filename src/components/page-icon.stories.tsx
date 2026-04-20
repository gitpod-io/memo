import type { Meta, StoryObj } from "@storybook/react";
import { SmilePlus } from "lucide-react";

// PageIcon depends on Supabase and EmojiPicker (floating-ui).
// These stories render the visual states with static markup.

const meta: Meta = {
  title: "Components/PageIcon",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

export const WithIcon: Story = {
  render: () => (
    <div className="mb-2">
      <button
        className="flex min-h-11 min-w-11 items-center justify-center rounded-sm text-4xl leading-none hover:bg-white/[0.04] sm:min-h-10 sm:min-w-10"
        aria-label="Page icon: 📄. Click to change"
      >
        📄
      </button>
    </div>
  ),
};

export const WithEmojiIcon: Story = {
  render: () => (
    <div className="mb-2">
      <button
        className="flex min-h-11 min-w-11 items-center justify-center rounded-sm text-4xl leading-none hover:bg-white/[0.04] sm:min-h-10 sm:min-w-10"
        aria-label="Page icon: 🚀. Click to change"
      >
        🚀
      </button>
    </div>
  ),
};

export const WithoutIcon: Story = {
  render: () => (
    <div className="mb-1 opacity-100">
      <button
        className="flex min-h-11 items-center gap-1 rounded-sm px-1.5 text-xs text-muted-foreground hover:bg-white/[0.04] sm:min-h-7"
        aria-label="Add page icon"
      >
        <SmilePlus className="h-3.5 w-3.5" />
        <span>Add icon</span>
      </button>
    </div>
  ),
};
