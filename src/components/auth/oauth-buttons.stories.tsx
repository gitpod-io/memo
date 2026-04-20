import type { Meta, StoryObj } from "@storybook/react";
import { OAuthButtons } from "./oauth-buttons";

const meta: Meta<typeof OAuthButtons> = {
  title: "Auth/OAuthButtons",
  component: OAuthButtons,
};

export { meta as default };

type Story = StoryObj<typeof OAuthButtons>;

export const Default: Story = {};
