import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage, modifierKey } from "./fixtures/editor-helpers";

const mod = modifierKey();

test.describe("Editor auto-link detection", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await navigateToEditorPage(page);
  });

  test("typing an https URL and pressing space converts it to a link", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("https://example.com");
    // Auto-link triggers when the user types a space after the URL
    await page.keyboard.press("Space");

    const link = editor.locator('a[href="https://example.com"]');
    await expect(link).toBeVisible({ timeout: 5_000 });
    await expect(link).toHaveText("https://example.com");
  });

  test("typing a www URL converts it to a link with https:// prefix", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("www.example.com");
    await page.keyboard.press("Space");

    const link = editor.locator('a[href="https://www.example.com"]');
    await expect(link).toBeVisible({ timeout: 5_000 });
    await expect(link).toHaveText("www.example.com");
  });

  test("typing an email address converts it to a mailto link", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("user@example.com");
    await page.keyboard.press("Space");

    const link = editor.locator('a[href="mailto:user@example.com"]');
    await expect(link).toBeVisible({ timeout: 5_000 });
    await expect(link).toHaveText("user@example.com");
  });

  test("pasting a URL converts it to a link", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");

    // Write URL to clipboard and paste it
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate(async () => {
      await navigator.clipboard.writeText("https://example.com/pasted");
    });
    await page.keyboard.press(`${mod}+v`);
    // Trigger auto-link by pressing space after the pasted URL
    await page.keyboard.press("Space");

    const link = editor.locator('a[href="https://example.com/pasted"]');
    await expect(link).toBeVisible({ timeout: 5_000 });
    await expect(link).toHaveText("https://example.com/pasted");
  });

  test("partial URL without TLD is NOT converted to a link", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Count existing links before typing
    const linksBefore = await editor.locator("a").count();

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("example");
    await page.keyboard.press("Space");

    // No new links should have been created
    const linksAfter = await editor.locator("a").count();
    expect(linksAfter).toBe(linksBefore);

    // Also verify the text is present as plain text, not wrapped in a link
    await expect(editor).toContainText("example");
  });
});
