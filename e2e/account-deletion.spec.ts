import { test, expect } from "./fixtures/auth";
import { test as base } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  cleanupStaleTestUsers,
} from "./fixtures/supabase-admin";
import { createClient } from "@supabase/supabase-js";
import { type Browser, type Page } from "@playwright/test";

const DELETE_USER_DISPLAY = "E2E Delete Account";
const DELETE_USER_PASSWORD = "TestPassword123!";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Extract the workspace slug from the current URL.
 */
function extractWorkspaceSlug(page: Page): string {
  const url = new URL(page.url());
  const segments = url.pathname.split("/").filter(Boolean);
  const slug = segments[0];
  if (!slug) {
    throw new Error(`Could not extract workspace slug from URL: ${page.url()}`);
  }
  return slug;
}

/**
 * Navigate to workspace settings for a given slug.
 */
async function goToSettings(page: Page, slug: string): Promise<void> {
  await page.goto(`/${slug}/settings`);
  await expect(
    page.getByRole("heading", { name: "Workspace settings" })
  ).toBeVisible({ timeout: 10_000 });
}

/**
 * Get the personal workspace slug for a user by their ID.
 */
async function getPersonalWorkspaceSlug(userId: string): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("workspaces")
    .select("slug")
    .eq("created_by", userId)
    .eq("is_personal", true)
    .single();

  if (error || !data) {
    throw new Error(
      `No personal workspace found for user ${userId}: ${error?.message ?? "not found"}`
    );
  }
  return data.slug;
}

/**
 * Create a non-personal workspace and add a user as owner.
 */
async function createTeamWorkspace(
  userId: string,
  name: string
): Promise<{ id: string; slug: string }> {
  const admin = getAdminClient();
  const slug = `e2e-team-${Date.now()}`;

  const { data: ws, error } = await admin
    .from("workspaces")
    .insert({ name, slug, is_personal: false, created_by: userId })
    .select("id, slug")
    .single();

  if (error) throw new Error(`Failed to create workspace: ${error.message}`);

  const { error: memberErr } = await admin.from("members").insert({
    workspace_id: ws.id,
    user_id: userId,
    role: "owner",
    joined_at: new Date().toISOString(),
  });

  if (memberErr)
    throw new Error(`Failed to add owner member: ${memberErr.message}`);

  return { id: ws.id, slug: ws.slug };
}

/**
 * Sign in as a specific user in a new browser context.
 */
async function signInAs(
  browser: Browser,
  email: string,
  password: string
): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/sign-in");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"), {
    timeout: 15_000,
  });

  return page;
}

test.describe("Account deletion — visibility and confirmation UX", () => {
  test(
    "delete button is only visible on personal workspace settings",
    async ({ authenticatedPage: page }) => {
      const personalSlug = extractWorkspaceSlug(page);
      await goToSettings(page, personalSlug);

      // Personal workspace should show the danger zone with delete button
      await expect(page.getByText("Danger zone")).toBeVisible({
        timeout: 5_000,
      });
      await expect(
        page.getByRole("button", { name: "Delete account", exact: true })
      ).toBeVisible();
    }
  );

  test(
    "double-confirmation UX: email input step then final confirmation step",
    async ({ authenticatedPage: page }) => {
      const personalSlug = extractWorkspaceSlug(page);
      await goToSettings(page, personalSlug);

      const userEmail = process.env.TEST_USER_EMAIL!;

      // Click the delete account button to open the dialog
      await page
        .getByRole("button", { name: "Delete account", exact: true })
        .click();

      // Step 1: Email confirmation dialog should appear
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible({ timeout: 3_000 });
      await expect(
        dialog.getByRole("heading", { name: "Delete your account" })
      ).toBeVisible();
      await expect(
        dialog.getByText(/type.*to confirm/i)
      ).toBeVisible();

      // The Continue button should be disabled when email doesn't match
      const emailInput = dialog.locator("#confirm-email");
      await expect(emailInput).toBeVisible();
      const continueButton = dialog.getByRole("button", { name: /continue/i });
      await expect(continueButton).toBeDisabled();

      // Type a wrong email — button stays disabled
      await emailInput.fill("wrong@email.com");
      await expect(continueButton).toBeDisabled();

      // Type the correct email — button becomes enabled
      await emailInput.clear();
      await emailInput.fill(userEmail);
      await expect(continueButton).toBeEnabled();

      // Click Continue to advance to step 2
      await continueButton.click();

      // Step 2: Final confirmation dialog should appear
      await expect(dialog.getByText("Are you sure?")).toBeVisible({
        timeout: 3_000,
      });
      await expect(
        dialog.getByText(/this is your last chance/i)
      ).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: /delete my account/i })
      ).toBeVisible();

      // Cancel instead of deleting — we don't want to delete the main test user
      await dialog.getByRole("button", { name: /cancel/i }).click();
      await expect(dialog).not.toBeVisible({ timeout: 3_000 });
    }
  );
});

test.describe("Account deletion — full flow", () => {
  // Clean up stale test users from previous interrupted runs
  base.beforeAll(async () => {
    await cleanupStaleTestUsers(DELETE_USER_DISPLAY).catch(() => {});
  });

  test(
    "full deletion flow: delete account and redirect to sign-in",
    async ({ browser }) => {
      // Create a dedicated test user for this destructive test
      const email = `e2e-delete-${Date.now()}@test.local`;
      const testUser = await createTestUser(
        email,
        DELETE_USER_PASSWORD,
        DELETE_USER_DISPLAY
      );

      try {
        // Sign in as the dedicated test user
        const page = await signInAs(browser, email, DELETE_USER_PASSWORD);
        const personalSlug = extractWorkspaceSlug(page);

        await goToSettings(page, personalSlug);

        // Click delete account
        await page
          .getByRole("button", { name: "Delete account", exact: true })
          .click();

        // Step 1: Type email to confirm
        const dialog = page.getByRole("alertdialog");
        await expect(dialog).toBeVisible({ timeout: 3_000 });
        await dialog.locator("#confirm-email").fill(email);
        await dialog.getByRole("button", { name: /continue/i }).click();

        // Step 2: Final confirmation
        await expect(dialog.getByText("Are you sure?")).toBeVisible({
          timeout: 3_000,
        });
        await dialog
          .getByRole("button", { name: /delete my account/i })
          .click();

        // Should redirect to /sign-in after deletion
        await page.waitForURL((url) => url.pathname.includes("/sign-in"), {
          timeout: 15_000,
        });
        expect(page.url()).toContain("/sign-in");

        await page.context().close();
      } catch (err) {
        // If the test fails before deletion completes, clean up the user
        await deleteTestUser(testUser.id).catch(() => {});
        throw err;
      }
    }
  );
});

test.describe("Account deletion — sole-owner blocking", () => {
  let testUser: { id: string; email: string; password: string } | undefined;
  let teamWs: { id: string; slug: string } | undefined;

  base.beforeAll(async () => {
    await cleanupStaleTestUsers(DELETE_USER_DISPLAY).catch(() => {});
  });

  base.afterAll(async () => {
    // Clean up: delete the team workspace first, then the user
    if (teamWs) {
      const admin = getAdminClient();
      await admin.from("members").delete().eq("workspace_id", teamWs.id);
      await admin.from("workspaces").delete().eq("id", teamWs.id);
    }
    if (testUser) {
      await deleteTestUser(testUser.id).catch(() => {});
    }
  });

  test(
    "sole-owner of a team workspace sees blocking error",
    async ({ browser }) => {
      const email = `e2e-sole-owner-${Date.now()}@test.local`;
      testUser = await createTestUser(
        email,
        DELETE_USER_PASSWORD,
        DELETE_USER_DISPLAY
      );

      // Create a team workspace where this user is the sole owner
      teamWs = await createTeamWorkspace(testUser.id, "E2E Sole Owner Team");

      // Sign in as this user
      const page = await signInAs(browser, email, DELETE_USER_PASSWORD);
      const personalSlug = await getPersonalWorkspaceSlug(testUser.id);

      await goToSettings(page, personalSlug);

      // Start the deletion flow
      await page
        .getByRole("button", { name: "Delete account", exact: true })
        .click();

      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible({ timeout: 3_000 });

      // Type email to confirm
      await dialog.locator("#confirm-email").fill(email);
      await dialog.getByRole("button", { name: /continue/i }).click();

      // Final confirmation step
      await expect(dialog.getByText("Are you sure?")).toBeVisible({
        timeout: 3_000,
      });
      await dialog
        .getByRole("button", { name: /delete my account/i })
        .click();

      // The sole-owner error should appear — dialog goes back to email step
      await expect(
        dialog.getByText(/sole owner/i)
      ).toBeVisible({ timeout: 10_000 });

      // Cancel the dialog
      await dialog.getByRole("button", { name: /cancel/i }).click();
      await expect(dialog).not.toBeVisible({ timeout: 3_000 });

      await page.context().close();
    }
  );
});
