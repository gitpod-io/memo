import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, waitFor } from "@storybook/test";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

const meta: Meta<typeof Dialog> = {
  title: "UI/Dialog",
  component: Dialog,
};

export { meta as default };

type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button />}>Open Dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit page</DialogTitle>
          <DialogDescription>
            Make changes to your page settings here.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" defaultValue="My Page" />
          </div>
        </div>
        <DialogFooter>
          <Button>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /open dialog/i });

    await userEvent.click(trigger);
    await waitFor(() => {
      expect(canvas.getByText("Edit page")).toBeVisible();
    });

    // Close via the X button
    const closeButton = canvas.getByRole("button", { name: /close/i });
    await userEvent.click(closeButton);
    await waitFor(() => {
      expect(canvas.queryByText("Edit page")).not.toBeInTheDocument();
    });

    // Reopen and close via Escape
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(canvas.getByText("Edit page")).toBeVisible();
    });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(canvas.queryByText("Edit page")).not.toBeInTheDocument();
    });
  },
};

export const WithCloseButton: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        Info Dialog
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Information</DialogTitle>
          <DialogDescription>
            This dialog has a close button in the top-right corner.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Click the X or press Escape to close.
        </p>
      </DialogContent>
    </Dialog>
  ),
};

export const WithFooterClose: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="secondary" />}>
        Confirm
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Confirm action</DialogTitle>
          <DialogDescription>
            Are you sure you want to proceed?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
