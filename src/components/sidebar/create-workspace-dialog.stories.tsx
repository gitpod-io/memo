import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WORKSPACE_LIMIT } from "@/lib/workspace";

const meta: Meta = {
  title: "Sidebar/CreateWorkspaceDialog",
};

export { meta as default };

type Story = StoryObj;

// CreateWorkspaceDialog uses next/navigation and Supabase RPC. This
// story renders the visual appearance with static data.
export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button />}>Create workspace</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            A workspace is a shared space for your team&apos;s pages.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ws-name">Name</Label>
            <Input
              id="ws-name"
              placeholder="My Team"
              autoFocus
              maxLength={60}
            />
          </div>
        </div>
        <DialogFooter>
          <Button>Create workspace</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const AtLimit: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button />}>Create workspace</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            You&apos;ve reached the limit of {WORKSPACE_LIMIT} workspaces.
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Delete an existing workspace to create a new one.
        </p>
      </DialogContent>
    </Dialog>
  ),
};
