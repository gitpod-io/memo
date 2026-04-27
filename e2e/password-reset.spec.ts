import { test, expect } from "@playwright/test";
import { test as authTest, expect as authExpect } from "./fixtures/auth";

test.describe("Forgot password flow", () => {
  test("sign-in page has a forgot password link", async ({ page }) => {
    await page.goto("/sign-in");
    const link = page.getByRole("link", { name: /forgot password/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/forgot-password");
  });

  test("forgot password link navigates to forgot-password page", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.click('a[href="/forgot-password"]');
    await page.waitForURL(/forgot-password/, { timeout: 10_000 });
    expect(page.url()).toContain("/forgot-password");
  });

  test("forgot-password page renders email form", async ({ page }) => {
    await page.goto("/forgot-password");

    // Wait for hydration
    await page.waitForFunction(
      () => {
        const input = document.querySelector('input[type="email"]') as HTMLInputElement | null;
        return input !== null && !input.disabled;
      },
      { timeout: 10_000 },
    );

    await expect(page.getByText("Reset your password", { exact: true })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send reset link/i }),
    ).toBeVisible();
  });

  test("forgot-password page has back to sign in link", async ({ page }) => {
    await page.goto("/forgot-password");
    const link = page.getByRole("link", { name: /sign in/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/sign-in");
  });

  test("forgot-password email field is required", async ({ page }) => {
    await page.goto("/forgot-password");
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute("required", "");
    await expect(emailInput).toHaveAttribute("type", "email");
  });

  test("reset-password page renders password form", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(
      page.getByText(/set a new password/i),
    ).toBeVisible();
    await expect(page.getByLabel("New password")).toBeVisible();
    await expect(page.getByLabel("Confirm password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /reset password/i }),
    ).toBeVisible();
  });

  test("reset-password page shows mismatch error for different passwords", async ({
    page,
  }) => {
    await page.goto("/reset-password");

    // Wait for hydration
    const pwInput = page.getByLabel("New password");
    await pwInput.waitFor({ state: "visible", timeout: 10_000 });
    await page.waitForFunction(
      () => {
        const input = document.querySelector(
          'input[id="password"]',
        ) as HTMLInputElement | null;
        return input !== null && !input.disabled;
      },
      { timeout: 10_000 },
    );

    await pwInput.fill("password1");
    await page.getByLabel("Confirm password").fill("password2");
    await page.click('button[type="submit"]');

    await expect(
      page.getByText(/passwords do not match/i),
    ).toBeVisible();
  });

  test("reset-password page has back to sign in link", async ({ page }) => {
    await page.goto("/reset-password");
    const link = page.getByRole("link", { name: /back to sign in/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/sign-in");
  });
});

authTest.describe("Change password in settings", () => {
  authTest(
    "settings page shows change password section for personal workspace",
    async ({ authenticatedPage }) => {
      // Navigate to settings — the authenticated user lands in their workspace
      const url = authenticatedPage.url();
      const workspaceSlug = url.split("/").filter(Boolean).pop();
      if (!workspaceSlug) {
        authTest.skip(true, "Could not determine workspace slug");
        return;
      }

      await authenticatedPage.goto(`/${workspaceSlug}/settings`);
      await authenticatedPage.waitForLoadState("networkidle");

      await authExpect(
        authenticatedPage.getByText("Change password", { exact: true }),
      ).toBeVisible({ timeout: 10_000 });
      await authExpect(
        authenticatedPage.getByLabel("New password", { exact: true }),
      ).toBeVisible();
      await authExpect(
        authenticatedPage.getByLabel("Confirm new password", { exact: true }),
      ).toBeVisible();
      await authExpect(
        authenticatedPage.getByRole("button", { name: /update password/i }),
      ).toBeVisible();
    },
  );

  authTest(
    "change password shows mismatch error",
    async ({ authenticatedPage }) => {
      const url = authenticatedPage.url();
      const workspaceSlug = url.split("/").filter(Boolean).pop();
      if (!workspaceSlug) {
        authTest.skip(true, "Could not determine workspace slug");
        return;
      }

      await authenticatedPage.goto(`/${workspaceSlug}/settings`);
      await authenticatedPage.waitForLoadState("networkidle");

      // Wait for the change password section to appear
      await authExpect(
        authenticatedPage.getByLabel("New password", { exact: true }),
      ).toBeVisible({ timeout: 10_000 });

      await authenticatedPage.getByLabel("New password", { exact: true }).fill("newpass1");
      await authenticatedPage
        .getByLabel("Confirm new password", { exact: true })
        .fill("newpass2");
      await authenticatedPage
        .getByRole("button", { name: /update password/i })
        .click();

      await authExpect(
        authenticatedPage.getByText(/passwords do not match/i),
      ).toBeVisible();
    },
  );
});
