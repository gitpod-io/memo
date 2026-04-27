import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage, waitForEditor } from "./fixtures/editor-helpers";

test.describe("Page Duplication", () => {
  /**
   * Helper: duplicate the currently selected page via the sidebar context menu.
   * Waits for navigation to the duplicated page.
   */
  async function duplicateViaSidebarContextMenu(
    page: import("@playwright/test").Page,
  ) {
    const sidebar = page.getByRole("complementary");
    const selectedItem = sidebar.locator(
      '[role="treeitem"][aria-selected="true"]',
    );
    await expect(selectedItem).toBeVisible({ timeout: 10_000 });

    const urlBefore = page.url();

    await selectedItem.hover();

    const moreBtn = selectedItem.locator('[aria-label="Page actions"]');
    await expect(moreBtn).toBeVisible({ timeout: 3_000 });
    await moreBtn.click();

    const duplicateItem = page.getByRole("menuitem", { name: /duplicate/i });
    await expect(duplicateItem).toBeVisible({ timeout: 3_000 });
    await duplicateItem.click();

    // Wait for navigation to the duplicated page (URL changes)
    await page.waitForURL((url) => url.href !== urlBefore, {
      timeout: 15_000,
    });

    // Wait for the Lexical editor to fully initialize behind the lazy-load
    // boundary — contenteditable alone is not sufficient after next/dynamic
    await waitForEditor(page);
  }

  test("user can duplicate a page from the sidebar context menu", async ({
    authenticatedPage: page,
  }) => {
    // Create a fresh page so it's selected in the sidebar
    await navigateToEditorPage(page);

    const originalPageId = new URL(page.url()).pathname
      .split("/")
      .filter(Boolean)
      .pop()!;

    await duplicateViaSidebarContextMenu(page);

    // URL should point to a different page
    const newPageId = new URL(page.url()).pathname
      .split("/")
      .filter(Boolean)
      .pop();
    expect(newPageId).not.toBe(originalPageId);

    // The duplicated page title should contain "(copy)"
    const titleInput = page.locator('input[aria-label="Page title"]');
    await expect(titleInput).toBeVisible({ timeout: 10_000 });
    const duplicatedTitle = await titleInput.inputValue();
    expect(duplicatedTitle).toContain("(copy)");
  });

  test("duplicated page appears in the sidebar with copy title", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    await duplicateViaSidebarContextMenu(page);

    // After duplication + navigation, the duplicated page is the new
    // selected item in the sidebar (optimistically added via setPages).
    const sidebar = page.getByRole("complementary");
    const selectedItem = sidebar.locator(
      '[role="treeitem"][aria-selected="true"]',
    );
    await expect(selectedItem).toBeVisible({ timeout: 10_000 });
    await expect(selectedItem).toContainText("(copy)", { timeout: 5_000 });
  });

  test("duplicated page contains the same content as the original", async ({
    authenticatedPage: page,
  }) => {
    // Use the page menu for content duplication — it fetches the latest
    // content from the database, unlike the sidebar which uses stale
    // in-memory state.
    await navigateToEditorPage(page);

    const editor = await waitForEditor(page);
    await editor.click();
    const content = "Unique content for duplication test";
    await page.keyboard.type(content);

    // Wait for auto-save to persist content to the database — the editor
    // shows "Saved" after a successful PATCH. networkidle alone is not
    // reliable because the save is debounced (500ms) and the lazy-load
    // boundary adds latency to the initial render.
    await expect(page.getByTestId("editor-save-status")).toContainText(
      "Saved",
      { timeout: 10_000 },
    );

    const originalUrl = page.url();

    // Duplicate via the page menu (three-dot menu in main content area)
    const pageMenuBtn = page
      .locator("main")
      .locator('[aria-label="Page actions"]')
      .first();
    await expect(pageMenuBtn).toBeVisible({ timeout: 5_000 });
    await pageMenuBtn.click();

    const duplicateItem = page.getByRole("menuitem", { name: /duplicate/i });
    await expect(duplicateItem).toBeVisible({ timeout: 3_000 });
    await duplicateItem.click();

    // Wait for navigation to the duplicated page
    await page.waitForURL((url) => url.href !== originalUrl, {
      timeout: 15_000,
    });

    // Wait for the Lexical editor to fully initialize behind the lazy-load
    // boundary on the new page
    const newEditor = await waitForEditor(page);
    await expect(newEditor).toContainText(content, { timeout: 10_000 });
  });

  test("user can duplicate a page from the page menu", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const originalUrl = page.url();
    const originalPageId = new URL(originalUrl).pathname
      .split("/")
      .filter(Boolean)
      .pop()!;

    // Duplicate via the page menu (three-dot menu in main content area)
    const pageMenuBtn = page
      .locator("main")
      .locator('[aria-label="Page actions"]')
      .first();
    await expect(pageMenuBtn).toBeVisible({ timeout: 5_000 });
    await pageMenuBtn.click();

    const duplicateItem = page.getByRole("menuitem", { name: /duplicate/i });
    await expect(duplicateItem).toBeVisible({ timeout: 3_000 });
    await duplicateItem.click();

    // Wait for navigation to the duplicated page
    await page.waitForURL((url) => url.href !== originalUrl, {
      timeout: 15_000,
    });

    // URL should point to a different page
    const newPageId = new URL(page.url()).pathname
      .split("/")
      .filter(Boolean)
      .pop();
    expect(newPageId).not.toBe(originalPageId);

    // The duplicated page title should contain "(copy)"
    const titleInput = page.locator('input[aria-label="Page title"]');
    await expect(titleInput).toBeVisible({ timeout: 10_000 });
    const duplicatedTitle = await titleInput.inputValue();
    expect(duplicatedTitle).toContain("(copy)");
  });
});
