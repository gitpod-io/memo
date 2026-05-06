import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { BulkActionBar } from "./bulk-action-bar";

const meta: Meta<typeof BulkActionBar> = {
  title: "Database/BulkActionBar",
  component: BulkActionBar,
  parameters: { layout: "centered" },
  args: {
    onBulkDelete: fn(),
    onClear: fn(),
  },
};

export { meta as default };

type Story = StoryObj<typeof BulkActionBar>;

export const SingleRow: Story = {
  args: {
    selectedCount: 1,
  },
};

export const MultipleRows: Story = {
  args: {
    selectedCount: 5,
  },
};

export const ManyRows: Story = {
  args: {
    selectedCount: 42,
  },
};

export const Hidden: Story = {
  name: "Hidden (0 selected)",
  args: {
    selectedCount: 0,
  },
};
