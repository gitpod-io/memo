import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage } from "./fixtures/editor-helpers";

test.describe("Editor drag-and-drop", () => {
  test("drag handle appears when hovering a block", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Type unique content to avoid matching leftover text from previous runs
    const uid = Date.now().toString();
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially(`DragTest ${uid}`);

    // Wait for content to render
    await page.waitForTimeout(500);

    // Find the block we just typed and hover it
    const block = editor.locator("p").filter({ hasText: `DragTest ${uid}` });
    await expect(block).toBeVisible();
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

    // Ensure there's content
    await editor.click();
    await editor.pressSequentially("Drag test block");
    await page.waitForTimeout(300);

    const block = editor.locator("p").first();
    await expect(block).toBeVisible();

    // Hover the block to show the drag handle
    const blockBox = await block.boundingBox();
    if (!blockBox) {
      test.skip(true, "Could not get block bounding box");
      return;
    }

    await page.mouse.move(blockBox.x + blockBox.width / 2, blockBox.y + blockBox.height / 2);
    await page.waitForTimeout(100);

    const dragHandle = page.locator(".memo-draggable-block-menu");
    await expect(dragHandle).toHaveCSS("opacity", "1", { timeout: 2_000 });

    // Move cursor left toward the drag handle
    const handleBox = await dragHandle.boundingBox();
    if (!handleBox) {
      test.skip(true, "Could not get drag handle bounding box");
      return;
    }

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.waitForTimeout(100);

    // Handle should still be visible
    await expect(dragHandle).toHaveCSS("opacity", "1");
  });

  test("drag handle is draggable and positioned near the hovered block", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Type content to create multiple blocks
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("Block one");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("Block two");
    await page.waitForTimeout(300);

    // Hover the first typed block
    const paragraphs = editor.locator("p");
    const blockOne = paragraphs.filter({ hasText: "Block one" }).first();
    await expect(blockOne).toBeVisible();
    await blockOne.hover();
    await page.waitForTimeout(200);

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
});
