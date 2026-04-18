import path from "node:path";
import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage } from "./fixtures/editor-helpers";

const TEST_IMAGE_PATH = path.join(__dirname, "fixtures", "test-image.png");

/**
 * Wait for a successful Supabase PATCH to /rest/v1/pages (content auto-save).
 */
function waitForContentSave(page: import("@playwright/test").Page) {
  return page.waitForResponse(
    (resp) =>
      resp.url().includes("/rest/v1/pages") &&
      resp.request().method() === "PATCH" &&
      resp.status() >= 200 &&
      resp.status() < 300,
    { timeout: 15_000 }
  );
}

test.describe("Editor image upload", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await navigateToEditorPage(page);
  });

  test("insert an image via /image slash command and verify it renders", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Open slash menu and filter to Image
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/image");

    const imageOption = page
      .locator('[role="option"]')
      .filter({ hasText: "Image" });
    await expect(imageOption).toBeVisible({ timeout: 3_000 });

    // Listen for the file chooser BEFORE clicking the option, since
    // openImagePicker creates a hidden <input type="file"> and clicks it.
    const fileChooserPromise = page.waitForEvent("filechooser");
    await imageOption.click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(TEST_IMAGE_PATH);

    // The image node renders an <img> inside the editor
    const uploadedImage = editor.locator("img");
    await expect(uploadedImage).toBeVisible({ timeout: 15_000 });

    // Verify the src points to Supabase storage (page-images bucket)
    const src = await uploadedImage.getAttribute("src");
    expect(src).toBeTruthy();
    expect(src).toContain("page-images");
  });

  test("uploaded image persists after page reload", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Insert image via slash command
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/image");

    const imageOption = page
      .locator('[role="option"]')
      .filter({ hasText: "Image" });
    await expect(imageOption).toBeVisible({ timeout: 3_000 });

    const fileChooserPromise = page.waitForEvent("filechooser");
    await imageOption.click();

    const fileChooser = await fileChooserPromise;

    // Register the save listener BEFORE providing the file. The upload →
    // INSERT_IMAGE_COMMAND → onChange → debounced PATCH chain starts once
    // the file is set, and the PATCH may complete before we'd register
    // the listener otherwise.
    const saveResponse = waitForContentSave(page);

    await fileChooser.setFiles(TEST_IMAGE_PATH);

    // Wait for the image to render
    const uploadedImage = editor.locator("img");
    await expect(uploadedImage).toBeVisible({ timeout: 15_000 });

    // Capture the image src to verify after reload
    const imageSrc = await uploadedImage.getAttribute("src");
    expect(imageSrc).toBeTruthy();

    // Wait for auto-save to persist the editor state (Lexical JSON with image node)
    await saveResponse;

    // Reload the page
    await page.reload({ waitUntil: "domcontentloaded" });

    // Wait for the editor to re-render with persisted content
    const reloadedEditor = page.locator('[contenteditable="true"]');
    await expect(reloadedEditor).toBeVisible({ timeout: 10_000 });

    // The image should still be visible after reload
    const persistedImage = reloadedEditor.locator("img");
    await expect(persistedImage).toBeVisible({ timeout: 10_000 });

    // Verify it's the same image URL
    const persistedSrc = await persistedImage.getAttribute("src");
    expect(persistedSrc).toBe(imageSrc);
  });
});
