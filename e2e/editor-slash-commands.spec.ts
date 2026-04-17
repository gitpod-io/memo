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

    // Count existing h1 elements before inserting so we can target the new one
    const h1CountBefore = await editor.locator("h1").count();

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");

    // Wait for menu
    const heading1Option = page.locator('[role="option"]').filter({ hasText: "Heading 1" });
    await expect(heading1Option).toBeVisible({ timeout: 3_000 });
    await heading1Option.click();

    // The newly inserted heading — use .last() to avoid matching pre-existing h1s
    const heading = editor.locator("h1").last();
    await expect(heading).toBeVisible({ timeout: 2_000 });

    // Verify a new h1 was actually added
    const h1CountAfter = await editor.locator("h1").count();
    expect(h1CountAfter).toBeGreaterThan(h1CountBefore);
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

  test("arrow keys navigate sequentially without jumping back to top", async ({
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

    const totalOptions = await options.count();

    // Navigate down through multiple items sequentially. The bug caused the
    // selection to jump back to index 0 after a few presses.
    const stepsToNavigate = Math.min(totalOptions - 1, 6);
    for (let i = 0; i < stepsToNavigate; i++) {
      await page.keyboard.press("ArrowDown");
      // The (i+1)th option should be highlighted, not the first
      await expect(options.nth(i + 1)).toHaveClass(/bg-white/);
    }

    // Navigate back up and verify it doesn't jump
    await page.keyboard.press("ArrowUp");
    await expect(options.nth(stepsToNavigate - 1)).toHaveClass(/bg-white/);
  });

  test("selected item scrolls into view when navigating with arrow keys", async ({
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

    const totalOptions = await options.count();

    // Navigate to the last item — this requires scrolling in the menu
    // since the menu has max-h-[300px] and 13 items won't all fit.
    for (let i = 0; i < totalOptions - 1; i++) {
      await page.keyboard.press("ArrowDown");
    }

    // The last option should be selected and visible (scrolled into view)
    const lastOption = options.nth(totalOptions - 1);
    await expect(lastOption).toHaveClass(/bg-white/);
    await expect(lastOption).toBeInViewport();
  });
});
