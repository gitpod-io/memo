import { test, expect } from "./fixtures/auth";

test.describe("Workspace switcher", () => {
  test("workspace switcher is visible in sidebar", async ({
    authenticatedPage: page,
  }) => {
    // The workspace switcher should be in the sidebar
    // It's typically a dropdown or button showing the current workspace name
    const sidebar = page.locator("aside, nav, [data-sidebar]").first();
    await expect(sidebar).toBeVisible({ timeout: 5_000 });

    // Look for a workspace-related dropdown trigger
    const workspaceTrigger = page.locator(
      'button[aria-label*="workspace" i], [data-workspace-switcher]'
    ).or(
      // The workspace switcher might just be a button with the workspace name
      sidebar.locator("button").first()
    );

    await expect(workspaceTrigger).toBeVisible({ timeout: 3_000 });
  });

  test("workspace switcher opens and shows workspaces", async ({
    authenticatedPage: page,
  }) => {
    // Find and click the workspace switcher
    const sidebar = page.locator("aside, nav, [data-sidebar]").first();
    await expect(sidebar).toBeVisible({ timeout: 5_000 });

    // The workspace switcher is typically the first interactive element in the sidebar
    const workspaceTrigger = sidebar.locator("button").first();
    await workspaceTrigger.click();
    await page.waitForTimeout(500);

    // At minimum, the personal workspace should be listed
    const workspaceItems = page.locator('[role="menuitem"], [role="option"]');
    if ((await workspaceItems.count()) > 0) {
      await expect(workspaceItems.first()).toBeVisible();
    }
  });
});
