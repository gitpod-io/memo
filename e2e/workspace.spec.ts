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

    // At minimum, the personal workspace should be listed
    const workspaceItems = page.locator('[role="menuitem"], [role="option"]');
    await expect(workspaceItems.first()).toBeVisible({ timeout: 5_000 });
    if ((await workspaceItems.count()) > 0) {
      await expect(workspaceItems.first()).toBeVisible();
    }
  });

  test("create workspace menu item opens the dialog", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.locator("aside, nav, [data-sidebar]").first();
    await expect(sidebar).toBeVisible({ timeout: 5_000 });

    // Open the workspace switcher dropdown
    const workspaceTrigger = sidebar.locator(
      'button[aria-label="Switch workspace"]'
    );
    await workspaceTrigger.click();

    // Click "Create workspace" menu item
    const createItem = page.getByRole("menuitem", {
      name: /create workspace/i,
    });
    await expect(createItem).toBeVisible({ timeout: 3_000 });
    await createItem.click();

    // The create workspace dialog should appear
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    await expect(
      dialog.getByRole("heading", { name: /create workspace/i })
    ).toBeVisible();
  });
});
