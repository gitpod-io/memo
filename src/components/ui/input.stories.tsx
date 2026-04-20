import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";
import { Label } from "./label";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
};

export { meta as default };

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: "Type something…",
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex flex-col gap-1.5 w-64">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="you@example.com" />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    placeholder: "Disabled input",
    disabled: true,
  },
};

export const Invalid: Story = {
  args: {
    placeholder: "Invalid input",
    "aria-invalid": true,
    defaultValue: "bad value",
  },
};

export const WithValue: Story = {
  args: {
    defaultValue: "Hello world",
  },
};

export const Password: Story = {
  args: {
    type: "password",
    placeholder: "Enter password",
  },
};
