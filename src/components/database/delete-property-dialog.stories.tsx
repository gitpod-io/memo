import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { DeletePropertyDialog } from "./delete-property-dialog";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof DeletePropertyDialog> = {
  title: "Database/DeletePropertyDialog",
  component: DeletePropertyDialog,
  parameters: { layout: "centered" },
  args: {
    open: true,
    propertyName: "Status",
    onCancel: fn(),
    onConfirm: fn(),
  },
};

export { meta as default };

type Story = StoryObj<typeof DeletePropertyDialog>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Default open state with a property name. */
export const Default: Story = {};

/** With a long property name. */
export const LongName: Story = {
  args: {
    propertyName: "Very Long Property Name That Might Overflow The Dialog",
  },
};

/** Closed state — dialog is not visible. */
export const Closed: Story = {
  args: {
    open: false,
    propertyName: null,
  },
};
