import type { Meta, StoryObj } from "@storybook/react";
import { MoreHorizontal, UserPlus } from "lucide-react";

// MembersPage renders the full members management page with member list,
// invite form, and pending invites. It requires Supabase and router context —
// stories show the static visual layout.

const meta: Meta = {
  title: "Members/MembersPage",
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj;

interface StaticMember {
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
}

function StaticMemberRow({
  member,
  isAdmin,
}: {
  member: StaticMember;
  isAdmin: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-sm font-medium text-accent">
          {member.name.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{member.name}</p>
          <p className="text-xs text-muted-foreground">{member.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
          {member.role}
        </span>
        {isAdmin && member.role !== "owner" && (
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-overlay-hover"
            aria-label="Member actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

const sampleMembers: StaticMember[] = [
  { name: "Alice Johnson", email: "alice@example.com", role: "owner" },
  { name: "Bob Smith", email: "bob@example.com", role: "admin" },
  { name: "Carol Williams", email: "carol@example.com", role: "member" },
];

/** Full members page — admin view with invite form and member list. */
export const AdminView: Story = {
  render: () => (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold text-foreground">Members</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage workspace members and invitations.
      </p>
      {/* Invite form */}
      <div className="mt-6">
        <h2 className="text-sm font-medium text-foreground">Invite members</h2>
        <div className="mt-2 flex gap-2">
          <input
            type="email"
            placeholder="Email address"
            className="h-9 flex-1 rounded-sm border border-overlay-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <select className="h-9 rounded-sm border border-overlay-border bg-background px-2 text-sm text-foreground">
            <option>Member</option>
            <option>Admin</option>
          </select>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-sm bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-accent/90"
          >
            <UserPlus className="h-4 w-4" />
            Invite
          </button>
        </div>
      </div>
      {/* Separator */}
      <div className="mt-6 border-t border-overlay-border" />
      {/* Pending invites */}
      <div className="mt-6">
        <h2 className="text-sm font-medium text-foreground">
          Pending invitations
        </h2>
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between rounded-sm border border-overlay-border px-3 py-2">
            <div>
              <p className="text-sm text-foreground">dave@example.com</p>
              <p className="text-xs text-muted-foreground">
                Invited as member · 2 days ago
              </p>
            </div>
            <button
              type="button"
              className="text-xs text-destructive hover:underline"
            >
              Revoke
            </button>
          </div>
        </div>
      </div>
      {/* Separator */}
      <div className="mt-6 border-t border-overlay-border" />
      {/* Member list */}
      <div className="mt-6">
        <h2 className="text-sm font-medium text-foreground">Members</h2>
        <div className="mt-2 divide-y divide-overlay-border">
          {sampleMembers.map((member) => (
            <StaticMemberRow
              key={member.email}
              member={member}
              isAdmin={true}
            />
          ))}
        </div>
      </div>
    </div>
  ),
};

/** Member view — no invite form, no role change actions. */
export const MemberView: Story = {
  render: () => (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold text-foreground">Members</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Workspace members.
      </p>
      <div className="mt-6 divide-y divide-overlay-border">
        {sampleMembers.map((member) => (
          <StaticMemberRow
            key={member.email}
            member={member}
            isAdmin={false}
          />
        ))}
      </div>
    </div>
  ),
};

/** No pending invites. */
export const NoPendingInvites: Story = {
  render: () => (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold text-foreground">Members</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage workspace members and invitations.
      </p>
      <div className="mt-6">
        <h2 className="text-sm font-medium text-foreground">Invite members</h2>
        <div className="mt-2 flex gap-2">
          <input
            type="email"
            placeholder="Email address"
            className="h-9 flex-1 rounded-sm border border-overlay-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-sm bg-accent px-3 text-sm font-medium text-accent-foreground"
          >
            <UserPlus className="h-4 w-4" />
            Invite
          </button>
        </div>
      </div>
      <div className="mt-6 border-t border-overlay-border" />
      <div className="mt-6 divide-y divide-overlay-border">
        {sampleMembers.map((member) => (
          <StaticMemberRow
            key={member.email}
            member={member}
            isAdmin={true}
          />
        ))}
      </div>
    </div>
  ),
};

/** Error state — role change failed. */
export const WithError: Story = {
  render: () => (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold text-foreground">Members</h1>
      <p className="mt-2 text-xs text-destructive">
        Failed to update role. Please try again.
      </p>
      <div className="mt-4 divide-y divide-overlay-border">
        {sampleMembers.map((member) => (
          <StaticMemberRow
            key={member.email}
            member={member}
            isAdmin={true}
          />
        ))}
      </div>
    </div>
  ),
};
