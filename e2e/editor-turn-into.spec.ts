import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage } from "./fixtures/editor-helpers";
import type { Page, Locator } from "@playwright/test";

/**
 * Move cursor to a fresh paragraph block at the end of the editor.
 * Pressing Enter twice exits any active list context in Lexical.
 */
async function moveToParagraphBlock(page: Page, editor: Locator) {
  await editor.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
}

/**
 * Type unique text into a fresh paragraph block and return a locator for it.
 */
async function createParagraphBlock(
  page: Page,
  editor: Locator,
  text: string,
): Promise<Locator> {
  await moveToParagraphBlock(page, editor);
  await page.keyboard.type(text);
  const block = editor.locator("p").filter({ hasText: text });
  await expect(block).toBeVisible({ timeout: 3_000 });
  return block;
}

/**
 * Hover a block element to show the drag handle, then click the handle
 * to open the turn-into menu. Returns the menu locator.
 */
async function openTurnIntoMenu(
  page: Page,
  block: Locator,
): Promise<Locator> {
  await block.hover();
  const dragHandle = page.getByTestId("editor-drag-handle");
  await expect(dragHandle).toHaveCSS("opacity", "1", { timeout: 2_000 });
  await dragHandle.click();

  const menu = page.locator('[role="listbox"][aria-label="Turn into"]');
  await expect(menu).toBeVisible({ timeout: 3_000 });
  return menu;
}

test.describe("Editor turn-into menu", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await navigateToEditorPage(page);
  });

  test("opens the turn-into menu from the drag handle on a paragraph block", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    const uid = Date.now().toString();
    const marker = `TurnIntoOpen ${uid}`;
    const block = await createParagraphBlock(page, editor, marker);

    const menu = await openTurnIntoMenu(page, block);
    const options = menu.locator('[role="option"]');
    const count = await options.count();

    // Paragraph can turn into 9 types: h1, h2, h3, bullet, number, check, quote, code, callout
    expect(count).toBe(9);
  });

  test("converts a paragraph to a heading and verifies the DOM change", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    const uid = Date.now().toString();
    const marker = `TurnIntoH1 ${uid}`;
    const block = await createParagraphBlock(page, editor, marker);

    await openTurnIntoMenu(page, block);

    // Click "Heading 1" option
    const h1Option = page
      .locator('[role="option"]')
      .filter({ hasText: "Heading 1" });
    await h1Option.click();

    // The paragraph should now be an h1
    const heading = editor.locator("h1").filter({ hasText: marker });
    await expect(heading).toBeVisible({ timeout: 3_000 });

    // The original paragraph should no longer exist
    const paragraph = editor.locator("p").filter({ hasText: marker });
    await expect(paragraph).toHaveCount(0);
  });

  test("converts a heading back to a paragraph", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    const uid = Date.now().toString();
    const marker = `TurnBackPara ${uid}`;

    // First create a paragraph and convert to heading
    const block = await createParagraphBlock(page, editor, marker);
    await openTurnIntoMenu(page, block);

    const h1Option = page
      .locator('[role="option"]')
      .filter({ hasText: "Heading 1" });
    await h1Option.click();

    const heading = editor.locator("h1").filter({ hasText: marker });
    await expect(heading).toBeVisible({ timeout: 3_000 });

    // Now open the turn-into menu on the heading and convert back to paragraph
    await openTurnIntoMenu(page, heading);

    const paraOption = page
      .locator('[role="option"]')
      .filter({ hasText: "Paragraph" });
    await paraOption.click();

    // Should be a paragraph again
    const paragraph = editor.locator("p").filter({ hasText: marker });
    await expect(paragraph).toBeVisible({ timeout: 3_000 });

    // The heading should no longer exist
    const headingGone = editor.locator("h1").filter({ hasText: marker });
    await expect(headingGone).toHaveCount(0);
  });

  test("keyboard navigation works within the menu", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    const uid = Date.now().toString();
    const marker = `TurnIntoKbd ${uid}`;
    const block = await createParagraphBlock(page, editor, marker);

    const menu = await openTurnIntoMenu(page, block);
    const options = menu.locator('[role="option"]');

    // First option should be highlighted by default
    await expect(options.first()).toHaveAttribute("aria-selected", "true");

    // ArrowDown moves highlight to second option
    await page.keyboard.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(options.first()).toHaveAttribute("aria-selected", "false");

    // ArrowUp moves back to first option
    await page.keyboard.press("ArrowUp");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");

    // ArrowUp from first wraps to last
    await page.keyboard.press("ArrowUp");
    await expect(options.last()).toHaveAttribute("aria-selected", "true");

    // ArrowDown from last wraps to first
    await page.keyboard.press("ArrowDown");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");

    // Enter selects the highlighted option (first = Heading 1 for paragraph)
    await page.keyboard.press("Enter");

    // Menu should close and block should transform
    await expect(menu).not.toBeVisible({ timeout: 2_000 });
    const heading = editor.locator("h1").filter({ hasText: marker });
    await expect(heading).toBeVisible({ timeout: 3_000 });
  });

  test("menu closes after selecting an option", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    const uid = Date.now().toString();
    const marker = `TurnIntoClose ${uid}`;
    const block = await createParagraphBlock(page, editor, marker);

    const menu = await openTurnIntoMenu(page, block);

    // Click an option
    const quoteOption = page
      .locator('[role="option"]')
      .filter({ hasText: "Quote" });
    await quoteOption.click();

    // Menu should be closed
    await expect(menu).not.toBeVisible({ timeout: 2_000 });
  });

  test("menu shows only valid target types (excludes current type)", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    const uid = Date.now().toString();
    const marker = `TurnIntoExclude ${uid}`;
    const block = await createParagraphBlock(page, editor, marker);

    const menu = await openTurnIntoMenu(page, block);
    const options = menu.locator('[role="option"]');

    // Collect all option labels
    const labels: string[] = [];
    const count = await options.count();
    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).innerText();
      labels.push(text.trim());
    }

    // "Paragraph" should NOT be in the list (it's the current type)
    expect(labels).not.toContain("Paragraph");

    // These should all be present for a paragraph block
    expect(labels).toContain("Heading 1");
    expect(labels).toContain("Heading 2");
    expect(labels).toContain("Heading 3");
    expect(labels).toContain("Bullet List");
    expect(labels).toContain("Numbered List");
    expect(labels).toContain("To-do List");
    expect(labels).toContain("Quote");
    expect(labels).toContain("Code Block");
    expect(labels).toContain("Callout");

    // Now convert to h1 and verify the menu changes
    const h1Option = options.filter({ hasText: "Heading 1" });
    await h1Option.click();
    await expect(menu).not.toBeVisible({ timeout: 2_000 });

    const heading = editor.locator("h1").filter({ hasText: marker });
    await expect(heading).toBeVisible({ timeout: 3_000 });

    // Open menu on the heading
    const headingMenu = await openTurnIntoMenu(page, heading);
    const headingOptions = headingMenu.locator('[role="option"]');

    const headingLabels: string[] = [];
    const headingCount = await headingOptions.count();
    for (let i = 0; i < headingCount; i++) {
      const text = await headingOptions.nth(i).innerText();
      headingLabels.push(text.trim());
    }

    // h1 targets: paragraph, h2, h3, quote — should NOT include h1
    expect(headingLabels).not.toContain("Heading 1");
    expect(headingLabels).toContain("Paragraph");
    expect(headingLabels).toContain("Heading 2");
    expect(headingLabels).toContain("Heading 3");
    expect(headingLabels).toContain("Quote");
    expect(headingCount).toBe(4);
  });
});
