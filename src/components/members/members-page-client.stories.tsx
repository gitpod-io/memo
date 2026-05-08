import type { Meta, StoryObj } from "@storybook/react";

// MembersPageClient is a thin dynamic import wrapper for MembersPage.
// Stories show the loading state of the wrapper.

const meta: Meta = {
  title: "Members/MembersPageClient",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

/** Loading state — skeleton while MembersPage loads. */
export const Loading: Story = {
  render: () => (
    <div className="mx-auto max-w-xl p-6">
      <div className="h-8 w-32 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
      <div className="mt-6 space-y-4">
        <div className="h-9 w-full animate-pulse rounded bg-muted" />
        <div className="mt-4 border-t border-overlay-border" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-3 w-48 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
};

/** Loaded state — full members page rendered. */
export const Loaded: Story = {
  render: () => (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold text-foreground">Members</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage workspace members and invitations.
      </p>
      <div className="mt-6 divide-y divide-overlay-border">
        {[
          { name: "Alice Johnson", email: "alice@example.com", role: "Owner" },
          { name: "Bob Smith", email: "bob@example.com", role: "Admin" },
          { name: "Carol Williams", email: "carol@example.com", role: "Member" },
        ].map((member) => (
          <div key={member.email} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-sm font-medium text-accent">
                {member.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {member.name}
                </p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
            </div>
            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {member.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  ),
};
