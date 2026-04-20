import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@/components/ui/button";

// InviteAccept depends on next/navigation, next/link, and Supabase.
// These stories render the visual states with static markup.

const meta: Meta = {
  title: "Members/InviteAccept",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

export const NotAuthenticated: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Sign in or create an account with{" "}
        <span className="font-medium text-foreground">dave@example.com</span> to
        accept this invite.
      </p>
      <div className="flex gap-2">
        <Button>Sign in</Button>
        <Button variant="outline">Sign up</Button>
      </div>
    </div>
  ),
};

export const EmailMismatch: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        This invite was sent to{" "}
        <span className="font-medium text-foreground">dave@example.com</span>,
        but you&apos;re signed in as{" "}
        <span className="font-medium text-foreground">alice@example.com</span>.
      </p>
      <p className="text-sm text-muted-foreground">
        Sign in with the invited email to accept.
      </p>
    </div>
  ),
};

export const ReadyToAccept: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        You&apos;re signed in as{" "}
        <span className="font-medium text-foreground">dave@example.com</span>.
      </p>
      <Button>Accept invite</Button>
    </div>
  ),
};

export const Accepting: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        You&apos;re signed in as{" "}
        <span className="font-medium text-foreground">dave@example.com</span>.
      </p>
      <Button disabled>Joining…</Button>
    </div>
  ),
};

export const WithError: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        You&apos;re signed in as{" "}
        <span className="font-medium text-foreground">dave@example.com</span>.
      </p>
      <p className="text-xs text-destructive">
        Failed to accept invite. Please try again.
      </p>
      <Button>Accept invite</Button>
    </div>
  ),
};
