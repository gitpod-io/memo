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
const mockSignInWithPassword = vi.fn();
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      getUser: mockGetUser,
    },
    from: mockFrom,
  }),
}));

import SignInPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SignInPage", () => {
  it("renders email and password fields", () => {
    render(<SignInPage />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it("email field has type=email and is required", () => {
    render(<SignInPage />);
    const input = screen.getByLabelText("Email");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("type", "email");
  });

  it("password field has minLength=6 and is required", () => {
    render(<SignInPage />);
    const input = screen.getByLabelText("Password");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("minLength", "6");
  });

  it("shows error message when sign-in fails", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    const user = userEvent.setup();
    render(<SignInPage />);

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpass");

    const form = screen.getByRole("button", { name: /sign in/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(
        screen.getByText("Invalid login credentials"),
      ).toBeInTheDocument();
    });
  });

  it("calls supabase.auth.signInWithPassword with correct parameters", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { workspace_id: "ws-1", workspaces: { slug: "jane" } },
    });
    const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEq = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const user = userEvent.setup();
    render(<SignInPage />);

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");

    const form = screen.getByRole("button", { name: /sign in/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "jane@example.com",
        password: "password123",
      });
    });
  });

  it("redirects to workspace after successful sign-in", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { workspace_id: "ws-1", workspaces: { slug: "jane" } },
    });
    const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEq = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const user = userEvent.setup();
    render(<SignInPage />);

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");

    const form = screen.getByRole("button", { name: /sign in/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/jane");
    });
  });

  it("redirects to root when no workspace found after sign-in", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null });
    const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEq = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const user = userEvent.setup();
    render(<SignInPage />);

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");

    const form = screen.getByRole("button", { name: /sign in/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("disables submit button while loading", async () => {
    // Never resolve to keep loading state
    mockSignInWithPassword.mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    render(<SignInPage />);

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");

    const submitButton = screen.getByRole("button", { name: /sign in/i });
    const form = submitButton.closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /signing in/i }),
      ).toBeDisabled();
    });
  });
});
