import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

// Supabase mock state
const mockResetPasswordForEmail = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
  }),
}));

import ForgotPasswordPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ForgotPasswordPage", () => {
  it("renders email field and submit button", () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send reset link/i }),
    ).toBeInTheDocument();
  });

  it("email field has type=email and is required", () => {
    render(<ForgotPasswordPage />);
    const input = screen.getByLabelText("Email");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("type", "email");
  });

  it("has a link back to sign in", () => {
    render(<ForgotPasswordPage />);
    const link = screen.getByRole("link", { name: /sign in/i });
    expect(link).toHaveAttribute("href", "/sign-in");
  });

  it("calls resetPasswordForEmail with correct parameters", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });

    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("Email"), "alice@example.com");

    const form = screen.getByRole("button", { name: /send reset link/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        "alice@example.com",
        expect.objectContaining({
          redirectTo: expect.stringContaining("/auth/callback?type=recovery"),
        }),
      );
    });
  });

  it("shows success state after sending email", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });

    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("Email"), "alice@example.com");

    const form = screen.getByRole("button", { name: /send reset link/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(screen.getByText(/check your inbox/i)).toBeInTheDocument();
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    });
  });

  it("shows error message on failure", async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: { message: "Rate limit exceeded" },
    });

    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("Email"), "alice@example.com");

    const form = screen.getByRole("button", { name: /send reset link/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      const errorEl = screen.getByText("Rate limit exceeded");
      expect(errorEl).toBeInTheDocument();
      expect(errorEl).toHaveAttribute("role", "alert");
    });
  });

  it("disables submit button while loading", async () => {
    mockResetPasswordForEmail.mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("Email"), "alice@example.com");

    const form = screen.getByRole("button", { name: /send reset link/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /sending/i }),
      ).toBeDisabled();
    });
  });

  it("allows trying again after success", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });

    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("Email"), "alice@example.com");

    const form = screen.getByRole("button", { name: /send reset link/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(screen.getByText(/check your inbox/i)).toBeInTheDocument();
    });

    // Click "try again"
    await user.click(screen.getByRole("button", { name: /try again/i }));

    // Should be back to the form
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });
});
