import type { Meta, StoryObj } from "@storybook/react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const meta: Meta = {
  title: "Components/WorkspaceSettingsForm",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

// WorkspaceSettingsForm uses next/navigation and Supabase. These
// stories render the visual appearance with static data.
export const Default: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-8">
      <form className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ws-name">Name</Label>
          <Input id="ws-name" defaultValue="My Workspace" maxLength={60} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ws-slug">Slug</Label>
          <Input id="ws-slug" defaultValue="my-workspace" maxLength={60} />
          <p className="text-xs text-muted-foreground">
            Used in the URL: /my-workspace
          </p>
        </div>
        <div>
          <Button type="button">Save changes</Button>
        </div>
      </form>

      <Separator className="bg-overlay-border" />

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
        <p className="text-xs text-muted-foreground">
          Deleting this workspace will permanently remove all its pages and
          members. This action cannot be undone.
        </p>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
            <Trash2 className="h-4 w-4" />
            Delete workspace
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete workspace</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &ldquo;My Workspace&rdquo;? All
                pages and members will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive">
                Delete workspace
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  ),
};

export const PersonalWorkspace: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-8">
      <form className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ws-name-p">Name</Label>
          <Input id="ws-name-p" defaultValue="Personal" maxLength={60} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ws-slug-p">Slug</Label>
          <Input id="ws-slug-p" defaultValue="personal" maxLength={60} />
          <p className="text-xs text-muted-foreground">
            Used in the URL: /personal
          </p>
        </div>
        <div>
          <Button type="button">Save changes</Button>
        </div>
      </form>

      <Separator className="bg-overlay-border" />

      <p className="text-xs text-muted-foreground">
        This is your personal workspace and cannot be deleted.
      </p>
    </div>
  ),
};

export const WithError: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ws-name-e">Name</Label>
        <Input id="ws-name-e" defaultValue="My Workspace" maxLength={60} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ws-slug-e">Slug</Label>
        <Input id="ws-slug-e" defaultValue="taken-slug" maxLength={60} />
        <p className="text-xs text-muted-foreground">
          Used in the URL: /taken-slug
        </p>
      </div>
      <p className="text-xs text-destructive">
        This slug is already taken. Choose a different one.
      </p>
      <div>
        <Button type="button">Save changes</Button>
      </div>
    </div>
  ),
};
