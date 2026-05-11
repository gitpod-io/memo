import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage } from "./fixtures/editor-helpers";

const TEST_IMAGE_PATH = path.join(__dirname, "fixtures", "test-image.png");

/**
 * Simulate pasting an image from the clipboard by dispatching a synthetic
 * paste event with a File in clipboardData. This mirrors what happens when
 * a user pastes a screenshot (Ctrl+V / ⌘+V) — the browser fires a paste
 * event with the image in clipboardData.files.
 */
async function pasteImageFile(
  page: import("@playwright/test").Page,
  imagePath: string,
  mimeType = "image/png",
) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString("base64");
  const fileName = path.basename(imagePath);

  await page.evaluate(
    ({ base64Data, mime, name }) => {
      const byteString = atob(base64Data);
      const bytes = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        bytes[i] = byteString.charCodeAt(i);
      }
      const file = new File([bytes], name, { type: mime });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
      });

      const editor = document.querySelector('[data-lexical-editor="true"]');
      if (!editor) throw new Error("Editor not found");
      editor.dispatchEvent(pasteEvent);
    },
    { base64Data: base64, mime: mimeType, name: fileName },
  );
}

test.describe("Editor clipboard image paste", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await navigateToEditorPage(page);
  });

  test("pasting an image from clipboard uploads and inserts it", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Focus the editor
    await editor.click();
    await page.keyboard.press("End");

    // Paste the image via synthetic clipboard event
    await pasteImageFile(page, TEST_IMAGE_PATH);

    // The image node renders an <img> inside the editor
    const uploadedImage = editor.locator("img");
    await expect(uploadedImage).toBeVisible({ timeout: 15_000 });

    // Verify the src points to Supabase storage (page-images bucket)
    const src = await uploadedImage.getAttribute("src");
    expect(src).toBeTruthy();
    expect(src).toContain("page-images");
  });

  test("pasting text does not trigger image upload", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Focus the editor and type some initial text
    await editor.click();
    await page.keyboard.type("Hello ");

    // Paste plain text via clipboard
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text);
    }, "world");

    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+v`);

    // Verify text was pasted (not an image)
    await expect(editor).toContainText("world", { timeout: 3_000 });

    // No image should be present
    const images = editor.locator("img");
    await expect(images).toHaveCount(0);
  });
});
