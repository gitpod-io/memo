import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

beforeEach(() => {
  vi.clearAllMocks();
  mockSignInWithOAuth.mockResolvedValue({ error: null });
});

describe("OAuthButtons — OAuth disabled (default)", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_OAUTH_ENABLED;
    vi.resetModules();
  });

  it("renders disabled buttons when NEXT_PUBLIC_OAUTH_ENABLED is not set", async () => {
    const { OAuthButtons } = await import("./oauth-buttons");
    render(<OAuthButtons />);

    const githubBtn = screen.getByRole("button", { name: "Continue with GitHub" });
    const googleBtn = screen.getByRole("button", { name: "Continue with Google" });

    expect(githubBtn).toBeDisabled();
    expect(googleBtn).toBeDisabled();
  });

  it("does not call signInWithOAuth when buttons are disabled", async () => {
    const { OAuthButtons } = await import("./oauth-buttons");
    const user = userEvent.setup();
    render(<OAuthButtons />);

    const githubBtn = screen.getByRole("button", { name: "Continue with GitHub" });
    await user.click(githubBtn);

    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
  });

  it("shows 'Coming soon' tooltip on hover over disabled GitHub button", async () => {
    const { OAuthButtons } = await import("./oauth-buttons");
    const user = userEvent.setup();
    render(<OAuthButtons />);

    const githubBtn = screen.getByRole("button", { name: "Continue with GitHub" });
    // Hover the wrapping span (parent of the disabled button)
    const trigger = githubBtn.closest("[data-slot='tooltip-trigger']") ?? githubBtn.parentElement!;
    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByText("Coming soon")).toBeInTheDocument();
    });
  });

  it("shows 'Coming soon' tooltip on hover over disabled Google button", async () => {
    const { OAuthButtons } = await import("./oauth-buttons");
    const user = userEvent.setup();
    render(<OAuthButtons />);

    const googleBtn = screen.getByRole("button", { name: "Continue with Google" });
    const trigger = googleBtn.closest("[data-slot='tooltip-trigger']") ?? googleBtn.parentElement!;
    await user.hover(trigger);

    await waitFor(() => {
      expect(screen.getByText("Coming soon")).toBeInTheDocument();
    });
  });
});

describe("OAuthButtons — OAuth enabled", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_OAUTH_ENABLED = "true";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_OAUTH_ENABLED;
  });

  it("renders GitHub and Google buttons", async () => {
    const { OAuthButtons } = await import("./oauth-buttons");
    render(<OAuthButtons />);
    expect(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeInTheDocument();
  });

  it("buttons are not disabled by default", async () => {
    const { OAuthButtons } = await import("./oauth-buttons");
    render(<OAuthButtons />);
    expect(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).not.toBeDisabled();
  });

  it("calls signInWithOAuth with github provider on click", async () => {
    const { OAuthButtons } = await import("./oauth-buttons");
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
    const { OAuthButtons } = await import("./oauth-buttons");
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
    const { OAuthButtons } = await import("./oauth-buttons");
    const user = userEvent.setup();
    render(<OAuthButtons />);

    await user.click(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Provider not enabled",
      );
      expect(mockCaptureSupabaseError).toHaveBeenCalledWith(
        oauthError,
        "oauth.signIn.github",
      );
    });
  });

  it("disables both buttons while a provider is loading", async () => {
    // Make signInWithOAuth hang to keep loading state
    mockSignInWithOAuth.mockReturnValue(new Promise(() => {}));
    const { OAuthButtons } = await import("./oauth-buttons");
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
