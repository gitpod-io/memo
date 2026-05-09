import type { Meta, StoryObj } from "@storybook/react";
import { AccountPageClient } from "./account-page-client";

const meta: Meta<typeof AccountPageClient> = {
  title: "Account/AccountPageClient",
  component: AccountPageClient,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-xl">
        <Story />
      </div>
    ),
  ],
};

export { meta as default };

type Story = StoryObj<typeof AccountPageClient>;

export const Default: Story = {
  args: {
    userId: "user-123",
    displayName: "Alice Johnson",
    email: "alice@example.com",
    avatarUrl: null,
  },
};

export const WithAvatar: Story = {
  args: {
    userId: "user-123",
    displayName: "Alice Johnson",
    email: "alice@example.com",
    avatarUrl: "https://i.pravatar.cc/150?u=alice",
  },
};
