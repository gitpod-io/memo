import { test, expect } from "./fixtures/auth";
import {
  createTestUser,
  deleteTestUser,
  getInviteToken,
  cleanupInvitesForEmail,
  cleanupStaleTestUsers,
} from "./fixtures/supabase-admin";
import { createClient } from "@supabase/supabase-js";
import { type Browser, type Page } from "@playwright/test";

const INVITE_EMAIL = `e2e-member-${Date.now()}@test.local`;
const INVITE_DISPLAY_NAME = "E2E Member";
const INVITE_PASSWORD = "TestPassword123!";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Extract the workspace slug from the current URL after login redirect.
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
 * Navigate to the members settings page for a given workspace slug.
 */
async function goToMembersPage(page: Page, slug: string): Promise<void> {
  await page.goto(`/${slug}/settings/members`);
  await expect(page.getByRole("heading", { name: "Members" })).toBeVisible({
    timeout: 10_000,
  });
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

test.describe("Workspace member management", () => {
  test.describe.configure({ mode: "serial" });

  // Shared state across serial tests
  let invitedUserId: string | undefined;
  let workspaceSlug: string;

  // Remove stale test users from previous runs whose cleanup was interrupted.
  // Without this, a leftover member with display_name "E2E Member" causes
  // the re-invite test to find 2 matching elements (strict mode violation).
  test.beforeAll(async () => {
    await cleanupStaleTestUsers(INVITE_DISPLAY_NAME).catch(() => {});
    await cleanupInvitesForEmail(INVITE_EMAIL).catch(() => {});
  });

  test.afterAll(async () => {
    await cleanupInvitesForEmail(INVITE_EMAIL).catch(() => {});
    if (invitedUserId) {
      await deleteTestUser(invitedUserId).catch(() => {});
    }
    // Fallback: clean up by display name in case invitedUserId was never set
    await cleanupStaleTestUsers(INVITE_DISPLAY_NAME).catch(() => {});
  });

  test("owner can invite a user by email", async ({
    authenticatedPage: page,
  }) => {
    workspaceSlug = extractWorkspaceSlug(page);
    await goToMembersPage(page, workspaceSlug);

    // The invite form should be visible (owner has admin privileges)
    const inviteSection = page.locator("text=Invite").first();
    await expect(inviteSection).toBeVisible();

    // Fill in the invite form
    await page.fill("#invite-email", INVITE_EMAIL);

    // Submit the invite
    await page.getByRole("button", { name: "Invite", exact: true }).click();

    // Wait for the invite link to appear (PR #240 replaced "Invite sent." with a copyable link)
    await expect(
      page.getByRole("button", { name: "Copy invite link" })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("invited user appears in the pending invites list", async ({
    authenticatedPage: page,
  }) => {
    await goToMembersPage(page, workspaceSlug);

    // The pending invites section should show the invited email
    const pendingSection = page.locator("text=Pending invites").first();
    await expect(pendingSection).toBeVisible({ timeout: 10_000 });

    // The invited email should appear in the pending invites table
    await expect(page.locator(`text=${INVITE_EMAIL}`)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("owner can revoke a pending invite", async ({
    authenticatedPage: page,
  }) => {
    await goToMembersPage(page, workspaceSlug);

    // Find the revoke button for the invited email's row
    const inviteRow = page
      .getByRole("row")
      .filter({ hasText: INVITE_EMAIL });
    await expect(inviteRow).toBeVisible({ timeout: 5_000 });

    const revokeButton = inviteRow.getByRole("button", {
      name: new RegExp(`Revoke invite for ${INVITE_EMAIL}`, "i"),
    });
    await revokeButton.click();

    // The invite should disappear from the list
    await expect(page.locator(`text=${INVITE_EMAIL}`)).not.toBeVisible({
      timeout: 5_000,
    });
  });

  test("owner can re-invite and invited user can accept", async ({
    authenticatedPage: page,
    browser,
  }) => {
    await goToMembersPage(page, workspaceSlug);

    // Re-invite the same email
    await page.fill("#invite-email", INVITE_EMAIL);
    await page.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Copy invite link" })
    ).toBeVisible({ timeout: 10_000 });

    // Create the test user via admin API so they can accept the invite
    const testUser = await createTestUser(
      INVITE_EMAIL,
      INVITE_PASSWORD,
      INVITE_DISPLAY_NAME
    );
    invitedUserId = testUser.id;

    // Look up the invite token via admin API
    const admin = getAdminClient();
    const { data: ws } = await admin
      .from("workspaces")
      .select("id")
      .eq("slug", workspaceSlug)
      .maybeSingle();
    if (!ws) throw new Error(`Workspace ${workspaceSlug} not found`);

    const inviteToken = await getInviteToken(ws.id, INVITE_EMAIL);

    // Sign in as the invited user and accept the invite
    const invitedPage = await signInAs(browser, INVITE_EMAIL, INVITE_PASSWORD);

    await invitedPage.goto(`/invite/${inviteToken}`);

    await expect(
      invitedPage.getByRole("button", { name: /accept invite/i })
    ).toBeVisible({ timeout: 10_000 });

    await invitedPage.getByRole("button", { name: /accept invite/i }).click();

    // Should redirect to the workspace
    await invitedPage.waitForURL(
      (url) => url.pathname.includes(workspaceSlug),
      { timeout: 15_000 }
    );

    await invitedPage.context().close();

    // Back on the owner's page — navigate explicitly to the members page
    await goToMembersPage(page, workspaceSlug);

    // The new member should appear in the member list
    await expect(page.locator(`text=${INVITE_DISPLAY_NAME}`)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("owner can change a member's role", async ({
    authenticatedPage: page,
  }) => {
    await goToMembersPage(page, workspaceSlug);

    // Find the row for the invited member
    const memberRow = page
      .getByRole("row")
      .filter({ hasText: INVITE_DISPLAY_NAME });
    await expect(memberRow).toBeVisible({ timeout: 5_000 });

    // The member should have a role select (since the owner can change roles)
    const roleSelect = memberRow.getByRole("combobox");
    await expect(roleSelect).toBeVisible();

    // Change role from member to admin
    await roleSelect.click();
    await page.getByRole("option", { name: "admin" }).click();

    // Wait for the page to refresh and verify the role changed
    await page.waitForTimeout(1_000);
    await goToMembersPage(page, workspaceSlug);

    // Verify the member now has admin role — the select should show "admin"
    const updatedRow = page
      .getByRole("row")
      .filter({ hasText: INVITE_DISPLAY_NAME });
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow.getByRole("combobox")).toHaveText(/admin/i);
  });

  test("member role cannot access invite or remove controls", async ({
    browser,
  }) => {
    if (!invitedUserId) {
      test.skip(true, "No invited user created in previous test");
      return;
    }

    // Change the invited user's role back to "member" via admin API
    const admin = getAdminClient();
    await admin
      .from("members")
      .update({ role: "member" })
      .eq("user_id", invitedUserId);

    // Sign in as the invited user (member role)
    const memberPage = await signInAs(browser, INVITE_EMAIL, INVITE_PASSWORD);

    await memberPage.goto(`/${workspaceSlug}/settings/members`);
    await expect(
      memberPage.getByRole("heading", { name: "Members" })
    ).toBeVisible({ timeout: 10_000 });

    // Member should NOT see the invite form
    await expect(memberPage.locator("#invite-email")).not.toBeVisible();

    // Member should NOT see remove buttons (trash icons)
    const removeButtons = memberPage.getByRole("button", {
      name: /remove/i,
    });
    await expect(removeButtons).toHaveCount(0);

    // Member should NOT see role select dropdowns in the members table
    // (roles are shown as badges, not selects, for non-admin users)
    const membersTable = memberPage.getByRole("table").first();
    const roleSelects = membersTable.getByRole("combobox");
    await expect(roleSelects).toHaveCount(0);

    await memberPage.context().close();
  });

  test("owner can remove a member", async ({ authenticatedPage: page }) => {
    if (!invitedUserId) {
      test.skip(true, "No invited user created in previous test");
      return;
    }

    await goToMembersPage(page, workspaceSlug);

    // Find the row for the invited member
    const memberRow = page
      .getByRole("row")
      .filter({ hasText: INVITE_DISPLAY_NAME });
    await expect(memberRow).toBeVisible({ timeout: 5_000 });

    // Click the remove button
    const removeButton = memberRow.getByRole("button", {
      name: new RegExp(`Remove ${INVITE_DISPLAY_NAME}`, "i"),
    });
    await removeButton.click();

    // Confirm in the alert dialog
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    await expect(dialog.locator("text=Remove member")).toBeVisible();

    await dialog.getByRole("button", { name: /^remove$/i }).click();

    // Wait for the dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    // The member row should disappear from the table
    const removedRow = page
      .getByRole("row")
      .filter({ hasText: INVITE_DISPLAY_NAME });
    await expect(removedRow).not.toBeVisible({ timeout: 5_000 });
  });
});
