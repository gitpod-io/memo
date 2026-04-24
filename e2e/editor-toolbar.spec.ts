import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage, modifierKey } from "./fixtures/editor-helpers";

const mod = modifierKey();

test.describe("Editor floating toolbar", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await navigateToEditorPage(page);
  });

  test("toolbar appears on text selection", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Type some text
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("Select this text for toolbar");

    // Select the text
    await page.keyboard.down("Shift");
    await page.keyboard.press("Home");
    await page.keyboard.up("Shift");

    // Toolbar should appear
    const toolbar = page.locator('[role="toolbar"][aria-label="Text formatting"]');
    await expect(toolbar).toBeVisible({ timeout: 3_000 });
  });

  test("bold button toggles bold formatting", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Use unique text to avoid matching leftover bold content from previous runs
    const uid = Date.now().toString();
    const marker = `boldme ${uid}`;
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type(marker);

    // Select the text we just typed
    await page.keyboard.down("Shift");
    await page.keyboard.press("Home");
    await page.keyboard.up("Shift");

    const toolbar = page.locator('[role="toolbar"][aria-label="Text formatting"]');
    await expect(toolbar).toBeVisible({ timeout: 3_000 });

    // Click bold button
    const boldBtn = toolbar.getByRole("button", { name: /bold/i });
    await boldBtn.click();

    // The bold button should now be active (pressed)
    await expect(boldBtn).toHaveAttribute("aria-pressed", "true");

    // The text should be wrapped in a bold element — filter by our unique text
    const boldText = editor.locator("strong").filter({ hasText: marker });
    await expect(boldText).toBeVisible({ timeout: 2_000 });
  });

  test("toolbar disappears when selection is collapsed", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("deselect test");

    // Select text
    await page.keyboard.down("Shift");
    await page.keyboard.press("Home");
    await page.keyboard.up("Shift");

    const toolbar = page.locator('[role="toolbar"][aria-label="Text formatting"]');
    await expect(toolbar).toBeVisible({ timeout: 3_000 });

    // Click somewhere to collapse selection
    await editor.click();

    // Toolbar should disappear
    await expect(toolbar).not.toBeVisible({ timeout: 2_000 });
  });

  test("keyboard shortcut Cmd+B applies bold", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Use unique text to avoid matching leftover bold content from previous runs
    const uid = Date.now().toString();
    const marker = `kbdbold ${uid}`;
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type(marker);

    // Select text
    await page.keyboard.down("Shift");
    await page.keyboard.press("Home");
    await page.keyboard.up("Shift");

    // Apply bold via keyboard shortcut
    await page.keyboard.press(`${mod}+b`);

    // Filter by our unique text to avoid matching pre-existing bold elements
    const boldText = editor.locator("strong").filter({ hasText: marker });
    await expect(boldText).toBeVisible({ timeout: 2_000 });
  });
});
