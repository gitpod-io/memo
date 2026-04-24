import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage } from "./fixtures/editor-helpers";

test.describe("Editor markdown shortcuts", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await navigateToEditorPage(page);
  });

  test("typing '# ' converts to H1", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");

    // Count existing h1 elements before the shortcut
    const h1CountBefore = await editor.locator("h1").count();

    // Type the markdown shortcut: "# " triggers heading conversion
    await page.keyboard.type("# ");

    // Lexical should convert the paragraph to an h1
    const h1CountAfter = await editor.locator("h1").count();
    expect(h1CountAfter).toBeGreaterThan(h1CountBefore);

    // Type text into the heading and verify it renders inside the h1
    const uid = Date.now().toString();
    const marker = `heading ${uid}`;
    await page.keyboard.type(marker);

    const heading = editor.locator("h1").filter({ hasText: marker });
    await expect(heading).toBeVisible({ timeout: 2_000 });
  });

  test("typing '> ' converts to blockquote", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");

    const bqCountBefore = await editor.locator("blockquote").count();

    // Type the markdown shortcut: "> " triggers blockquote conversion
    await page.keyboard.type("> ");

    const bqCountAfter = await editor.locator("blockquote").count();
    expect(bqCountAfter).toBeGreaterThan(bqCountBefore);

    // Type text and verify it renders inside the blockquote
    const uid = Date.now().toString();
    const marker = `quoted ${uid}`;
    await page.keyboard.type(marker);

    const blockquote = editor.locator("blockquote").filter({ hasText: marker });
    await expect(blockquote).toBeVisible({ timeout: 2_000 });
  });

  test("typing '- ' converts to bullet list", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");

    const ulCountBefore = await editor.locator("ul").count();

    // Type the markdown shortcut: "- " triggers unordered list conversion
    await page.keyboard.type("- ");

    const ulCountAfter = await editor.locator("ul").count();
    expect(ulCountAfter).toBeGreaterThan(ulCountBefore);

    // Type text and verify it renders inside a list item
    const uid = Date.now().toString();
    const marker = `bullet ${uid}`;
    await page.keyboard.type(marker);

    const listItem = editor.locator("ul > li").filter({ hasText: marker });
    await expect(listItem).toBeVisible({ timeout: 2_000 });
  });

  test("typing '```' converts to code block", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");

    const codeCountBefore = await editor.locator("code").count();

    // Type the markdown shortcut: "```" followed by Enter/space triggers code block
    // Lexical's CODE transformer is a multiline-element that triggers on ```
    await page.keyboard.type("```");
    await page.keyboard.press("Space");

    // Wait for the code block to appear
    await expect(async () => {
      const codeCountAfter = await editor.locator("code").count();
      expect(codeCountAfter).toBeGreaterThan(codeCountBefore);
    }).toPass({ timeout: 5_000 });

    // The code block element should be visible
    const codeBlock = editor.locator("code").last();
    await expect(codeBlock).toBeVisible({ timeout: 2_000 });
  });
});
