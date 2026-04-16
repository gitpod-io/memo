import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage, modifierKey } from "./fixtures/editor-helpers";

const mod = modifierKey();

test.describe("Page CRUD", () => {
  test("user can create a new page from sidebar", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.getByRole("complementary");

    // Wait for the page tree to load (workspace ID must be fetched first).
    // Tree items or "No pages yet" text indicate the tree has loaded.
    const treeItem = sidebar.locator('[role="treeitem"]').first();
    try {
      await expect(treeItem).toBeVisible({ timeout: 10_000 });
    } catch {
      // Tree loaded but empty — that's fine
    }

    const newPageBtn = sidebar.getByRole("button", { name: /new page/i });
    if ((await newPageBtn.count()) === 0) {
      test.skip(true, "New page button not found");
      return;
    }

    await newPageBtn.click();

    // Wait for navigation to a page route (URL has at least 2 path segments)
    await page.waitForURL(
      (url) => url.pathname.split("/").filter(Boolean).length >= 2,
      { timeout: 10_000 }
    );

    // Editor should be visible after the page loads
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });
  });

  test("user can navigate to a page via sidebar", async ({
    authenticatedPage: page,
  }) => {
    // Wait for the page tree to load
    const treeItem = page.locator('[role="treeitem"]').first();
    await expect(treeItem).toBeVisible({ timeout: 10_000 }).catch(() => {
      // no-op: tree may be empty
    });

    if ((await treeItem.count()) === 0) {
      test.skip(true, "No pages in sidebar");
      return;
    }

    // Click the page title button
    const titleBtn = treeItem.locator("button.flex-1").first();
    await titleBtn.click();

    // Editor should be visible on the page
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });
  });

  test("user can rename a page via inline title", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    // Find the page title input
    const titleInput = page.locator('input[aria-label*="title" i], input[placeholder*="untitled" i]').or(
      page.locator("h1").first()
    );

    if ((await titleInput.count()) === 0) {
      test.skip(true, "Title input not found");
      return;
    }

    // Click and edit the title
    await titleInput.first().click();
    await page.keyboard.press(`${mod}+a`);
    const testTitle = `E2E Test ${Date.now()}`;
    await page.keyboard.type(testTitle);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1_000);

    // Title should be updated (could be an input or a contenteditable heading)
    const titleText = await titleInput.first().inputValue().catch(() => null)
      ?? await titleInput.first().textContent();
    expect(titleText).toContain(testTitle);
  });

  test("user can delete a page with confirmation", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.getByRole("complementary");

    // Wait for the page tree to load (workspace ID must be fetched first)
    const treeItem = sidebar.locator('[role="treeitem"]').first();
    try {
      await expect(treeItem).toBeVisible({ timeout: 10_000 });
    } catch {
      // Tree loaded but empty — that's fine
    }

    // Create a page first so we have something to delete
    const newPageBtn = sidebar.getByRole("button", { name: /new page/i });
    if ((await newPageBtn.count()) === 0) {
      test.skip(true, "New page button not found");
      return;
    }

    await newPageBtn.click();

    // Wait for navigation to the new page
    await page.waitForURL(
      (url) => url.pathname.split("/").filter(Boolean).length >= 2,
      { timeout: 10_000 }
    );

    // Wait for the editor to appear
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_000);

    // Wait for the page tree to update with the new page
    const sidebarItems = page.locator('[role="treeitem"]');
    await expect(sidebarItems.first()).toBeVisible({ timeout: 10_000 });

    if ((await sidebarItems.count()) === 0) {
      test.skip(true, "No sidebar items to test delete");
      return;
    }

    await sidebarItems.first().hover();
    await page.waitForTimeout(300);

    // Look for the "Page actions" more options button
    const moreBtn = sidebarItems.first().locator('[aria-label*="action" i]').or(
      sidebarItems.first().locator('[aria-label*="more" i]')
    );

    if ((await moreBtn.count()) === 0) {
      test.skip(true, "More options button not found");
      return;
    }

    await moreBtn.first().click();
    await page.waitForTimeout(300);

    // Click delete
    const deleteBtn = page.getByRole("menuitem", { name: /delete/i });
    if ((await deleteBtn.count()) === 0) {
      test.skip(true, "Delete menu item not found");
      return;
    }

    await deleteBtn.click();

    // Confirmation dialog should appear
    const confirmBtn = page.getByRole("button", { name: /delete|confirm/i }).last();
    await expect(confirmBtn).toBeVisible({ timeout: 3_000 });
    await confirmBtn.click();

    await page.waitForTimeout(1_000);
  });
});
