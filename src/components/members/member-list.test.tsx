import "@testing-library/jest-dom/vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemberList } from "./member-list";
import type { MemberRole, MemberWithProfile } from "@/lib/types";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeMember(
  overrides: Partial<MemberWithProfile> & {
    profileOverrides?: Partial<MemberWithProfile["profiles"]>;
  } = {},
): MemberWithProfile {
  const { profileOverrides, ...rest } = overrides;
  return {
    id: "m1",
    workspace_id: "ws1",
    user_id: "u1",
    role: "member",
    invited_by: null,
    invited_at: null,
    joined_at: "2024-01-01T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    profiles: {
      email: "alice@example.com",
      display_name: "Alice",
      avatar_url: null,
      ...profileOverrides,
    },
    ...rest,
  };
}

const owner = makeMember({
  id: "m1",
  user_id: "u1",
  role: "owner",
  profileOverrides: { display_name: "Alice", email: "alice@example.com" },
});

const admin = makeMember({
  id: "m2",
  user_id: "u2",
  role: "admin",
  profileOverrides: { display_name: "Bob", email: "bob@example.com" },
});

const member = makeMember({
  id: "m3",
  user_id: "u3",
  role: "member",
  profileOverrides: { display_name: "Carol", email: "carol@example.com" },
});

const allMembers = [owner, admin, member];

interface DefaultPropsOverrides {
  members?: MemberWithProfile[];
  currentUserId?: string;
  currentUserRole?: MemberRole;
  isPersonalWorkspace?: boolean;
  onRoleChange?: (memberId: string, newRole: MemberRole) => Promise<void>;
  onRemove?: (memberId: string) => Promise<void>;
}

function defaultProps(overrides: DefaultPropsOverrides = {}) {
  return {
    members: allMembers,
    currentUserId: "u1",
    currentUserRole: "owner" as MemberRole,
    isPersonalWorkspace: false,
    onRoleChange: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MemberList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Rendering ---

  it("renders member rows with display name and email", () => {
    render(<MemberList {...defaultProps()} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();
    expect(screen.getByText("carol@example.com")).toBeInTheDocument();
  });

  it("shows member count in the heading", () => {
    render(<MemberList {...defaultProps()} />);

    expect(screen.getByText("Members (3)")).toBeInTheDocument();
  });

  it("marks the current user with '(you)'", () => {
    render(<MemberList {...defaultProps({ currentUserId: "u2" })} />);

    // Bob is u2 — should have "(you)" next to name
    expect(screen.getByText("(you)")).toBeInTheDocument();
    // The "(you)" should be near Bob's name
    const youLabel = screen.getByText("(you)");
    const row = youLabel.closest("tr");
    expect(row).not.toBeNull();
    expect(within(row!).getByText("Bob")).toBeInTheDocument();
  });

  // --- Role badges ---

  it("renders role badges for members the current user cannot change", () => {
    // As owner viewing self — cannot change own role, so badge is shown
    render(<MemberList {...defaultProps({ currentUserId: "u1" })} />);

    // Owner's own role shows as a badge (not a select)
    const ownerRow = screen.getByText("Alice").closest("tr")!;
    expect(within(ownerRow).getByText("owner")).toBeInTheDocument();
  });

  it("shows RoleSelect for members whose role can be changed", () => {
    render(<MemberList {...defaultProps({ currentUserId: "u1", currentUserRole: "owner" })} />);

    // Bob (admin) and Carol (member) should have role selects
    // The RoleSelect renders a button trigger with the current role value
    const bobRow = screen.getByText("Bob").closest("tr")!;
    const carolRow = screen.getByText("Carol").closest("tr")!;

    // RoleSelect uses a <select> trigger — look for the select trigger button
    expect(within(bobRow).getByRole("combobox")).toBeInTheDocument();
    expect(within(carolRow).getByRole("combobox")).toBeInTheDocument();
  });

  // --- Role change callback ---

  it("fires onRoleChange with correct args when role is changed", async () => {
    const onRoleChange = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <MemberList
        {...defaultProps({ currentUserId: "u1", currentUserRole: "owner", onRoleChange })}
      />,
    );

    // Carol (member) should have a role select
    const carolRow = screen.getByText("Carol").closest("tr")!;
    const trigger = within(carolRow).getByRole("combobox");
    await user.click(trigger);

    // Select the "admin" option from the listbox
    const adminOption = await screen.findByRole("option", { name: "admin" });
    await user.click(adminOption);

    await waitFor(() => {
      expect(onRoleChange).toHaveBeenCalledWith("m3", "admin");
    });
  });

  // --- Remove member ---

  it("shows remove button for removable members", () => {
    render(<MemberList {...defaultProps({ currentUserId: "u1", currentUserRole: "owner" })} />);

    // Bob and Carol can be removed by the owner
    expect(screen.getByLabelText("Remove Bob")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove Carol")).toBeInTheDocument();
  });

  it("does not show remove button for the current user", () => {
    render(<MemberList {...defaultProps({ currentUserId: "u1", currentUserRole: "owner" })} />);

    // Owner cannot remove themselves
    expect(screen.queryByLabelText("Remove Alice")).not.toBeInTheDocument();
  });

  it("fires onRemove after confirming the alert dialog", async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <MemberList
        {...defaultProps({ currentUserId: "u1", currentUserRole: "owner", onRemove })}
      />,
    );

    // Click the remove button for Carol
    await user.click(screen.getByLabelText("Remove Carol"));

    // Confirmation dialog should appear
    const confirmButton = await screen.findByRole("button", { name: "Remove" });
    expect(screen.getByText(/Remove Carol from this workspace/)).toBeInTheDocument();

    await user.click(confirmButton);

    await waitFor(() => {
      expect(onRemove).toHaveBeenCalledWith("m3");
    });
  });

  // --- Owner protection ---

  it("hides remove button for owner in a personal workspace", () => {
    render(
      <MemberList
        {...defaultProps({
          members: [owner, member],
          currentUserId: "u3",
          currentUserRole: "admin",
          isPersonalWorkspace: true,
        })}
      />,
    );

    // Owner in personal workspace cannot be removed
    expect(screen.queryByLabelText("Remove Alice")).not.toBeInTheDocument();
  });

  it("admin cannot remove another owner", () => {
    const secondOwner = makeMember({
      id: "m4",
      user_id: "u4",
      role: "owner",
      profileOverrides: { display_name: "Dave", email: "dave@example.com" },
    });

    render(
      <MemberList
        {...defaultProps({
          members: [owner, secondOwner, member],
          currentUserId: "u2",
          currentUserRole: "admin",
        })}
      />,
    );

    expect(screen.queryByLabelText("Remove Alice")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Remove Dave")).not.toBeInTheDocument();
  });

  // --- Read-only view for non-admin ---

  it("non-admin users see read-only view without remove buttons", () => {
    render(
      <MemberList
        {...defaultProps({ currentUserId: "u3", currentUserRole: "member" })}
      />,
    );

    // No remove buttons should be visible
    expect(screen.queryByLabelText("Remove Alice")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Remove Bob")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Remove Carol")).not.toBeInTheDocument();

    // No role selects — all roles shown as badges
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("non-admin users see role badges instead of selects", () => {
    render(
      <MemberList
        {...defaultProps({ currentUserId: "u3", currentUserRole: "member" })}
      />,
    );

    // All roles should be rendered as text badges
    expect(screen.getByText("owner")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("member")).toBeInTheDocument();
  });

  // --- Admin cannot change owner role ---

  it("admin cannot change an owner's role", () => {
    render(
      <MemberList
        {...defaultProps({ currentUserId: "u2", currentUserRole: "admin" })}
      />,
    );

    // Alice is owner — admin should see a badge, not a select
    const aliceRow = screen.getByText("Alice").closest("tr")!;
    expect(within(aliceRow).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(aliceRow).getByText("owner")).toBeInTheDocument();

    // Carol is member — admin can change her role
    const carolRow = screen.getByText("Carol").closest("tr")!;
    expect(within(carolRow).getByRole("combobox")).toBeInTheDocument();
  });
});
