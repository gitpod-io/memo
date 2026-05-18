import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage } from "./fixtures/editor-helpers";

test.describe("Title → Editor focus transfer", () => {
  test("pressing Enter in the title focuses the editor", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const titleInput = page.locator('input[aria-label="Page title"]');
    await expect(titleInput).toBeVisible({ timeout: 10_000 });

    // Focus the title and type something
    await titleInput.click();
    await expect(titleInput).toBeFocused();
    await page.keyboard.type("Enter Test Title");

    // Press Enter — should transfer focus to the editor
    await page.keyboard.press("Enter");

    const editor = page.locator('[data-lexical-editor="true"]');
    await expect(editor).toBeFocused({ timeout: 5_000 });
  });

  test("pressing Tab in the title focuses the editor", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const titleInput = page.locator('input[aria-label="Page title"]');
    await expect(titleInput).toBeVisible({ timeout: 10_000 });

    // Focus the title and type something
    await titleInput.click();
    await expect(titleInput).toBeFocused();
    await page.keyboard.type("Tab Test Title");

    // Press Tab — should transfer focus to the editor
    await page.keyboard.press("Tab");

    const editor = page.locator('[data-lexical-editor="true"]');
    await expect(editor).toBeFocused({ timeout: 5_000 });
  });

  test("title is saved before focus transfers on Enter", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const titleInput = page.locator('input[aria-label="Page title"]');
    await expect(titleInput).toBeVisible({ timeout: 10_000 });

    const testTitle = `Save Test ${Date.now()}`;
    await titleInput.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type(testTitle);

    // Press Enter to save and advance
    await page.keyboard.press("Enter");

    // Editor should be focused
    const editor = page.locator('[data-lexical-editor="true"]');
    await expect(editor).toBeFocused({ timeout: 5_000 });

    // Reload and verify the title was persisted
    await page.reload({ waitUntil: "domcontentloaded" });
    const reloadedTitle = page.locator('input[aria-label="Page title"]');
    await expect(reloadedTitle).toBeVisible({ timeout: 10_000 });
    await expect(reloadedTitle).toHaveValue(testTitle, { timeout: 5_000 });
  });
});
