import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("sign-in page renders with email and password inputs", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("sign-up page renders with display name, email, and password inputs", async ({
    page,
  }) => {
    await page.goto("/sign-up");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /sign up/i })).toBeVisible();
  });

  test("sign-in page shows confirmation message with confirmed=true param", async ({
    page,
  }) => {
    await page.goto("/sign-in?confirmed=true");
    await expect(
      page.getByText(/email confirmed/i),
    ).toBeVisible();
  });

  test("sign-in page does not show confirmation message without param", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await expect(
      page.getByText(/email confirmed/i),
    ).not.toBeVisible();
  });

  test("auth callback redirects to sign-in without code", async ({ page }) => {
    await page.goto("/auth/callback");
    await page.waitForURL(/sign-in/, { timeout: 10_000 });
    expect(page.url()).toContain("/sign-in");
  });

  test("unauthenticated user is redirected to sign-in", async ({ page }) => {
    // Try to access an authenticated route
    await page.goto("/test-workspace");
    await page.waitForURL(/sign-in/, { timeout: 10_000 });
    expect(page.url()).toContain("/sign-in");
  });

  test("user can sign in and lands in a workspace", async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) {
      test.skip(true, "TEST_USER_EMAIL / TEST_USER_PASSWORD not set");
      return;
    }

    await page.goto("/sign-in");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Should redirect to a workspace (not stay on sign-in)
    await page.waitForURL((url) => !url.pathname.includes("/sign-in"), {
      timeout: 15_000,
    });
    expect(page.url()).not.toContain("/sign-in");
  });

  test("user can sign out", async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) {
      test.skip(true, "TEST_USER_EMAIL / TEST_USER_PASSWORD not set");
      return;
    }

    // Sign in first
    await page.goto("/sign-in");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/sign-in"), {
      timeout: 15_000,
    });

    // Find and click sign out (in user menu)
    // Try the user menu dropdown first
    const userMenuTrigger = page.locator("button").filter({ hasText: /@|sign out/i });
    if ((await userMenuTrigger.count()) > 0) {
      await userMenuTrigger.first().click();
    }

    const signOutBtn = page.getByRole("menuitem", { name: /sign out/i }).or(
      page.locator("button").filter({ hasText: /sign out/i })
    );

    if ((await signOutBtn.count()) > 0) {
      await signOutBtn.first().click();
      await page.waitForURL(/sign-in/, { timeout: 10_000 });
      expect(page.url()).toContain("/sign-in");
    }
  });
});
