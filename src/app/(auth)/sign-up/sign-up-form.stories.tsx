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

// SignUpForm depends on Supabase, next/navigation, and next/dynamic at runtime.
// These stories render the visual appearance with static markup.

function OAuthButtonsPlaceholder() {
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        className="w-full gap-2"
        disabled
        aria-label="Continue with GitHub"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
        Continue with GitHub
      </Button>
      <Button
        variant="outline"
        className="w-full gap-2"
        disabled
        aria-label="Continue with Google"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </Button>
    </div>
  );
}

function Divider() {
  return (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-overlay-border" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-card px-2 text-muted-foreground">or</span>
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Auth/SignUpForm",
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
          Create an account
        </CardTitle>
        <CardDescription>
          Enter your details to get started with Memo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name-default">Display name</Label>
            <Input
              id="name-default"
              type="text"
              placeholder="Jane Doe"
              autoComplete="name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email-default">Email</Label>
            <Input
              id="email-default"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password-default">Password</Label>
            <Input
              id="password-default"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
          <Button type="button" className="mt-1">
            Sign up
          </Button>
        </form>
        <Divider />
        <OAuthButtonsPlaceholder />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <span className="text-accent underline underline-offset-4 cursor-pointer">
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
          Create an account
        </CardTitle>
        <CardDescription>
          Enter your details to get started with Memo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name-loading">Display name</Label>
            <Input
              id="name-loading"
              type="text"
              defaultValue="Alice Smith"
              autoComplete="name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email-loading">Email</Label>
            <Input
              id="email-loading"
              type="email"
              defaultValue="alice@example.com"
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password-loading">Password</Label>
            <Input
              id="password-loading"
              type="password"
              defaultValue="securepass"
              autoComplete="new-password"
            />
          </div>
          <Button type="button" disabled className="mt-1">
            Creating account…
          </Button>
        </form>
        <Divider />
        <OAuthButtonsPlaceholder />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <span className="text-accent underline underline-offset-4 cursor-pointer">
            Sign in
          </span>
        </p>
      </CardContent>
    </Card>
  ),
};

export const ValidationError: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">
          Create an account
        </CardTitle>
        <CardDescription>
          Enter your details to get started with Memo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name-error">Display name</Label>
            <Input
              id="name-error"
              type="text"
              defaultValue="Alice Smith"
              autoComplete="name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email-error">Email</Label>
            <Input
              id="email-error"
              type="email"
              defaultValue="alice@example.com"
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password-error">Password</Label>
            <Input
              id="password-error"
              type="password"
              defaultValue="short"
              autoComplete="new-password"
            />
          </div>
          <p className="text-xs text-destructive" role="alert">
            Password should be at least 6 characters
          </p>
          <Button type="button" className="mt-1">
            Sign up
          </Button>
        </form>
        <Divider />
        <OAuthButtonsPlaceholder />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <span className="text-accent underline underline-offset-4 cursor-pointer">
            Sign in
          </span>
        </p>
      </CardContent>
    </Card>
  ),
};

export const ConfirmationPending: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">
          Check your inbox
        </CardTitle>
        <CardDescription>
          We sent a confirmation link to{" "}
          <span className="font-medium text-foreground">
            alice@example.com
          </span>
          . Click the link to activate your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Already confirmed?{" "}
          <span className="text-accent underline underline-offset-4 cursor-pointer">
            Sign in
          </span>
        </p>
      </CardContent>
    </Card>
  ),
};
