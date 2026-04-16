import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Workspace } from "@/lib/types";

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

// Mock the Supabase browser client
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockDelete = vi.fn();
const mockDeleteEq = vi.fn();
const mockSelect = vi.fn();
const mockSelectEq = vi.fn();
const mockSelectLimit = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "workspaces") {
        return {
          update: (data: Record<string, unknown>) => {
            mockUpdate(data);
            return {
              eq: (_col: string, _val: string) => {
                mockEq(_col, _val);
                return Promise.resolve({ error: null });
              },
            };
          },
          delete: () => {
            mockDelete();
            return {
              eq: (_col: string, _val: string) => {
                mockDeleteEq(_col, _val);
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }
      if (table === "members") {
        return {
          select: (cols: string) => {
            mockSelect(cols);
            return {
              eq: (_col: string, _val: string) => {
                mockSelectEq(_col, _val);
                return {
                  limit: (_n: number) => {
                    mockSelectLimit(_n);
                    return Promise.resolve({
                      data: [
                        {
                          workspace_id: "personal-ws",
                          workspaces: {
                            slug: "personal",
                            is_personal: true,
                          },
                        },
                      ],
                    });
                  },
                };
              },
            };
          },
        };
      }
      return {};
    },
  }),
}));

import { WorkspaceSettingsForm } from "./workspace-settings-form";

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: "ws-1",
    name: "Test Workspace",
    slug: "test-workspace",
    is_personal: false,
    created_by: "user-1",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WorkspaceSettingsForm", () => {
  it("renders with current workspace name and slug", () => {
    const ws = makeWorkspace({ name: "My Team", slug: "my-team" });
    render(<WorkspaceSettingsForm workspace={ws} userId="user-1" />);

    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
    const slugInput = screen.getByLabelText("Slug") as HTMLInputElement;

    expect(nameInput.value).toBe("My Team");
    expect(slugInput.value).toBe("my-team");
  });

  it("submitting with a valid name and slug calls Supabase update", async () => {
    const user = userEvent.setup();
    const ws = makeWorkspace();
    render(<WorkspaceSettingsForm workspace={ws} userId="user-1" />);

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Name");

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        name: "Updated Name",
        slug: "test-workspace",
      });
      expect(mockEq).toHaveBeenCalledWith("id", "ws-1");
    });
  });

  it("shows error when name is empty", async () => {
    const user = userEvent.setup();
    const ws = makeWorkspace();
    render(<WorkspaceSettingsForm workspace={ws} userId="user-1" />);

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);

    // The HTML required attribute prevents form submission, but the component
    // also has a manual check. We need to bypass the HTML validation.
    // Instead, set value to spaces only.
    await user.type(nameInput, "   ");
    // Clear and type spaces to trigger the trim() check
    await user.clear(nameInput);
    await user.type(nameInput, "   ");

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText("Name is required.")).toBeInTheDocument();
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("shows error when slug is invalid", async () => {
    const user = userEvent.setup();
    const ws = makeWorkspace({ slug: "ab" });
    render(<WorkspaceSettingsForm workspace={ws} userId="user-1" />);

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Slug must be 3–60 characters, lowercase alphanumeric and hyphens only."
        )
      ).toBeInTheDocument();
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("slug input strips invalid characters on change", async () => {
    const user = userEvent.setup();
    const ws = makeWorkspace();
    render(<WorkspaceSettingsForm workspace={ws} userId="user-1" />);

    const slugInput = screen.getByLabelText("Slug") as HTMLInputElement;
    await user.clear(slugInput);
    await user.type(slugInput, "Hello World!@#");

    // The onChange handler lowercases and strips non-alphanumeric/hyphen chars
    expect(slugInput.value).toBe("helloworld");
  });

  it("personal workspace shows cannot-be-deleted message", () => {
    const ws = makeWorkspace({ is_personal: true });
    render(<WorkspaceSettingsForm workspace={ws} userId="user-1" />);

    expect(
      screen.getByText(
        "This is your personal workspace and cannot be deleted."
      )
    ).toBeInTheDocument();

    // Delete button should not be present
    expect(
      screen.queryByRole("button", { name: /delete workspace/i })
    ).not.toBeInTheDocument();
  });

  it("non-personal workspace owned by user shows delete option", () => {
    const ws = makeWorkspace({ is_personal: false, created_by: "user-1" });
    render(<WorkspaceSettingsForm workspace={ws} userId="user-1" />);

    expect(screen.getByText("Danger zone")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete workspace/i })
    ).toBeInTheDocument();
  });

  it("non-personal workspace not owned by user hides delete option", () => {
    const ws = makeWorkspace({
      is_personal: false,
      created_by: "other-user",
    });
    render(<WorkspaceSettingsForm workspace={ws} userId="user-1" />);

    expect(screen.queryByText("Danger zone")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete workspace/i })
    ).not.toBeInTheDocument();
  });

  it("navigates to new slug URL when slug changes on save", async () => {
    const user = userEvent.setup();
    const ws = makeWorkspace({ slug: "old-slug" });
    render(<WorkspaceSettingsForm workspace={ws} userId="user-1" />);

    const slugInput = screen.getByLabelText("Slug");
    await user.clear(slugInput);
    await user.type(slugInput, "new-slug");

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/new-slug/settings");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("refreshes without navigating when only name changes", async () => {
    const user = userEvent.setup();
    const ws = makeWorkspace();
    render(<WorkspaceSettingsForm workspace={ws} userId="user-1" />);

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it("shows success message after saving", async () => {
    const user = userEvent.setup();
    const ws = makeWorkspace();
    render(<WorkspaceSettingsForm workspace={ws} userId="user-1" />);

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText("Settings saved.")).toBeInTheDocument();
    });
  });
});
