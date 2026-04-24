import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage } from "./fixtures/editor-helpers";

/**
 * Move the cursor to the end of the editor and exit any active list context
 * by pressing Enter twice (an empty list item exits the list in Lexical),
 * leaving the cursor in a fresh paragraph block.
 */
async function moveToParagraphBlock(
  page: import("@playwright/test").Page,
  editor: import("@playwright/test").Locator,
) {
  await editor.click();
  await page.keyboard.press("End");
  // Press Enter twice: first creates a new list item (if inside a list),
  // second exits the list and creates a paragraph.
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
}

test.describe("Editor drag-and-drop", () => {
  test("drag handle appears when hovering a block", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Use unique text to avoid matching leftover content from previous runs
    const uid = Date.now().toString();
    const marker = `DragTest ${uid}`;
    await moveToParagraphBlock(page, editor);
    await page.keyboard.type(marker);

    // Wait for the paragraph with our unique text to render
    const block = editor.locator("p").filter({ hasText: marker });
    await expect(block).toBeVisible({ timeout: 3_000 });
    await block.hover();

    // The drag handle should become visible
    const dragHandle = page.locator(".memo-draggable-block-menu");
    await expect(dragHandle).toHaveCSS("opacity", "1", { timeout: 2_000 });
  });

  test("drag handle stays visible when moving cursor toward it", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Use unique text so the locator doesn't match leftover content
    const uid = Date.now().toString();
    const marker = `DragStay ${uid}`;
    await moveToParagraphBlock(page, editor);
    await page.keyboard.type(marker);

    const block = editor.locator("p").filter({ hasText: marker });
    await expect(block).toBeVisible({ timeout: 3_000 });

    // Hover the block to show the drag handle
    const blockBox = await block.boundingBox();
    if (!blockBox) {
      test.skip(true, "Could not get block bounding box");
      return;
    }

    await page.mouse.move(blockBox.x + blockBox.width / 2, blockBox.y + blockBox.height / 2);

    const dragHandle = page.locator(".memo-draggable-block-menu");
    await expect(dragHandle).toHaveCSS("opacity", "1", { timeout: 2_000 });

    // Move cursor left toward the drag handle
    const handleBox = await dragHandle.boundingBox();
    if (!handleBox) {
      test.skip(true, "Could not get drag handle bounding box");
      return;
    }

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);

    // Handle should still be visible
    await expect(dragHandle).toHaveCSS("opacity", "1");
  });

  test("drag handle is draggable and positioned near the hovered block", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Use unique text to avoid matching leftover content from previous runs
    const uid = Date.now().toString();
    const markerOne = `BlockOne ${uid}`;
    const markerTwo = `BlockTwo ${uid}`;
    await moveToParagraphBlock(page, editor);
    await page.keyboard.type(markerOne);
    await page.keyboard.press("Enter");
    await page.keyboard.type(markerTwo);

    // Hover the first typed block using unique text
    const blockOne = editor.locator("p").filter({ hasText: markerOne });
    await expect(blockOne).toBeVisible({ timeout: 3_000 });
    await blockOne.hover();

    const dragHandle = page.locator(".memo-draggable-block-menu");
    await expect(dragHandle).toHaveCSS("opacity", "1", { timeout: 2_000 });

    // Verify the drag handle has the draggable attribute
    await expect(dragHandle).toHaveAttribute("draggable", "true");

    // Verify the drag handle is positioned near the hovered block
    const handleBox = await dragHandle.boundingBox();
    const blockBox = await blockOne.boundingBox();
    if (handleBox && blockBox) {
      // Handle should be vertically aligned with the block (within 20px)
      expect(Math.abs(handleBox.y - blockBox.y)).toBeLessThan(20);
    }
  });

  test("drag handle bottom aligns with first line bottom for paragraph blocks", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    const uid = Date.now().toString();
    const marker = `AlignTest ${uid}`;
    await moveToParagraphBlock(page, editor);
    await page.keyboard.type(marker);

    const block = editor.locator("p").filter({ hasText: marker });
    await expect(block).toBeVisible({ timeout: 3_000 });
    await block.hover();

    const dragHandle = page.locator(".memo-draggable-block-menu");
    await expect(dragHandle).toHaveCSS("opacity", "1", { timeout: 2_000 });

    const handleBox = await dragHandle.boundingBox();
    const blockBox = await block.boundingBox();
    if (!handleBox || !blockBox) {
      test.skip(true, "Could not get bounding boxes");
      return;
    }

    // For a single-line paragraph (text-sm, line-height 20px), the handle
    // (h-5 = 20px) should start at the block top so its bottom aligns with
    // the first line bottom. Allow 4px tolerance for sub-pixel rendering.
    const handleBottom = handleBox.y + handleBox.height;
    const blockFirstLineBottom = blockBox.y + 20; // text-sm line-height
    expect(Math.abs(handleBottom - blockFirstLineBottom)).toBeLessThan(4);
  });
});
