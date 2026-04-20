import type { Meta, StoryObj } from "@storybook/react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

// DeleteAccountSection depends on next/navigation and Supabase.
// These stories render the visual appearance with static markup.

const meta: Meta = {
  title: "Components/DeleteAccountSection",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

const USER_EMAIL = "alice@example.com";

export const Default: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
      <p className="text-xs text-muted-foreground">
        Permanently delete your account and all data in your personal workspace.
        Your membership in other workspaces will be removed, but those
        workspaces and their content will remain.
      </p>
      <AlertDialog>
        <AlertDialogTrigger
          render={<Button variant="destructive" size="sm" />}
        >
          <Trash2 className="h-4 w-4" />
          Delete account
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account, your personal workspace,
              and all its pages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-email" className="text-sm">
              Type <span className="font-semibold">{USER_EMAIL}</span> to
              confirm
            </Label>
            <Input
              id="confirm-email"
              placeholder={USER_EMAIL}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  ),
};

export const EmailConfirmStep: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
      <p className="text-xs text-muted-foreground">
        Permanently delete your account and all data in your personal workspace.
        Your membership in other workspaces will be removed, but those
        workspaces and their content will remain.
      </p>
      {/* Dialog shown open with email typed */}
      <AlertDialog defaultOpen>
        <AlertDialogTrigger
          render={<Button variant="destructive" size="sm" />}
        >
          <Trash2 className="h-4 w-4" />
          Delete account
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account, your personal workspace,
              and all its pages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-email-typed" className="text-sm">
              Type <span className="font-semibold">{USER_EMAIL}</span> to
              confirm
            </Label>
            <Input
              id="confirm-email-typed"
              defaultValue={USER_EMAIL}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive">
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  ),
};

export const FinalConfirmStep: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      <h2 className="text-sm font-medium text-destructive">Danger zone</h2>
      <p className="text-xs text-muted-foreground">
        Permanently delete your account and all data in your personal workspace.
        Your membership in other workspaces will be removed, but those
        workspaces and their content will remain.
      </p>
      <AlertDialog defaultOpen>
        <AlertDialogTrigger
          render={<Button variant="destructive" size="sm" />}
        >
          <Trash2 className="h-4 w-4" />
          Delete account
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This is your last chance. Your account, personal workspace, and all
              pages will be permanently deleted. You will be signed out
              immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive">
              Delete my account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  ),
};
