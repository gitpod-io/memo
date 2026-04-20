import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { MemberList } from "./member-list";
import type { MemberWithProfile } from "@/lib/types";

const meta: Meta<typeof MemberList> = {
  title: "Members/MemberList",
  component: MemberList,
  parameters: {
    layout: "padded",
  },
};

export { meta as default };

type Story = StoryObj<typeof MemberList>;

const mockMembers: MemberWithProfile[] = [
  {
    id: "m1",
    workspace_id: "ws1",
    user_id: "u1",
    role: "owner",
    invited_by: null,
    invited_at: null,
    joined_at: "2024-01-01T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    profiles: {
      email: "alice@example.com",
      display_name: "Alice",
      avatar_url: null,
    },
  },
  {
    id: "m2",
    workspace_id: "ws1",
    user_id: "u2",
    role: "admin",
    invited_by: "u1",
    invited_at: "2024-02-01T00:00:00Z",
    joined_at: "2024-02-02T00:00:00Z",
    created_at: "2024-02-02T00:00:00Z",
    profiles: {
      email: "bob@example.com",
      display_name: "Bob",
      avatar_url: null,
    },
  },
  {
    id: "m3",
    workspace_id: "ws1",
    user_id: "u3",
    role: "member",
    invited_by: "u1",
    invited_at: "2024-03-01T00:00:00Z",
    joined_at: "2024-03-02T00:00:00Z",
    created_at: "2024-03-02T00:00:00Z",
    profiles: {
      email: "carol@example.com",
      display_name: "Carol",
      avatar_url: null,
    },
  },
];

export const AsOwner: Story = {
  args: {
    members: mockMembers,
    currentUserId: "u1",
    currentUserRole: "owner",
    isPersonalWorkspace: false,
    onRoleChange: fn(),
    onRemove: fn(),
  },
};

export const AsMember: Story = {
  args: {
    members: mockMembers,
    currentUserId: "u3",
    currentUserRole: "member",
    isPersonalWorkspace: false,
    onRoleChange: fn(),
    onRemove: fn(),
  },
};

export const PersonalWorkspace: Story = {
  args: {
    members: [mockMembers[0]],
    currentUserId: "u1",
    currentUserRole: "owner",
    isPersonalWorkspace: true,
    onRoleChange: fn(),
    onRemove: fn(),
  },
};
