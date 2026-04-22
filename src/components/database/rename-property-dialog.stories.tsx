import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within, waitFor } from "@storybook/test";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RenamePropertyDialog } from "./rename-property-dialog";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof RenamePropertyDialog> = {
  title: "Database/RenamePropertyDialog",
  component: RenamePropertyDialog,
  parameters: {
    layout: "centered",
  },
  args: {
    open: true,
    propertyName: "Status",
    onOpenChange: fn(),
    onRename: fn(),
  },
};

export { meta as default };

type Story = StoryObj<typeof RenamePropertyDialog>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Default open state with a property name pre-filled. */
export const Default: Story = {};

/** With a long property name. */
export const LongName: Story = {
  args: {
    propertyName: "Very Long Property Name That Might Overflow",
  },
};

/** Interactive story with trigger button and state management. */
export const Interactive: Story = {
  args: {
    open: false,
  },
  render: function InteractiveRename() {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("Status");

    return (
      <div className="space-y-4">
        <Button onClick={() => setOpen(true)}>Rename &ldquo;{name}&rdquo;</Button>
        <RenamePropertyDialog
          open={open}
          onOpenChange={setOpen}
          propertyName={name}
          onRename={(newName) => setName(newName)}
        />
        <p className="text-xs text-muted-foreground">
          Current name: {name}
        </p>
      </div>
    );
  },
};

/** Verifies Enter key submits the rename. */
export const SubmitWithEnter: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByLabelText("Name")).toBeVisible();
    });

    const input = canvas.getByLabelText("Name");
    await userEvent.clear(input);
    await userEvent.type(input, "Priority{Enter}");

    await waitFor(() => {
      expect(args.onRename).toHaveBeenCalledWith("Priority");
    });
  },
};

/** Verifies Escape key closes without renaming. */
export const DismissWithEscape: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByLabelText("Name")).toBeVisible();
    });

    await userEvent.keyboard("{Escape}");

    await waitFor(() => {
      expect(args.onOpenChange).toHaveBeenCalledWith(false);
      expect(args.onRename).not.toHaveBeenCalled();
    });
  },
};

/** Verifies the Rename button is disabled when the name is unchanged. */
export const DisabledWhenUnchanged: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByRole("button", { name: "Rename" })).toBeDisabled();
    });
  },
};

/** Verifies the Rename button is disabled when the input is empty. */
export const DisabledWhenEmpty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByLabelText("Name")).toBeVisible();
    });

    const input = canvas.getByLabelText("Name");
    await userEvent.clear(input);

    await waitFor(() => {
      expect(canvas.getByRole("button", { name: "Rename" })).toBeDisabled();
    });
  },
};
