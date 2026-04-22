import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage, selectSlashOption } from "./fixtures/editor-helpers";

test.describe("Editor list indentation", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await navigateToEditorPage(page);
  });

  test("Tab indents a bullet list item into a nested list", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Create a bullet list with two items via slash command
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");

    await selectSlashOption(page, "Bullet List");

    await page.keyboard.type("First item");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second item");

    // Verify we start with a flat list (no nested <ul>)
    await expect(editor.locator("ul ul")).not.toBeVisible();

    // Press Tab to indent the second item
    await page.keyboard.press("Tab");

    // Lexical wraps the indented item in a nested <ul> inside a wrapper <li>
    const nestedList = editor.locator("ul ul");
    await expect(nestedList).toBeVisible();
    await expect(nestedList.locator("> li")).toHaveCount(1);
    await expect(nestedList.locator("> li")).toContainText("Second item");
  });

  test("Shift+Tab unindents a nested bullet list item", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Create a bullet list and indent the second item
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");

    await selectSlashOption(page, "Bullet List");

    await page.keyboard.type("First item");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second item");
    await page.keyboard.press("Tab");

    // Verify it's nested
    const nestedList = editor.locator("ul ul");
    await expect(nestedList).toBeVisible();

    // Now Shift+Tab to unindent
    await page.keyboard.press("Shift+Tab");

    // Should be back to a flat list with no nesting
    await expect(nestedList).not.toBeVisible();
  });

  test("Tab indents a numbered list item into a nested list", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Create a numbered list via slash command
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");

    await selectSlashOption(page, "Numbered List");

    await page.keyboard.type("First item");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second item");

    // Press Tab to indent
    await page.keyboard.press("Tab");

    // The second item should be nested inside the first
    const nestedList = editor.locator("ol ol");
    await expect(nestedList).toBeVisible();
    await expect(nestedList.locator("> li")).toHaveCount(1);
  });
});
