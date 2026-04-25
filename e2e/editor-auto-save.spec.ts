import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage } from "./fixtures/editor-helpers";

/**
 * Wait for a successful Supabase PATCH to /rest/v1/pages (content auto-save).
 * Resolves once the response arrives with a 2xx status.
 */
function waitForContentSave(page: import("@playwright/test").Page) {
  return page.waitForResponse(
    (resp) =>
      resp.url().includes("/rest/v1/pages") &&
      resp.request().method() === "PATCH" &&
      resp.status() >= 200 &&
      resp.status() < 300,
    { timeout: 10_000 }
  );
}

test.describe("Editor auto-save", () => {
  test("content typed in the editor persists after page reload", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Use a unique string so we can verify it survives the reload
    const uniqueText = `autosave-test-${Date.now()}`;

    // Register the response listener BEFORE typing so we never miss the
    // PATCH response if the debounce fires quickly.
    const saveResponse = waitForContentSave(page);

    // Type content into the editor
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type(uniqueText);

    // Wait for the debounced auto-save PATCH to complete
    await saveResponse;

    // Reload the page
    await page.reload({ waitUntil: "domcontentloaded" });

    // Wait for the editor to re-render with persisted content
    const reloadedEditor = page.locator('[contenteditable="true"]');
    await expect(reloadedEditor).toBeVisible({ timeout: 10_000 });

    // Verify the typed content survived the reload
    await expect(reloadedEditor).toContainText(uniqueText, {
      timeout: 10_000,
    });
  });

  test("save status indicator shows Saving and Saved after editing", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // The save status container is below the editor
    const saveIndicator = page.getByTestId("editor-save-status");

    // Type content to trigger auto-save
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("indicator-test");

    // "Saving..." should appear immediately after the editor state changes
    await expect(saveIndicator).toContainText("Saving", { timeout: 5_000 });

    // After the debounced save completes, "Saved" should appear
    await expect(saveIndicator).toContainText("Saved", { timeout: 10_000 });
  });
});
