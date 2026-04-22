import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage } from "./fixtures/editor-helpers";

const DESKTOP_VIEWPORT = { width: 1280, height: 720 };

/**
 * The focus mode shortcut is ⌘+Shift+F (Mac) / Ctrl+Shift+F (other).
 * Playwright runs on Linux in CI, so we use Control.
 */
const FOCUS_SHORTCUT = "Control+Shift+KeyF";

test.describe("Editor focus mode", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
  });

  test("keyboard shortcut activates focus mode and hides the sidebar", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    // Sidebar should be visible initially
    const aside = page.locator("aside");
    await expect(aside).toBeVisible({ timeout: 5_000 });

    // Activate focus mode via keyboard shortcut
    await page.keyboard.press(FOCUS_SHORTCUT);

    // Sidebar should disappear (AppSidebar returns null in focus mode)
    await expect(aside).toHaveCount(0, { timeout: 3_000 });

    // The "Exit focus mode" hint button should appear
    const exitButton = page.getByRole("button", { name: "Exit focus mode" });
    await expect(exitButton).toBeVisible({ timeout: 3_000 });
  });

  test("editor content area expands when focus mode is active", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const aside = page.locator("aside");
    await expect(aside).toBeVisible({ timeout: 5_000 });

    // Measure the main content area width before focus mode
    const mainContent = page.locator("main");
    const beforeBox = await mainContent.boundingBox();
    expect(beforeBox).not.toBeNull();

    // Activate focus mode
    await page.keyboard.press(FOCUS_SHORTCUT);
    await expect(aside).toHaveCount(0, { timeout: 3_000 });

    // The main content area should be wider now (sidebar was 240px)
    await expect(async () => {
      const afterBox = await mainContent.boundingBox();
      expect(afterBox).not.toBeNull();
      expect(afterBox!.width).toBeGreaterThan(beforeBox!.width);
    }).toPass({ timeout: 3_000 });
  });

  test("Escape exits focus mode and restores the sidebar", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const aside = page.locator("aside");
    await expect(aside).toBeVisible({ timeout: 5_000 });

    // Enter focus mode
    await page.keyboard.press(FOCUS_SHORTCUT);
    await expect(aside).toHaveCount(0, { timeout: 3_000 });

    // Press Escape to exit focus mode
    await page.keyboard.press("Escape");

    // Sidebar should reappear
    await expect(aside).toBeVisible({ timeout: 3_000 });

    // Exit button should disappear
    const exitButton = page.getByRole("button", { name: "Exit focus mode" });
    await expect(exitButton).toHaveCount(0, { timeout: 3_000 });
  });

  test("exit focus mode button in the hint dismisses focus mode", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const aside = page.locator("aside");
    await expect(aside).toBeVisible({ timeout: 5_000 });

    // Enter focus mode
    await page.keyboard.press(FOCUS_SHORTCUT);
    await expect(aside).toHaveCount(0, { timeout: 3_000 });

    // Click the "Exit focus mode" button
    const exitButton = page.getByRole("button", { name: "Exit focus mode" });
    await expect(exitButton).toBeVisible({ timeout: 3_000 });
    await exitButton.click();

    // Sidebar should reappear
    await expect(aside).toBeVisible({ timeout: 3_000 });
  });

  test("focus mode persists across editor interactions", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const aside = page.locator("aside");
    await expect(aside).toBeVisible({ timeout: 5_000 });

    // Enter focus mode
    await page.keyboard.press(FOCUS_SHORTCUT);
    await expect(aside).toHaveCount(0, { timeout: 3_000 });

    // Interact with the editor: click, type, select text
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("focus mode test content");

    // Select the text we just typed
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");

    // Focus mode should still be active — sidebar should still be hidden
    await expect(aside).toHaveCount(0);

    // The exit button should still be present
    const exitButton = page.getByRole("button", { name: "Exit focus mode" });
    // The hint fades after 2s but is still in the DOM (opacity: 0)
    await expect(exitButton).toBeAttached({ timeout: 3_000 });
  });
});
