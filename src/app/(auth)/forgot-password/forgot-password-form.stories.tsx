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

// ForgotPasswordForm depends on Supabase at runtime. These stories render
// the visual appearance with static markup.

const meta: Meta = {
  title: "Auth/ForgotPasswordForm",
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
          Reset your password
        </CardTitle>
        <CardDescription>
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email-default">Email</Label>
            <Input
              id="email-default"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <Button type="button" className="mt-1">
            Send reset link
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Remember your password?{" "}
          <span className="text-accent underline-offset-4 hover:underline cursor-pointer">
            Sign in
          </span>
        </p>
      </CardContent>
    </Card>
  ),
};

export const Loading: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">
          Reset your password
        </CardTitle>
        <CardDescription>
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email-loading">Email</Label>
            <Input
              id="email-loading"
              type="email"
              defaultValue="alice@example.com"
              autoComplete="email"
            />
          </div>
          <Button type="button" disabled className="mt-1">
            Sending…
          </Button>
        </form>
      </CardContent>
    </Card>
  ),
};

export const WithError: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">
          Reset your password
        </CardTitle>
        <CardDescription>
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email-error">Email</Label>
            <Input
              id="email-error"
              type="email"
              defaultValue="invalid"
              autoComplete="email"
            />
          </div>
          <p className="text-xs text-destructive">
            Unable to send reset email. Please try again.
          </p>
          <Button type="button" className="mt-1">
            Send reset link
          </Button>
        </form>
      </CardContent>
    </Card>
  ),
};

export const EmailSent: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">
          Check your inbox
        </CardTitle>
        <CardDescription>
          We sent a password reset link to{" "}
          <span className="font-medium text-foreground">
            alice@example.com
          </span>
          . Click the link to set a new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Didn&apos;t receive the email? Check your spam folder or{" "}
          <span className="text-accent underline-offset-4 hover:underline cursor-pointer">
            try again
          </span>
          .
        </p>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <span className="text-accent underline-offset-4 hover:underline cursor-pointer">
            Back to sign in
          </span>
        </p>
      </CardContent>
    </Card>
  ),
};
