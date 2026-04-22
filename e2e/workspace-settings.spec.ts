import { test, expect } from "./fixtures/auth";
import { type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Resolve the test user's ID from their email.
 * Uses the profiles table instead of paginated auth.admin.listUsers() to
 * avoid missing the user when there are more users than the default page size.
 */
async function resolveTestUserId(): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("email", process.env.TEST_USER_EMAIL!)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      `Test user ${process.env.TEST_USER_EMAIL} not found in profiles: ${error?.message ?? "no match"}`
    );
  }
  return data.id;
}

/**
 * Create a workspace via the admin client (bypasses RLS).
 * Also adds the test user as owner.
 */
async function createTestWorkspace(
  userId: string,
  name: string
): Promise<{ id: string; slug: string }> {
  const admin = getAdminClient();
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const uniqueSlug = `${slug}-${Date.now()}`;

  const { data: ws, error } = await admin
    .from("workspaces")
    .insert({
      name,
      slug: uniqueSlug,
      is_personal: false,
      created_by: userId,
    })
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
 * Delete a workspace via the admin client.
 */
async function deleteTestWorkspace(workspaceId: string): Promise<void> {
  const admin = getAdminClient();
  await admin.from("workspaces").delete().eq("id", workspaceId);
}

/**
 * Delete all non-personal workspaces owned by the given user.
 * Called in beforeAll to guarantee a clean slate regardless of what
 * previous (possibly crashed) test runs left behind.
 *
 * Also cleans up workspaces where the user is a member but not the
 * creator (e.g. workspaces created via UI by other test files).
 */
async function cleanupAllNonPersonalWorkspaces(
  userId: string
): Promise<void> {
  const admin = getAdminClient();

  // Delete workspaces created by this user
  await admin
    .from("workspaces")
    .delete()
    .eq("is_personal", false)
    .eq("created_by", userId);

  // Also delete any non-personal workspaces where the user is a member
  // but not the creator (handles workspaces created via RPC where
  // created_by might differ from expectations)
  const { data: memberships } = await admin
    .from("members")
    .select("workspace_id, workspaces(id, is_personal)")
    .eq("user_id", userId);

  if (memberships) {
    for (const m of memberships) {
      const ws = m.workspaces as unknown as {
        id: string;
        is_personal: boolean;
      };
      if (ws && !ws.is_personal) {
        await admin.from("workspaces").delete().eq("id", ws.id);
      }
    }
  }
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

test.describe("Workspace settings", () => {
  test.describe.configure({ mode: "serial" });

  let userId: string;

  test.beforeAll(async () => {
    userId = await resolveTestUserId();
    // Remove all non-personal workspaces for the test user to guarantee
    // we stay under the 3-workspace limit, even if a previous run crashed
    // and afterAll never ran.
    await cleanupAllNonPersonalWorkspaces(userId);
  });

  test.afterAll(async () => {
    await cleanupAllNonPersonalWorkspaces(userId).catch(() => {});
  });

  test("personal workspace shows personal workspace message and no workspace delete button", async ({
    authenticatedPage: page,
  }) => {
    // Look up the personal workspace slug directly from the DB to avoid
    // depending on which workspace the user lands on after login.
    const admin = getAdminClient();
    const { data: personalWs } = await admin
      .from("workspaces")
      .select("slug")
      .eq("created_by", userId)
      .eq("is_personal", true)
      .single();

    if (!personalWs) throw new Error("Personal workspace not found");

    await goToSettings(page, personalWs.slug);

    // Personal workspace should explain it's tied to the account
    await expect(
      page.getByText(
        "This is your personal workspace. It will be deleted if you delete your account."
      )
    ).toBeVisible({ timeout: 5_000 });

    // There should be no "Delete workspace" button (only "Delete account")
    const deleteWorkspaceButton = page.getByRole("button", {
      name: /delete workspace/i,
    });
    await expect(deleteWorkspaceButton).toHaveCount(0);
  });

  test("change workspace name and verify sidebar updates", async ({
    authenticatedPage: page,
  }) => {
    const wsName = `E2E WS Rename ${Date.now()}`;
    const ws = await createTestWorkspace(userId, wsName);

    try {
      await goToSettings(page, ws.slug);

      // Verify the name input has the current workspace name
      const nameInput = page.locator("#ws-name");
      await expect(nameInput).toHaveValue(wsName, { timeout: 5_000 });

      // Change the name
      const newName = `Renamed E2E ${Date.now()}`;
      await nameInput.clear();
      await nameInput.fill(newName);

      // Save changes
      await page.getByRole("button", { name: /save changes/i }).click();

      // Wait for the success message
      await expect(page.getByText("Settings saved.")).toBeVisible({
        timeout: 10_000,
      });

      // Reload the page so the client-side WorkspaceSwitcher re-fetches
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Workspace settings" })
      ).toBeVisible({ timeout: 10_000 });

      // Verify the sidebar workspace switcher shows the updated name
      const sidebar = page.locator("aside, [data-sidebar]").first();
      await expect(sidebar).toBeVisible({ timeout: 5_000 });

      const workspaceTrigger = sidebar.locator(
        'button[aria-label="Switch workspace"]'
      );
      await expect(workspaceTrigger).toContainText(newName, {
        timeout: 10_000,
      });
    } finally {
      // Clean up via admin
      await deleteTestWorkspace(ws.id);
    }
  });

  test("delete non-personal workspace with confirmation", async ({
    authenticatedPage: page,
  }) => {
    const wsName = `E2E WS Delete ${Date.now()}`;
    const ws = await createTestWorkspace(userId, wsName);

    await goToSettings(page, ws.slug);

    // The "Danger zone" section should be visible
    await expect(page.getByText("Danger zone")).toBeVisible({
      timeout: 5_000,
    });

    // Click the delete button
    const deleteButton = page.getByRole("button", {
      name: /delete workspace/i,
    });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // The confirmation dialog should appear
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    await expect(
      dialog.getByText(/are you sure you want to delete/i)
    ).toBeVisible();
    await expect(dialog.getByText(wsName)).toBeVisible();

    // Confirm deletion
    await dialog.getByRole("button", { name: /delete workspace/i }).click();

    // Should redirect to another workspace (personal workspace)
    await page.waitForURL((url) => !url.pathname.includes(ws.slug), {
      timeout: 15_000,
    });

    // Verify we landed on a valid workspace page (not an error page)
    const currentSlug = extractWorkspaceSlug(page);
    expect(currentSlug).toBeTruthy();
    expect(currentSlug).not.toBe(ws.slug);

    // Reload so the client-side WorkspaceSwitcher re-fetches the list
    await page.reload();
    const sidebar = page.locator("aside, [data-sidebar]").first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Verify the deleted workspace is no longer in the workspace switcher
    const workspaceTrigger = sidebar.locator(
      'button[aria-label="Switch workspace"]'
    );
    await workspaceTrigger.click();
    await page.waitForTimeout(500);

    // The deleted workspace name should not appear in the dropdown
    const menuItems = page.locator('[role="menuitem"]');
    const count = await menuItems.count();
    for (let i = 0; i < count; i++) {
      const text = await menuItems.nth(i).textContent();
      expect(text).not.toContain(wsName);
    }
  });
});
