import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock next/link as a simple anchor
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock OAuthButtons to avoid tooltip provider dependency
vi.mock("@/components/auth/oauth-buttons", () => ({
  OAuthButtons: () => <div data-testid="oauth-buttons" />,
}));

// Supabase mock state
const mockSignUp = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
    },
    from: mockFrom,
  }),
}));

import SignUpPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SignUpPage", () => {
  it("renders all form fields", () => {
    render(<SignUpPage />);

    expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign up/i }),
    ).toBeInTheDocument();
  });

  it("display name field is required", () => {
    render(<SignUpPage />);
    const input = screen.getByLabelText("Display name");
    expect(input).toBeRequired();
  });

  it("email field has type=email and is required", () => {
    render(<SignUpPage />);
    const input = screen.getByLabelText("Email");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("type", "email");
  });

  it("password field has minLength=6 and is required", () => {
    render(<SignUpPage />);
    const input = screen.getByLabelText("Password");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("minLength", "6");
  });

  it("shows error message when sign-up fails", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: { message: "User already registered" },
    });

    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(screen.getByLabelText("Display name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");

    const form = screen.getByRole("button", { name: /sign up/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(screen.getByText("User already registered")).toBeInTheDocument();
    });
  });

  it("calls supabase.auth.signUp with correct parameters including emailRedirectTo", async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: "user-1", identities: [{ id: "id-1" }] },
        session: { access_token: "token" },
      },
      error: null,
    });

    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { workspace_id: "ws-1", workspaces: { slug: "jane" } },
    });
    const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEq = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(screen.getByLabelText("Display name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");

    const form = screen.getByRole("button", { name: /sign up/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "jane@example.com",
        password: "password123",
        options: {
          data: {
            display_name: "Jane Doe",
          },
          emailRedirectTo: "http://localhost:3000/auth/callback",
        },
      });
    });
  });

  it("shows confirmation screen when email confirmation is required", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "user-1", identities: [] }, session: null },
      error: null,
    });

    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(screen.getByLabelText("Display name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");

    const form = screen.getByRole("button", { name: /sign up/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(screen.getByText("Check your inbox")).toBeInTheDocument();
      expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    });

    // Form should no longer be visible
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    // Should not have attempted a redirect
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows confirmation screen when identities are populated but session is null (#282)", async () => {
    // Regression: Supabase now returns populated identities even when
    // email confirmation is still pending. The session being null is the
    // reliable signal.
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: "user-1", identities: [{ id: "id-1" }] },
        session: null,
      },
      error: null,
    });

    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(screen.getByLabelText("Display name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");

    const form = screen.getByRole("button", { name: /sign up/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(screen.getByText("Check your inbox")).toBeInTheDocument();
      expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("redirects to workspace after successful sign-up without email confirmation", async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: "user-1", identities: [{ id: "id-1" }] },
        session: { access_token: "token" },
      },
      error: null,
    });

    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { workspace_id: "ws-1", workspaces: { slug: "jane" } },
    });
    const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEq = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(screen.getByLabelText("Display name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");

    const form = screen.getByRole("button", { name: /sign up/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/jane");
    });
  });

  it("redirects to root when no workspace found after sign-up", async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: "user-1", identities: [{ id: "id-1" }] },
        session: { access_token: "token" },
      },
      error: null,
    });

    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null });
    const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEq = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(screen.getByLabelText("Display name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");

    const form = screen.getByRole("button", { name: /sign up/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("disables submit button while loading", async () => {
    // Never resolve to keep loading state
    mockSignUp.mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.type(screen.getByLabelText("Display name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");

    const submitButton = screen.getByRole("button", { name: /sign up/i });
    const form = submitButton.closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /creating account/i }),
      ).toBeDisabled();
    });
  });
});
