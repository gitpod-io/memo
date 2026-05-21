import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage } from "./fixtures/editor-helpers";

test.describe("Sidebar inline rename", () => {
  /**
   * Helper: wait for the sidebar tree to load and the current page to be
   * selected, then open the context menu and click "Rename".
   */
  async function startRenameViaContextMenu(
    page: import("@playwright/test").Page,
  ) {
    const sidebar = page.getByRole("complementary");
    const selectedItem = sidebar.locator(
      '[role="treeitem"][aria-selected="true"]',
    );
    await expect(selectedItem).toBeVisible({ timeout: 10_000 });

    await selectedItem.hover();

    const moreBtn = selectedItem.locator('[aria-label="Page actions"]');
    await expect(moreBtn).toBeVisible({ timeout: 3_000 });
    await moreBtn.click();

    const renameItem = page.getByRole("menuitem", { name: /rename/i });
    await expect(renameItem).toBeVisible({ timeout: 3_000 });
    await renameItem.click();
  }

  test("rename action appears in the context menu", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const sidebar = page.getByRole("complementary");
    const selectedItem = sidebar.locator(
      '[role="treeitem"][aria-selected="true"]',
    );
    await expect(selectedItem).toBeVisible({ timeout: 10_000 });

    await selectedItem.hover();

    const moreBtn = selectedItem.locator('[aria-label="Page actions"]');
    await expect(moreBtn).toBeVisible({ timeout: 3_000 });
    await moreBtn.click();

    const renameItem = page.getByRole("menuitem", { name: /rename/i });
    await expect(renameItem).toBeVisible({ timeout: 3_000 });
  });

  test("clicking Rename shows a focused inline input", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    await startRenameViaContextMenu(page);

    const sidebar = page.getByRole("complementary");
    const renameInput = sidebar.locator('[data-testid="rename-input"]');
    await expect(renameInput).toBeVisible({ timeout: 3_000 });
    await expect(renameInput).toBeFocused({ timeout: 3_000 });
  });

  test("pressing Enter saves the new title in the sidebar", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    await startRenameViaContextMenu(page);

    const sidebar = page.getByRole("complementary");
    const renameInput = sidebar.locator('[data-testid="rename-input"]');
    await expect(renameInput).toBeVisible({ timeout: 3_000 });

    // Clear and type a new title
    await page.keyboard.press("Control+a");
    const newTitle = `Renamed ${Date.now()}`;
    await page.keyboard.type(newTitle);
    await page.keyboard.press("Enter");

    // The rename input should disappear and the tree item should show the new title
    await expect(renameInput).not.toBeVisible({ timeout: 3_000 });

    const selectedItem = sidebar.locator(
      '[role="treeitem"][aria-selected="true"]',
    );
    await expect(selectedItem).toContainText(newTitle, { timeout: 10_000 });
  });

  test("pressing Escape cancels the rename and restores original title", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const sidebar = page.getByRole("complementary");

    // Read the current title from the sidebar before renaming
    const selectedItem = sidebar.locator(
      '[role="treeitem"][aria-selected="true"]',
    );
    await expect(selectedItem).toBeVisible({ timeout: 10_000 });
    const originalText = await selectedItem.innerText();

    await startRenameViaContextMenu(page);

    const renameInput = sidebar.locator('[data-testid="rename-input"]');
    await expect(renameInput).toBeVisible({ timeout: 3_000 });

    // Type something different then press Escape
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Should be cancelled");
    await page.keyboard.press("Escape");

    // The rename input should disappear and the original title should remain
    await expect(renameInput).not.toBeVisible({ timeout: 3_000 });
    await expect(selectedItem).toContainText(originalText.trim(), {
      timeout: 5_000,
    });
  });

  test("blurring the rename input saves the new title", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    await startRenameViaContextMenu(page);

    const sidebar = page.getByRole("complementary");
    const renameInput = sidebar.locator('[data-testid="rename-input"]');
    await expect(renameInput).toBeVisible({ timeout: 3_000 });

    // Clear and type a new title
    await page.keyboard.press("Control+a");
    const newTitle = `Blur Save ${Date.now()}`;
    await page.keyboard.type(newTitle);

    // Click elsewhere to blur
    await page.locator("main").click();

    // The rename input should disappear and the tree item should show the new title
    await expect(renameInput).not.toBeVisible({ timeout: 3_000 });

    const selectedItem = sidebar.locator(
      '[role="treeitem"][aria-selected="true"]',
    );
    await expect(selectedItem).toContainText(newTitle, { timeout: 10_000 });
  });
});
