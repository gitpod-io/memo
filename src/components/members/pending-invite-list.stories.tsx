import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PendingInviteList } from "./pending-invite-list";
import type { WorkspaceInviteWithInviter } from "@/lib/types";

const meta: Meta<typeof PendingInviteList> = {
  title: "Members/PendingInviteList",
  component: PendingInviteList,
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj<typeof PendingInviteList>;

const futureDate = new Date(Date.now() + 7 * 86_400_000).toISOString();
const pastDate = new Date(Date.now() - 1 * 86_400_000).toISOString();

const mockInvites: WorkspaceInviteWithInviter[] = [
  {
    id: "inv1",
    workspace_id: "ws1",
    email: "dave@example.com",
    role: "member",
    invited_by: "u1",
    token: "abc-123",
    expires_at: futureDate,
    accepted_at: null,
    created_at: new Date().toISOString(),
    profiles: { display_name: "Alice" },
  },
  {
    id: "inv2",
    workspace_id: "ws1",
    email: "eve@example.com",
    role: "admin",
    invited_by: "u1",
    token: "def-456",
    expires_at: pastDate,
    accepted_at: null,
    created_at: new Date().toISOString(),
    profiles: { display_name: "Alice" },
  },
];

export const Default: Story = {
  args: {
    invites: mockInvites,
    onRevoke: fn(),
  },
};

export const AllExpired: Story = {
  args: {
    invites: mockInvites.map((inv) => ({ ...inv, expires_at: pastDate })),
    onRevoke: fn(),
  },
};
