import type { Meta, StoryObj } from "@storybook/react";
import { AccountSettingsForm } from "./account-settings-form";

const meta: Meta<typeof AccountSettingsForm> = {
  title: "Account/AccountSettingsForm",
  component: AccountSettingsForm,
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true },
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

type Story = StoryObj<typeof AccountSettingsForm>;

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

export const LongDisplayName: Story = {
  args: {
    userId: "user-456",
    displayName: "A Very Long Display Name That Might Overflow The Input Field",
    email: "longname@example.com",
    avatarUrl: null,
  },
};

export const SingleInitial: Story = {
  args: {
    userId: "user-789",
    displayName: "Bob",
    email: "bob@example.com",
    avatarUrl: null,
  },
};
