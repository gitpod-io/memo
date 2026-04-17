import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage } from "./fixtures/editor-helpers";

test.describe("Code block paste", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await navigateToEditorPage(page);
  });

  test("pasting multi-line text into a code block preserves all lines", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Insert a code block via slash command
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/code");

    const codeOption = page.locator('[role="option"]', {
      hasText: /code block/i,
    });
    await expect(codeOption).toBeVisible({ timeout: 3_000 });
    await codeOption.click();

    // Wait for the code block to appear
    const codeBlock = editor.locator("code");
    await expect(codeBlock).toBeVisible({ timeout: 3_000 });

    // Focus inside the code block
    await codeBlock.click();

    // Write multi-line text to the clipboard and paste it
    const multiLineCode = "const a = 1;\nconst b = 2;\nconst c = 3;";

    // Grant clipboard permissions and write to clipboard
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text);
    }, multiLineCode);

    // Paste using keyboard shortcut
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+v`);

    // Verify all three lines are present inside the code block
    await expect(codeBlock).toContainText("const a = 1;", { timeout: 3_000 });
    await expect(codeBlock).toContainText("const b = 2;");
    await expect(codeBlock).toContainText("const c = 3;");

    // Verify line breaks exist between lines. Lexical renders LineBreakNodes as
    // <br> elements, so innerText (which respects <br>) should contain newlines.
    const codeText = await codeBlock.evaluate(
      (el) => (el as HTMLElement).innerText
    );
    const lines = codeText.split("\n").filter((l: string) => l.trim() !== "");
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });

  test("pasting single-line text into a code block works normally", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Insert a code block via slash command
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/code");

    const codeOption = page.locator('[role="option"]', {
      hasText: /code block/i,
    });
    await expect(codeOption).toBeVisible({ timeout: 3_000 });
    await codeOption.click();

    const codeBlock = editor.locator("code");
    await expect(codeBlock).toBeVisible({ timeout: 3_000 });
    await codeBlock.click();

    // Paste single-line text
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text);
    }, "const x = 42;");

    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+v`);

    await expect(codeBlock).toContainText("const x = 42;", { timeout: 3_000 });
  });
});
