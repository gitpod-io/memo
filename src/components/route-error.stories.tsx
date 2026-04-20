import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { RouteError } from "./route-error";

const meta: Meta<typeof RouteError> = {
  title: "Components/RouteError",
  component: RouteError,
  parameters: {
    layout: "fullscreen",
  },
};

export { meta as default };

type Story = StoryObj<typeof RouteError>;

export const Default: Story = {
  args: {
    error: Object.assign(new Error("Something went wrong"), {
      digest: "abc123",
    }),
    reset: fn(),
  },
};
