import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSignInWithOAuth = vi.fn();
const mockCaptureSupabaseError = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    },
  }),
}));

vi.mock("@/lib/sentry", () => ({
  captureSupabaseError: (...args: unknown[]) =>
    mockCaptureSupabaseError(...args),
}));

import { OAuthButtons } from "./oauth-buttons";

beforeEach(() => {
  vi.clearAllMocks();
  mockSignInWithOAuth.mockResolvedValue({ error: null });
});

describe("OAuthButtons", () => {
  it("renders GitHub and Google buttons", () => {
    render(<OAuthButtons />);
    expect(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeInTheDocument();
  });

  it("buttons are not disabled by default", () => {
    render(<OAuthButtons />);
    expect(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).not.toBeDisabled();
  });

  it("calls signInWithOAuth with github provider on click", async () => {
    const user = userEvent.setup();
    render(<OAuthButtons />);

    await user.click(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    );

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: { redirectTo: expect.stringContaining("/auth/callback") },
    });
  });

  it("calls signInWithOAuth with google provider on click", async () => {
    const user = userEvent.setup();
    render(<OAuthButtons />);

    await user.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: expect.stringContaining("/auth/callback") },
    });
  });

  it("shows error message and reports to Sentry when signInWithOAuth fails", async () => {
    const oauthError = { message: "Provider not enabled" };
    mockSignInWithOAuth.mockResolvedValue({ error: oauthError });
    const user = userEvent.setup();
    render(<OAuthButtons />);

    await user.click(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Provider not enabled",
      );
    });
    expect(mockCaptureSupabaseError).toHaveBeenCalledWith(
      oauthError,
      "oauth.signIn.github",
    );
  });

  it("disables both buttons while a provider is loading", async () => {
    // Make signInWithOAuth hang to keep loading state
    mockSignInWithOAuth.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<OAuthButtons />);

    await user.click(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Continue with GitHub" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Continue with Google" }),
      ).toBeDisabled();
    });
  });
});
