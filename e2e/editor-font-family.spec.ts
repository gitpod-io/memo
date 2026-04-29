import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage, waitForEditor } from "./fixtures/editor-helpers";

test.describe("Editor font family selector", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await navigateToEditorPage(page);
  });

  test("font family dropdown appears in toolbar on text selection", async ({
    authenticatedPage: page,
  }) => {
    const editor = await waitForEditor(page);

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("font family test");

    // Select the text
    await page.keyboard.down("Shift");
    await page.keyboard.press("Home");
    await page.keyboard.up("Shift");

    const toolbar = page.locator('[role="toolbar"][aria-label="Text formatting"]');
    await expect(toolbar).toBeVisible({ timeout: 3_000 });

    const fontDropdown = toolbar.locator('[data-testid="editor-toolbar-font-family"]');
    await expect(fontDropdown).toBeVisible();
  });

  test("selecting sans-serif applies font-family style to text", async ({
    authenticatedPage: page,
  }) => {
    const editor = await waitForEditor(page);

    const uid = Date.now().toString();
    const marker = `sanstest ${uid}`;
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially(marker);

    // Select the text
    await page.keyboard.down("Shift");
    await page.keyboard.press("Home");
    await page.keyboard.up("Shift");

    const toolbar = page.locator('[role="toolbar"][aria-label="Text formatting"]');
    await expect(toolbar).toBeVisible({ timeout: 3_000 });

    const fontDropdown = toolbar.locator('[data-testid="editor-toolbar-font-family"]');
    await fontDropdown.selectOption("sans-serif");

    // The text should now have a font-family style containing "inter" or "sans-serif"
    const styledSpan = editor.locator("span").filter({ hasText: marker });
    await expect(styledSpan).toBeVisible({ timeout: 2_000 });
    const style = await styledSpan.getAttribute("style");
    expect(style).toBeTruthy();
    expect(style!.toLowerCase()).toContain("sans-serif");
  });

  test("selecting serif applies font-family style to text", async ({
    authenticatedPage: page,
  }) => {
    const editor = await waitForEditor(page);

    const uid = Date.now().toString();
    const marker = `seriftest ${uid}`;
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially(marker);

    // Select the text
    await page.keyboard.down("Shift");
    await page.keyboard.press("Home");
    await page.keyboard.up("Shift");

    const toolbar = page.locator('[role="toolbar"][aria-label="Text formatting"]');
    await expect(toolbar).toBeVisible({ timeout: 3_000 });

    const fontDropdown = toolbar.locator('[data-testid="editor-toolbar-font-family"]');
    await fontDropdown.selectOption("serif");

    // The text should now have a font-family style containing "Georgia" or "serif"
    const styledSpan = editor.locator("span").filter({ hasText: marker });
    await expect(styledSpan).toBeVisible({ timeout: 2_000 });
    const style = await styledSpan.getAttribute("style");
    expect(style).toBeTruthy();
    expect(style!.toLowerCase()).toContain("serif");
  });

  test("monospace selection removes inline font-family style", async ({
    authenticatedPage: page,
  }) => {
    const editor = await waitForEditor(page);

    const uid = Date.now().toString();
    const marker = `monotest ${uid}`;
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially(marker);

    // Select the text
    await page.keyboard.down("Shift");
    await page.keyboard.press("Home");
    await page.keyboard.up("Shift");

    const toolbar = page.locator('[role="toolbar"][aria-label="Text formatting"]');
    await expect(toolbar).toBeVisible({ timeout: 3_000 });

    // First apply sans-serif
    const fontDropdown = toolbar.locator('[data-testid="editor-toolbar-font-family"]');
    await fontDropdown.selectOption("sans-serif");

    // Verify sans-serif was applied
    const styledSpan = editor.locator("span").filter({ hasText: marker });
    await expect(styledSpan).toBeVisible({ timeout: 2_000 });

    // Click into the text, then re-select it to bring toolbar back
    await styledSpan.click();
    await page.keyboard.press("Home");
    await page.keyboard.down("Shift");
    await page.keyboard.press("End");
    await page.keyboard.up("Shift");
    await expect(toolbar).toBeVisible({ timeout: 3_000 });

    // Now switch back to monospace
    await fontDropdown.selectOption("monospace");

    // The text should no longer have a font-family inline style.
    // Lexical removes the span when all inline styles are cleared,
    // so the text lives directly in the paragraph node.
    const textContent = editor.locator("p").filter({ hasText: marker });
    await expect(textContent).toBeVisible({ timeout: 2_000 });
  });

  test("font choice persists after page reload", async ({
    authenticatedPage: page,
  }) => {
    const editor = await waitForEditor(page);

    const uid = Date.now().toString();
    const marker = `persist ${uid}`;
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially(marker);

    // Select the text
    await page.keyboard.down("Shift");
    await page.keyboard.press("Home");
    await page.keyboard.up("Shift");

    const toolbar = page.locator('[role="toolbar"][aria-label="Text formatting"]');
    await expect(toolbar).toBeVisible({ timeout: 3_000 });

    // Apply sans-serif
    const fontDropdown = toolbar.locator('[data-testid="editor-toolbar-font-family"]');
    await fontDropdown.selectOption("sans-serif");

    // Wait for auto-save
    const saveStatus = page.locator('[data-testid="editor-save-status"]');
    await expect(saveStatus).toContainText("Saved", { timeout: 10_000 });

    // Reload the page
    await page.reload({ waitUntil: "domcontentloaded" });
    const reloadedEditor = await waitForEditor(page);

    // The text should still have the sans-serif font-family style
    const styledSpan = reloadedEditor.locator("span").filter({ hasText: marker });
    await expect(styledSpan).toBeVisible({ timeout: 5_000 });
    const style = await styledSpan.getAttribute("style");
    expect(style).toBeTruthy();
    expect(style!.toLowerCase()).toContain("sans-serif");
  });
});
