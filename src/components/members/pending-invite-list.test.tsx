import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PendingInviteList } from "./pending-invite-list";
import type { WorkspaceInviteWithInviter } from "@/lib/types";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const futureDate = new Date(Date.now() + 7 * 86_400_000).toISOString();
const pastDate = new Date(Date.now() - 1 * 86_400_000).toISOString();

function makeInvite(
  overrides: Partial<WorkspaceInviteWithInviter> & {
    profileOverrides?: Partial<WorkspaceInviteWithInviter["profiles"]>;
  } = {},
): WorkspaceInviteWithInviter {
  const { profileOverrides, ...rest } = overrides;
  return {
    id: "inv1",
    workspace_id: "ws1",
    email: "dave@example.com",
    role: "member",
    invited_by: "u1",
    token: "abc-123",
    expires_at: futureDate,
    accepted_at: null,
    created_at: new Date().toISOString(),
    profiles: { display_name: "Alice", ...profileOverrides },
    ...rest,
  };
}

const pendingInvite = makeInvite();
const expiredInvite = makeInvite({
  id: "inv2",
  email: "eve@example.com",
  role: "admin",
  token: "def-456",
  expires_at: pastDate,
});

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PendingInviteList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Rendering ---

  it("renders pending invites with email and role", () => {
    renderWithTooltip(
      <PendingInviteList invites={[pendingInvite, expiredInvite]} onRevoke={vi.fn()} />,
    );

    expect(screen.getByText("dave@example.com")).toBeInTheDocument();
    expect(screen.getByText("eve@example.com")).toBeInTheDocument();
    expect(screen.getByText("member")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("shows invite count in the heading", () => {
    renderWithTooltip(
      <PendingInviteList invites={[pendingInvite, expiredInvite]} onRevoke={vi.fn()} />,
    );

    expect(screen.getByText("Pending invites (2)")).toBeInTheDocument();
  });

  it("shows expiry date for non-expired invites", () => {
    renderWithTooltip(
      <PendingInviteList invites={[pendingInvite]} onRevoke={vi.fn()} />,
    );

    // Should show "Expires <date>" text
    const expiryText = screen.getByText(/^Expires/);
    expect(expiryText).toBeInTheDocument();
  });

  it("shows 'Expired' for expired invites", () => {
    renderWithTooltip(
      <PendingInviteList invites={[expiredInvite]} onRevoke={vi.fn()} />,
    );

    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  // --- Revoke callback ---

  it("fires onRevoke with invite id when revoke button is clicked", async () => {
    const onRevoke = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithTooltip(
      <PendingInviteList invites={[pendingInvite]} onRevoke={onRevoke} />,
    );

    const revokeButton = screen.getByLabelText("Revoke invite for dave@example.com");
    await user.click(revokeButton);

    await waitFor(() => {
      expect(onRevoke).toHaveBeenCalledWith("inv1");
    });
  });

  it("disables revoke button while revoking", async () => {
    // Create a promise we control to keep the revoke in-flight
    let resolveRevoke: () => void;
    const onRevoke = vi.fn(
      () => new Promise<void>((resolve) => { resolveRevoke = resolve; }),
    );
    const user = userEvent.setup();

    renderWithTooltip(
      <PendingInviteList invites={[pendingInvite]} onRevoke={onRevoke} />,
    );

    const revokeButton = screen.getByLabelText("Revoke invite for dave@example.com");
    await user.click(revokeButton);

    // Button should be disabled while the promise is pending
    expect(revokeButton).toBeDisabled();

    // Resolve the promise
    resolveRevoke!();
    await waitFor(() => {
      expect(revokeButton).not.toBeDisabled();
    });
  });

  it("fires onRevoke for the correct invite when multiple are present", async () => {
    const onRevoke = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithTooltip(
      <PendingInviteList invites={[pendingInvite, expiredInvite]} onRevoke={onRevoke} />,
    );

    // Revoke the second invite (eve)
    const revokeButton = screen.getByLabelText("Revoke invite for eve@example.com");
    await user.click(revokeButton);

    await waitFor(() => {
      expect(onRevoke).toHaveBeenCalledWith("inv2");
    });
  });

  // --- Empty state ---

  it("renders empty table when no pending invites", () => {
    renderWithTooltip(
      <PendingInviteList invites={[]} onRevoke={vi.fn()} />,
    );

    expect(screen.getByText("Pending invites (0)")).toBeInTheDocument();
    // Table headers should still be present
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    // No revoke buttons
    expect(screen.queryByLabelText(/Revoke invite/)).not.toBeInTheDocument();
  });
});
