import { test as publicTest, expect as publicExpect } from "@playwright/test";
import { test, expect } from "./fixtures/auth";

/**
 * Public (unauthenticated) not-found behavior.
 *
 * All unknown top-level paths match the [workspaceSlug] dynamic segment in the
 * (app) route group, which redirects unauthenticated users to /sign-in. The
 * root not-found page is not directly reachable via normal navigation.
 */
publicTest.describe("Public not-found routes", () => {
  publicTest("non-existent public route redirects to sign-in", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/this-route-does-not-exist-abc123");
    await page.waitForURL(/sign-in/, { timeout: 15_000 });
    publicExpect(page.url()).toContain("/sign-in");

    // Filter out expected 404 network responses and non-actionable errors
    const actionableErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("ERR_BLOCKED_BY_CLIENT") &&
        !e.includes("404"),
    );
    publicExpect(actionableErrors).toHaveLength(0);
  });
});

// Base UI emits a console error when Button renders a non-<button> element
// via the `render` prop (e.g. <Link>). This is a framework warning, not an
// application bug — filter it from console error assertions.
function isActionableError(msg: string): boolean {
  return (
    !msg.includes("favicon") &&
    !msg.includes("ERR_BLOCKED_BY_CLIENT") &&
    !msg.includes("404") &&
    !msg.includes("Base UI")
  );
}

/**
 * Authenticated not-found behavior.
 *
 * When an authenticated user navigates to a non-existent workspace or page,
 * the app not-found page renders with appropriate messaging.
 */
test.describe("Authenticated not-found routes", () => {
  test("non-existent workspace slug shows app not-found page", async ({
    authenticatedPage: page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/workspace-that-does-not-exist-xyz789");
    await page.waitForLoadState("networkidle");

    // The app not-found page should render with the expected messaging
    await expect(
      page.getByRole("heading", { name: /page not found/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/workspace or page you're looking for doesn't exist/i),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /go home/i })).toBeVisible();

    const actionableErrors = errors.filter(isActionableError);
    expect(actionableErrors).toHaveLength(0);
  });

  test("non-existent page ID within valid workspace shows not-found page", async ({
    authenticatedPage: page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // After login, extract the current workspace slug from the URL
    const url = page.url();
    const pathSegments = new URL(url).pathname.split("/").filter(Boolean);
    const workspaceSlug = pathSegments[0];

    if (!workspaceSlug) {
      test.skip(true, "Could not determine workspace slug from URL");
      return;
    }

    // Navigate to a non-existent page ID (valid UUID format but doesn't exist)
    await page.goto(`/${workspaceSlug}/00000000-0000-0000-0000-000000000000`);
    await page.waitForLoadState("networkidle");

    // The app not-found page should render
    await expect(
      page.getByRole("heading", { name: /page not found/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/workspace or page you're looking for doesn't exist/i),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /go home/i })).toBeVisible();

    const actionableErrors = errors.filter(isActionableError);
    expect(actionableErrors).toHaveLength(0);
  });

  test("Go home link on not-found page navigates to root", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/workspace-that-does-not-exist-xyz789");
    await page.waitForLoadState("networkidle");

    const goHomeLink = page.getByRole("link", { name: /go home/i });
    await expect(goHomeLink).toBeVisible({ timeout: 10_000 });
    await goHomeLink.click();

    // Should navigate away from the not-found page to the home/workspace page
    await page.waitForURL(
      (u) => !u.pathname.includes("workspace-that-does-not-exist"),
      { timeout: 10_000 },
    );
  });
});
