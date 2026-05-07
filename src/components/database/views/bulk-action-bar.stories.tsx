import type { Meta, StoryObj } from "@storybook/react";
import { fn, userEvent, within, expect } from "@storybook/test";
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

export const DeleteConfirmation: Story = {
  name: "Delete Confirmation Dialog",
  args: {
    selectedCount: 5,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const deleteButton = canvas.getByTestId("db-bulk-delete-button");
    await userEvent.click(deleteButton);

    // The dialog renders in a portal outside the canvas, so query the document
    const dialog = await within(document.body).findByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(within(dialog).getByText("Delete 5 rows?")).toBeVisible();
    await expect(
      within(dialog).getByText(
        "These 5 rows and their page content will be moved to trash.",
      ),
    ).toBeVisible();
  },
};

export const DeleteConfirmationSingleRow: Story = {
  name: "Delete Confirmation (Single Row)",
  args: {
    selectedCount: 1,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const deleteButton = canvas.getByTestId("db-bulk-delete-button");
    await userEvent.click(deleteButton);

    const dialog = await within(document.body).findByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(within(dialog).getByText("Delete 1 row?")).toBeVisible();
    await expect(
      within(dialog).getByText(
        "This row and its page content will be moved to trash.",
      ),
    ).toBeVisible();
  },
};
