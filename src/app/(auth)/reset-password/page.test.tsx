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

// Mock Sentry
vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: vi.fn(),
}));

// Supabase mock state
const mockUpdateUser = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      updateUser: mockUpdateUser,
    },
  }),
}));

import ResetPasswordPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

describe("ResetPasswordPage", () => {
  it("renders password and confirm password fields", () => {
    render(<ResetPasswordPage />);

    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reset password/i }),
    ).toBeInTheDocument();
  });

  it("password fields have minLength=6 and are required", () => {
    render(<ResetPasswordPage />);
    const pw = screen.getByLabelText("New password");
    const cpw = screen.getByLabelText("Confirm password");
    expect(pw).toBeRequired();
    expect(pw).toHaveAttribute("minLength", "6");
    expect(cpw).toBeRequired();
    expect(cpw).toHaveAttribute("minLength", "6");
  });

  it("shows error when passwords do not match", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText("New password"), "password1");
    await user.type(screen.getByLabelText("Confirm password"), "password2");

    const form = screen.getByRole("button", { name: /reset password/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      const errorEl = screen.getByText("Passwords do not match.");
      expect(errorEl).toBeInTheDocument();
      expect(errorEl).toHaveAttribute("role", "alert");
    });

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("calls updateUser with correct password on match", async () => {
    mockUpdateUser.mockResolvedValue({ error: null });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText("New password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm password"), "newpass123");

    const form = screen.getByRole("button", { name: /reset password/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: "newpass123",
      });
    });
  });

  it("shows success state after password update", async () => {
    mockUpdateUser.mockResolvedValue({ error: null });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText("New password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm password"), "newpass123");

    const form = screen.getByRole("button", { name: /reset password/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(screen.getByText(/password updated/i)).toBeInTheDocument();
    });
  });

  it("shows error message on API failure", async () => {
    mockUpdateUser.mockResolvedValue({
      error: { message: "Token expired" },
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText("New password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm password"), "newpass123");

    const form = screen.getByRole("button", { name: /reset password/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      const errorEl = screen.getByText("Token expired");
      expect(errorEl).toBeInTheDocument();
      expect(errorEl).toHaveAttribute("role", "alert");
    });
  });

  it("disables submit button while loading", async () => {
    mockUpdateUser.mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText("New password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm password"), "newpass123");

    const form = screen.getByRole("button", { name: /reset password/i })
      .closest("form")!;
    form.requestSubmit();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /updating/i }),
      ).toBeDisabled();
    });
  });

  it("has a link back to sign in", () => {
    render(<ResetPasswordPage />);
    const link = screen.getByRole("link", { name: /back to sign in/i });
    expect(link).toHaveAttribute("href", "/sign-in");
  });
});
