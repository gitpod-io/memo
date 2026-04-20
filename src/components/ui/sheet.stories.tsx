import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, waitFor } from "@storybook/test";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

const meta: Meta<typeof Sheet> = {
  title: "UI/Sheet",
  component: Sheet,
};

export { meta as default };

type Story = StoryObj<typeof Sheet>;

export const Right: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>
        Open Sheet
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Edit settings</SheetTitle>
          <SheetDescription>
            Make changes to your workspace settings.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sheet-name">Name</Label>
            <Input id="sheet-name" defaultValue="My Workspace" />
          </div>
        </div>
        <SheetFooter>
          <Button>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /open sheet/i });

    await userEvent.click(trigger);
    await waitFor(() => {
      expect(canvas.getByText("Edit settings")).toBeVisible();
    });

    // Close via the X button
    const closeButton = canvas.getByRole("button", { name: /close/i });
    await userEvent.click(closeButton);
    await waitFor(() => {
      expect(canvas.queryByText("Edit settings")).not.toBeInTheDocument();
    });
  },
};

export const Left: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>
        Left Sheet
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Browse your workspace.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4">
          <p className="text-sm text-muted-foreground">Page 1</p>
          <p className="text-sm text-muted-foreground">Page 2</p>
          <p className="text-sm text-muted-foreground">Page 3</p>
        </div>
      </SheetContent>
    </Sheet>
  ),
};

export const Bottom: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>
        Bottom Sheet
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Quick actions</SheetTitle>
        </SheetHeader>
        <div className="flex gap-2 px-4 pb-4">
          <Button variant="outline" size="sm">
            Export
          </Button>
          <Button variant="outline" size="sm">
            Import
          </Button>
          <Button variant="destructive" size="sm">
            Delete
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  ),
};
