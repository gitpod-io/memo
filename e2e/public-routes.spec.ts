import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders title, tagline, and navigation links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Memo" })).toBeVisible();
    await expect(
      page.getByText("A Notion-style workspace, built with zero human code."),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /view source/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  });

  test("has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Filter out known non-actionable errors (e.g. favicon 404, third-party scripts,
    // Supabase auth 403s when no session exists on the public landing page)
    const actionableErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("ERR_BLOCKED_BY_CLIENT") &&
        !e.includes("Failed to load resource"),
    );
    expect(actionableErrors).toHaveLength(0);
  });
});

test.describe("Sign-in form validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
    // Wait for hydration so controlled inputs are ready
    await page.locator('input[type="email"]').waitFor({ state: "visible" });
    await page.waitForTimeout(300);
  });

  test("empty submit is blocked by browser validation", async ({ page }) => {
    await page.getByRole("button", { name: /sign in/i }).click();
    // The form should not navigate — still on sign-in
    expect(page.url()).toContain("/sign-in");
    // The email input should be invalid (required but empty)
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute("required", "");
  });

  test("invalid email format is blocked by browser validation", async ({
    page,
  }) => {
    await page.fill('input[type="email"]', "not-an-email");
    await page.fill('input[type="password"]', "password123");
    await page.getByRole("button", { name: /sign in/i }).click();
    // Should still be on sign-in — browser blocks submission for invalid email
    expect(page.url()).toContain("/sign-in");
  });

  test("short password is blocked by minLength validation", async ({
    page,
  }) => {
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "abc");
    await page.getByRole("button", { name: /sign in/i }).click();
    // Should still be on sign-in — browser blocks submission for short password
    expect(page.url()).toContain("/sign-in");
  });
});

test.describe("Sign-up form validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-up");
    await page.locator('input[type="email"]').waitFor({ state: "visible" });
    await page.waitForTimeout(300);
  });

  test("empty submit is blocked by browser validation", async ({ page }) => {
    await page.getByRole("button", { name: /sign up/i }).click();
    expect(page.url()).toContain("/sign-up");
    // Display name, email, and password are all required
    const displayNameInput = page.locator("#display-name");
    await expect(displayNameInput).toHaveAttribute("required", "");
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute("required", "");
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toHaveAttribute("required", "");
  });

  test("invalid email format is blocked by browser validation", async ({
    page,
  }) => {
    await page.fill("#display-name", "Test User");
    await page.fill('input[type="email"]', "bad-email");
    await page.fill('input[type="password"]', "password123");
    await page.getByRole("button", { name: /sign up/i }).click();
    expect(page.url()).toContain("/sign-up");
  });

  test("short password is blocked by minLength validation", async ({
    page,
  }) => {
    await page.fill("#display-name", "Test User");
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "ab");
    await page.getByRole("button", { name: /sign up/i }).click();
    expect(page.url()).toContain("/sign-up");
  });
});

test.describe("Unknown routes", () => {
  test("unknown top-level path redirects to /sign-in for unauthenticated users", async ({
    page,
  }) => {
    // All unknown paths match the [workspaceSlug] dynamic segment in the (app)
    // route group, which redirects unauthenticated users to sign-in.
    // The not-found page is only visible to authenticated users.
    await page.goto("/nonexistent-route-abc123");
    await page.waitForURL(/sign-in/, { timeout: 10_000 });
    expect(page.url()).toContain("/sign-in");
  });
});

test.describe("Auth redirects for protected routes", () => {
  const protectedRoutes = [
    "/some-workspace",
    "/some-workspace/some-page-id",
    "/some-workspace/settings",
    "/some-workspace/settings/members",
  ];

  for (const route of protectedRoutes) {
    test(`${route} redirects to /sign-in`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/sign-in/, { timeout: 10_000 });
      expect(page.url()).toContain("/sign-in");
    });
  }
});

test.describe("Health API", () => {
  test("/api/health returns a successful response", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("timestamp");
    expect(["ok", "degraded"]).toContain(body.status);
  });
});
