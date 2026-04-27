import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ChangePasswordSection depends on Supabase at runtime. These stories
// render the visual appearance with static markup.

const meta: Meta = {
  title: "Components/ChangePasswordSection",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      <h2 className="text-sm font-medium">Change password</h2>
      <p className="text-xs text-muted-foreground">
        Update your account password. You&apos;ll stay signed in after changing
        it.
      </p>
      <form className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="np-default">New password</Label>
          <Input
            id="np-default"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cnp-default">Confirm new password</Label>
          <Input
            id="cnp-default"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </div>
        <div>
          <Button type="button" size="sm">
            Update password
          </Button>
        </div>
      </form>
    </div>
  ),
};

export const MismatchError: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      <h2 className="text-sm font-medium">Change password</h2>
      <p className="text-xs text-muted-foreground">
        Update your account password. You&apos;ll stay signed in after changing
        it.
      </p>
      <form className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="np-error">New password</Label>
          <Input
            id="np-error"
            type="password"
            defaultValue="password1"
            autoComplete="new-password"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cnp-error">Confirm new password</Label>
          <Input
            id="cnp-error"
            type="password"
            defaultValue="password2"
            autoComplete="new-password"
          />
        </div>
        <p className="text-xs text-destructive">Passwords do not match.</p>
        <div>
          <Button type="button" size="sm">
            Update password
          </Button>
        </div>
      </form>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      <h2 className="text-sm font-medium">Change password</h2>
      <p className="text-xs text-muted-foreground">
        Update your account password. You&apos;ll stay signed in after changing
        it.
      </p>
      <form className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="np-loading">New password</Label>
          <Input
            id="np-loading"
            type="password"
            defaultValue="newpassword"
            autoComplete="new-password"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cnp-loading">Confirm new password</Label>
          <Input
            id="cnp-loading"
            type="password"
            defaultValue="newpassword"
            autoComplete="new-password"
          />
        </div>
        <div>
          <Button type="button" size="sm" disabled>
            Updating…
          </Button>
        </div>
      </form>
    </div>
  ),
};

export const Success: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      <h2 className="text-sm font-medium">Change password</h2>
      <p className="text-xs text-muted-foreground">
        Update your account password. You&apos;ll stay signed in after changing
        it.
      </p>
      <form className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="np-success">New password</Label>
          <Input
            id="np-success"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cnp-success">Confirm new password</Label>
          <Input
            id="cnp-success"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </div>
        <p className="text-xs text-accent">Password updated.</p>
        <div>
          <Button type="button" size="sm">
            Update password
          </Button>
        </div>
      </form>
    </div>
  ),
};
