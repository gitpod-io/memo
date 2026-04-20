import { test, expect } from "./fixtures/auth";
import { type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const WS_PREFIX = "E2E Limit";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function resolveTestUserId(): Promise<string> {
  const admin = getAdminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find(
    (u) => u.email === process.env.TEST_USER_EMAIL
  );
  if (!user) throw new Error("Test user not found");
  return user.id;
}

async function cleanupTestWorkspaces(): Promise<void> {
  const admin = getAdminClient();
  await admin
    .from("workspaces")
    .delete()
    .eq("is_personal", false)
    .like("name", `${WS_PREFIX}%`);
}

/**
 * Open the workspace switcher dropdown and click "Create workspace".
 */
async function openCreateWorkspaceDialog(page: Page): Promise<void> {
  const sidebar = page.locator("aside, [data-sidebar]").first();
  await expect(sidebar).toBeVisible({ timeout: 10_000 });

  const trigger = sidebar.locator('button[aria-label="Switch workspace"]');
  await trigger.click();

  const createItem = page.getByRole("menuitem", {
    name: /create workspace/i,
  });
  await expect(createItem).toBeVisible({ timeout: 3_000 });
  await createItem.click();

  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3_000 });
}

test.describe("Workspace creation limit", () => {
  test.describe.configure({ mode: "serial" });

  let userId: string;

  test.beforeAll(async () => {
    userId = await resolveTestUserId();
    await cleanupTestWorkspaces();
  });

  test.afterAll(async () => {
    await cleanupTestWorkspaces();
  });

  test("enforces workspace creation limit end-to-end", async ({
    authenticatedPage: page,
  }) => {
    // ── Step 1: Create workspaces up to the limit (1 personal + 2 additional) ──

    // Create first additional workspace
    await openCreateWorkspaceDialog(page);

    let dialog = page.getByRole("dialog");
    let nameInput = dialog.locator("#workspace-name");
    await expect(nameInput).toBeVisible();

    const ws1Name = `${WS_PREFIX} One ${Date.now()}`;
    await nameInput.fill(ws1Name);
    await dialog.getByRole("button", { name: /create workspace/i }).click();

    await page.waitForURL(
      (url) => !url.pathname.includes("/sign-in"),
      { timeout: 15_000 }
    );
    await page.waitForLoadState("networkidle");

    // Create second additional workspace
    await openCreateWorkspaceDialog(page);

    dialog = page.getByRole("dialog");
    nameInput = dialog.locator("#workspace-name");
    await expect(nameInput).toBeVisible();

    const ws2Name = `${WS_PREFIX} Two ${Date.now()}`;
    await nameInput.fill(ws2Name);
    await dialog.getByRole("button", { name: /create workspace/i }).click();

    await page.waitForLoadState("networkidle");

    // Reload to ensure the WorkspaceSwitcher has fresh data
    await page.reload();
    await page.waitForLoadState("networkidle");

    // ── Step 2: Verify the "Create workspace" button shows "Limit reached" ──

    const sidebar = page.locator("aside, [data-sidebar]").first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    const trigger = sidebar.locator('button[aria-label="Switch workspace"]');
    await trigger.click();

    const createItem = page.getByRole("menuitem", {
      name: /create workspace/i,
    });
    await expect(createItem).toBeVisible({ timeout: 3_000 });
    await expect(createItem.getByText("Limit reached")).toBeVisible();

    // ── Step 3: Verify the dialog shows the limit message ──

    await createItem.click();

    dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 3_000 });

    // Dialog description should mention the limit
    await expect(
      dialog.getByText(/reached the limit of 3 workspaces/i)
    ).toBeVisible();

    // Should show the hint to delete an existing workspace
    await expect(
      dialog.getByText(/delete an existing workspace/i)
    ).toBeVisible();

    // The form should NOT be rendered — no name input, no create button
    await expect(dialog.locator("#workspace-name")).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: /create workspace/i })
    ).toHaveCount(0);

    // Close the dialog
    await page.keyboard.press("Escape");
  });

  test("server rejects workspace creation beyond the limit", async () => {
    // Attempt to insert a 4th workspace directly via the admin client.
    // The DB trigger fires regardless of RLS, verifying server-side enforcement.
    const admin = getAdminClient();
    const slug = `e2e-limit-overflow-${Date.now()}`;

    const { error } = await admin
      .from("workspaces")
      .insert({
        name: `${WS_PREFIX} Overflow`,
        slug,
        is_personal: false,
        created_by: userId,
      })
      .select("id")
      .single();

    expect(error).not.toBeNull();
    expect(error!.message).toContain("Workspace limit reached");
  });
});
