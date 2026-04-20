import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within, waitFor } from "@storybook/test";
import { EmojiPicker } from "./emoji-picker";

const meta: Meta<typeof EmojiPicker> = {
  title: "Components/EmojiPicker",
  component: EmojiPicker,
};

export { meta as default };

type Story = StoryObj<typeof EmojiPicker>;

function EmojiPickerDemo({
  hasIcon,
  initialEmoji,
}: {
  hasIcon: boolean;
  initialEmoji?: string;
}) {
  const [open, setOpen] = useState(false);
  const [emoji, setEmoji] = useState<string | null>(initialEmoji ?? null);

  return (
    <EmojiPicker
      open={open}
      onOpenChange={setOpen}
      onSelect={(e) => setEmoji(e)}
      onRemove={() => setEmoji(null)}
      hasIcon={hasIcon}
    >
      <button
        data-testid="emoji-trigger"
        className="flex min-h-11 min-w-11 items-center justify-center rounded-sm text-4xl leading-none hover:bg-white/[0.04]"
      >
        {emoji ?? "➕"}
      </button>
    </EmojiPicker>
  );
}

export const Closed: Story = {
  args: {
    open: false,
    onOpenChange: fn(),
    onSelect: fn(),
    hasIcon: false,
    children: (
      <button className="flex min-h-11 min-w-11 items-center justify-center rounded-sm text-4xl leading-none hover:bg-white/[0.04]">
        ➕
      </button>
    ),
  },
};

export const Interactive: Story = {
  render: () => <EmojiPickerDemo hasIcon={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("emoji-trigger");

    // Open the picker
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(canvas.getByText("Smileys")).toBeVisible();
    });

    // Close by clicking trigger again
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(canvas.queryByText("Smileys")).not.toBeInTheDocument();
    });
  },
};

export const WithExistingIcon: Story = {
  render: () => <EmojiPickerDemo hasIcon initialEmoji="🚀" />,
};
