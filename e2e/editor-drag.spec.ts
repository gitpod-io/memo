import { test, expect } from "./fixtures/auth";

test.describe("Editor drag-and-drop", () => {
  test("drag handle appears when hovering a block", async ({
    authenticatedPage: page,
  }) => {
    // Navigate to workspace, create or open a page
    const pageButton = page.locator("button").filter({ hasText: /ago/ });
    const hasPages = (await pageButton.count()) > 0;

    if (!hasPages) {
      // Create a new page via sidebar
      const newPageBtn = page.getByRole("button", { name: /new page/i });
      if ((await newPageBtn.count()) > 0) {
        await newPageBtn.click();
        await page.waitForURL((url) => url.pathname.split("/").filter(Boolean).length >= 2);
      } else {
        test.skip(true, "No pages and no create button found");
        return;
      }
    } else {
      await pageButton.first().click();
      await page.waitForURL((url) => url.pathname.split("/").filter(Boolean).length >= 2);
    }

    // Wait for the editor to load
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Type some content to create blocks
    await editor.click();
    await editor.pressSequentially("First block");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("Second block");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("Third block");

    // Wait for content to render
    await page.waitForTimeout(500);

    // Find the first block element and hover near it
    const firstBlock = editor.locator("p").filter({ hasText: "First block" });
    await expect(firstBlock).toBeVisible();

    // Hover over the first block
    await firstBlock.hover();

    // The drag handle should become visible
    const dragHandle = page.locator(".memo-draggable-block-menu");
    await expect(dragHandle).toHaveCSS("opacity", "1", { timeout: 2_000 });
  });

  test("drag handle stays visible when moving cursor toward it", async ({
    authenticatedPage: page,
  }) => {
    const pageButton = page.locator("button").filter({ hasText: /ago/ });
    if ((await pageButton.count()) > 0) {
      await pageButton.first().click();
      await page.waitForURL((url) => url.pathname.split("/").filter(Boolean).length >= 2);
    } else {
      test.skip(true, "No pages available");
      return;
    }

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

  test("blocks can be reordered via drag-and-drop", async ({
    authenticatedPage: page,
  }) => {
    const pageButton = page.locator("button").filter({ hasText: /ago/ });
    if ((await pageButton.count()) > 0) {
      await pageButton.first().click();
      await page.waitForURL((url) => url.pathname.split("/").filter(Boolean).length >= 2);
    } else {
      test.skip(true, "No pages available");
      return;
    }

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Clear and type fresh content
    await editor.click();
    await page.keyboard.press("Meta+a");
    await page.keyboard.press("Backspace");
    await editor.pressSequentially("AAA");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("BBB");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("CCC");
    await page.waitForTimeout(300);

    // Verify initial order
    const paragraphs = editor.locator("p");
    await expect(paragraphs.nth(0)).toContainText("AAA");
    await expect(paragraphs.nth(1)).toContainText("BBB");
    await expect(paragraphs.nth(2)).toContainText("CCC");

    // Hover the first block to show drag handle
    const firstBlock = paragraphs.nth(0);
    await firstBlock.hover();
    await page.waitForTimeout(200);

    const dragHandle = page.locator(".memo-draggable-block-menu");
    await expect(dragHandle).toHaveCSS("opacity", "1", { timeout: 2_000 });

    // Drag the first block below the third block
    const handleBox = await dragHandle.boundingBox();
    const thirdBlock = paragraphs.nth(2);
    const thirdBox = await thirdBlock.boundingBox();

    if (!handleBox || !thirdBox) {
      test.skip(true, "Could not get element bounding boxes");
      return;
    }

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    // Move to below the third block
    await page.mouse.move(thirdBox.x + thirdBox.width / 2, thirdBox.y + thirdBox.height + 5, {
      steps: 10,
    });
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Verify new order: BBB, CCC, AAA
    const updatedParagraphs = editor.locator("p");
    await expect(updatedParagraphs.nth(0)).toContainText("BBB");
    await expect(updatedParagraphs.nth(1)).toContainText("CCC");
    await expect(updatedParagraphs.nth(2)).toContainText("AAA");
  });
});
