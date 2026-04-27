import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ResetPasswordForm depends on Supabase and next/navigation at runtime.
// These stories render the visual appearance with static markup.

const meta: Meta = {
  title: "Auth/ResetPasswordForm",
  decorators: [
    (Story) => (
      <div className="flex min-h-[400px] items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Story />
        </div>
      </div>
    ),
  ],
};

export { meta as default };

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">
          Set a new password
        </CardTitle>
        <CardDescription>Enter your new password below.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pw-default">New password</Label>
            <Input
              id="pw-default"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cpw-default">Confirm password</Label>
            <Input
              id="cpw-default"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
          <Button type="button" className="mt-1">
            Reset password
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <span className="text-accent underline-offset-4 hover:underline cursor-pointer">
            Back to sign in
          </span>
        </p>
      </CardContent>
    </Card>
  ),
};

export const MismatchError: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">
          Set a new password
        </CardTitle>
        <CardDescription>Enter your new password below.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pw-mismatch">New password</Label>
            <Input
              id="pw-mismatch"
              type="password"
              defaultValue="password1"
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cpw-mismatch">Confirm password</Label>
            <Input
              id="cpw-mismatch"
              type="password"
              defaultValue="password2"
              autoComplete="new-password"
            />
          </div>
          <p className="text-xs text-destructive">
            Passwords do not match.
          </p>
          <Button type="button" className="mt-1">
            Reset password
          </Button>
        </form>
      </CardContent>
    </Card>
  ),
};

export const Loading: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">
          Set a new password
        </CardTitle>
        <CardDescription>Enter your new password below.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pw-loading">New password</Label>
            <Input
              id="pw-loading"
              type="password"
              defaultValue="newpassword"
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cpw-loading">Confirm password</Label>
            <Input
              id="cpw-loading"
              type="password"
              defaultValue="newpassword"
              autoComplete="new-password"
            />
          </div>
          <Button type="button" disabled className="mt-1">
            Updating…
          </Button>
        </form>
      </CardContent>
    </Card>
  ),
};

export const Success: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">
          Password updated
        </CardTitle>
        <CardDescription>
          Your password has been reset. Redirecting to sign in…
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          <span className="text-accent underline-offset-4 hover:underline cursor-pointer">
            Go to sign in
          </span>
        </p>
      </CardContent>
    </Card>
  ),
};
