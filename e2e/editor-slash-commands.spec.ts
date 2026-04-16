import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage } from "./fixtures/editor-helpers";

test.describe("Editor slash commands", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await navigateToEditorPage(page);
  });

  test("slash menu appears when typing /", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");

    // The slash command menu should appear
    const menu = page.locator('[role="option"]').first();
    await expect(menu).toBeVisible({ timeout: 3_000 });
  });

  test("slash menu filters options on typing", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/head");

    // Should show heading options, filtered
    const options = page.locator('[role="option"]');
    await expect(options.first()).toBeVisible({ timeout: 3_000 });

    const count = await options.count();
    // "head" should match Heading 1, Heading 2, Heading 3
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(3);
  });

  test("selecting a heading option inserts a heading block", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");

    // Wait for menu
    const heading1Option = page.locator('[role="option"]').filter({ hasText: "Heading 1" });
    await expect(heading1Option).toBeVisible({ timeout: 3_000 });
    await heading1Option.click();

    // A heading element should now exist in the editor
    const heading = editor.locator("h1");
    await expect(heading).toBeVisible({ timeout: 2_000 });
  });

  test("slash menu is keyboard navigable", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");

    const options = page.locator('[role="option"]');
    await expect(options.first()).toBeVisible({ timeout: 3_000 });

    // First option should be selected by default
    await expect(options.first()).toHaveClass(/bg-white/);

    // Arrow down should move selection
    await page.keyboard.press("ArrowDown");
    await expect(options.nth(1)).toHaveClass(/bg-white/);

    // Escape should close the menu
    await page.keyboard.press("Escape");
    await expect(options.first()).not.toBeVisible({ timeout: 2_000 });
  });
});
