import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, waitFor } from "@storybook/test";
import { Label } from "./label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

const meta: Meta = {
  title: "UI/Select",
};

export { meta as default };

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Select defaultValue="member">
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="owner">Owner</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="member">Member</SelectItem>
      </SelectContent>
    </Select>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Trigger shows current value
    const trigger = canvas.getByRole("combobox");
    expect(trigger).toHaveTextContent("Member");

    // Open the popover
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(canvas.getByRole("option", { name: "Owner" })).toBeVisible();
    });

    // Select a different value
    await userEvent.click(canvas.getByRole("option", { name: "Admin" }));
    await waitFor(() => {
      expect(trigger).toHaveTextContent("Admin");
    });
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex flex-col gap-1.5">
      <Label>Role</Label>
      <Select defaultValue="admin">
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="member">Member</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const WithGroups: Story = {
  render: () => (
    <Select defaultValue="react">
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Select framework" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Frontend</SelectLabel>
          <SelectItem value="react">React</SelectItem>
          <SelectItem value="vue">Vue</SelectItem>
          <SelectItem value="svelte">Svelte</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Backend</SelectLabel>
          <SelectItem value="express">Express</SelectItem>
          <SelectItem value="fastify">Fastify</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

export const Small: Story = {
  render: () => (
    <Select defaultValue="member">
      <SelectTrigger size="sm" className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">admin</SelectItem>
        <SelectItem value="member">member</SelectItem>
      </SelectContent>
    </Select>
  ),
};
