import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage, waitForEditor, modifierKey } from "./fixtures/editor-helpers";

/**
 * Move focus outside the editor by clicking a non-interactive area.
 * This ensures no contenteditable, input, or textarea is focused,
 * which would suppress page-level keyboard shortcuts.
 */
async function focusOutsideEditor(page: import("@playwright/test").Page) {
  // Click the page header area (group/page-header div) which is non-interactive
  await page.locator("body").click({ position: { x: 400, y: 10 }, force: true });
  // Verify no input/editor is focused
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
}

test.describe("Page keyboard shortcuts", () => {
  test("⌘D / Ctrl+D duplicates the current page", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);
    await waitForEditor(page);

    const originalUrl = page.url();

    await focusOutsideEditor(page);

    // Press Ctrl+D / ⌘D
    const mod = modifierKey();
    await page.keyboard.press(`${mod}+d`);

    // Wait for navigation to the duplicated page
    await page.waitForURL((url) => url.href !== originalUrl, {
      timeout: 15_000,
    });

    // The duplicated page title should contain "(copy)"
    const titleInput = page.locator('input[aria-label="Page title"]');
    await expect(titleInput).toBeVisible({ timeout: 10_000 });
    const duplicatedTitle = await titleInput.inputValue();
    expect(duplicatedTitle).toContain("(copy)");
  });

  test("⌘⇧E / Ctrl+Shift+E triggers export", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = await waitForEditor(page);
    await editor.click();
    await page.keyboard.type("Export shortcut test content");

    // Wait for auto-save
    await expect(page.getByTestId("editor-save-status")).toContainText(
      "Saved",
      { timeout: 10_000 },
    );

    await focusOutsideEditor(page);

    // Set up download listener before dispatching the shortcut
    const downloadPromise = page.waitForEvent("download", { timeout: 10_000 });

    // Dispatch the keyboard event directly on the window to avoid
    // browser-level interception of Ctrl+Shift+E
    const mod = modifierKey();
    await page.evaluate((isMeta) => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "E",
          code: "KeyE",
          shiftKey: true,
          metaKey: isMeta,
          ctrlKey: !isMeta,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, mod === "Meta");

    // Verify a download was triggered
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.md$/);
  });

  test("shortcuts do not fire when editor is focused", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = await waitForEditor(page);
    await editor.click();

    const originalUrl = page.url();

    // Press Ctrl+D / ⌘D while the editor is focused — should NOT duplicate
    const mod = modifierKey();
    await page.keyboard.press(`${mod}+d`);

    // Wait a moment to confirm no navigation happened
    await page.waitForTimeout(1_000);
    expect(page.url()).toBe(originalUrl);
  });

  test("shortcut hints are visible in the page menu", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);
    await waitForEditor(page);

    // Open the page menu
    const pageMenuBtn = page
      .locator("main")
      .locator('[aria-label="Page actions"]')
      .first();
    await expect(pageMenuBtn).toBeVisible({ timeout: 5_000 });
    await pageMenuBtn.click();

    // Verify shortcut hints are displayed next to Duplicate and Export
    const duplicateItem = page.getByRole("menuitem", { name: /duplicate/i });
    await expect(duplicateItem).toBeVisible({ timeout: 3_000 });
    // The shortcut hint text should be present (⌘D or Ctrl+D)
    await expect(duplicateItem).toHaveText(/⌘D|Ctrl\+D/);

    const exportItem = page.getByRole("menuitem", { name: /export/i });
    await expect(exportItem).toBeVisible({ timeout: 3_000 });
    await expect(exportItem).toHaveText(/⌘⇧E|Ctrl\+Shift\+E/);
  });
});
