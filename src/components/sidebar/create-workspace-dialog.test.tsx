import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

// Mock Sentry
const mockCaptureSupabaseError = vi.fn();
vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: (...args: unknown[]) =>
    mockCaptureSupabaseError(...args),
}));

// Mock Supabase client — the lazy-client imports from here
let rpcResult: {
  data: { id: string; slug: string } | null;
  error: { message: string; code: string; details: string; hint: string } | null;
} = { data: { id: "ws-new", slug: "my-team-abc123" }, error: null };

const mockRpc = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: (fn: string, params: Record<string, unknown>) => {
      mockRpc(fn, params);
      return {
        single: () => {
          mockSingle();
          return Promise.resolve(rpcResult);
        },
      };
    },
  }),
}));

import { CreateWorkspaceDialog } from "./create-workspace-dialog";

beforeEach(() => {
  vi.clearAllMocks();
  rpcResult = {
    data: { id: "ws-new", slug: "my-team-abc123" },
    error: null,
  };
});

describe("CreateWorkspaceDialog", () => {
  it("calls create_workspace RPC with name and slug on submit", async () => {
    const user = userEvent.setup();
    render(
      <CreateWorkspaceDialog
        open={true}
        onOpenChange={vi.fn()}
        workspaceCount={1}
      />,
    );

    const nameInput = screen.getByLabelText("Name");
    await user.type(nameInput, "My Team");

    const submitButton = screen.getByRole("button", {
      name: /create workspace/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        "create_workspace",
        expect.objectContaining({
          workspace_name: "My Team",
        }),
      );
    });
  });

  it("navigates to new workspace on success", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <CreateWorkspaceDialog
        open={true}
        onOpenChange={onOpenChange}
        workspaceCount={1}
      />,
    );

    await user.type(screen.getByLabelText("Name"), "My Team");
    await user.click(
      screen.getByRole("button", { name: /create workspace/i }),
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/my-team-abc123");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("shows user-friendly error and reports to Sentry on RLS/unknown failure", async () => {
    rpcResult = {
      data: null,
      error: {
        message: "new row violates row-level security policy for table \"workspaces\"",
        code: "42501",
        details: "",
        hint: "",
      },
    };

    const user = userEvent.setup();
    render(
      <CreateWorkspaceDialog
        open={true}
        onOpenChange={vi.fn()}
        workspaceCount={1}
      />,
    );

    await user.type(screen.getByLabelText("Name"), "My Team");
    await user.click(
      screen.getByRole("button", { name: /create workspace/i }),
    );

    await waitFor(() => {
      // User sees a generic message, NOT the raw RLS error
      expect(
        screen.getByText("Failed to create workspace. Please try again."),
      ).toBeInTheDocument();

      // Sentry receives the real error
      expect(mockCaptureSupabaseError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("row-level security"),
        }),
        "create-workspace-dialog:create",
      );
    });

    // Raw error message must NOT appear in the DOM
    expect(
      screen.queryByText(/row-level security/i),
    ).not.toBeInTheDocument();
  });

  it("shows workspace limit message without Sentry report", async () => {
    rpcResult = {
      data: null,
      error: {
        message: "Workspace limit reached: users can create at most 3 workspaces",
        code: "P0001",
        details: "",
        hint: "",
      },
    };

    const user = userEvent.setup();
    render(
      <CreateWorkspaceDialog
        open={true}
        onOpenChange={vi.fn()}
        workspaceCount={1}
      />,
    );

    await user.type(screen.getByLabelText("Name"), "My Team");
    await user.click(
      screen.getByRole("button", { name: /create workspace/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("You can create at most 3 workspaces."),
      ).toBeInTheDocument();
    });

    // Workspace limit is expected behavior, not a Sentry error
    expect(mockCaptureSupabaseError).not.toHaveBeenCalled();
  });

  it("shows limit-reached UI when workspaceCount >= WORKSPACE_LIMIT", () => {
    render(
      <CreateWorkspaceDialog
        open={true}
        onOpenChange={vi.fn()}
        workspaceCount={3}
      />,
    );

    expect(
      screen.getByText("You've reached the limit of 3 workspaces."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Delete an existing workspace to create a new one."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /create workspace/i }),
    ).not.toBeInTheDocument();
  });
});
