import { test, expect } from "./fixtures/auth";

test.describe("Editor floating link editor", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    const pageButton = page.locator("button").filter({ hasText: /ago/ });
    if ((await pageButton.count()) > 0) {
      await pageButton.first().click();
      await page.waitForURL((url) => url.pathname.split("/").filter(Boolean).length >= 2);
    }
  });

  test("link button in toolbar creates a link", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("link text here");
    await page.waitForTimeout(200);

    // Select text
    await page.keyboard.down("Shift");
    await page.keyboard.press("Home");
    await page.keyboard.up("Shift");

    // Click link button in toolbar
    const toolbar = page.locator('[role="toolbar"][aria-label="Text formatting"]');
    await expect(toolbar).toBeVisible({ timeout: 3_000 });

    const linkBtn = toolbar.getByRole("button", { name: /link/i });
    await linkBtn.click();
    await page.waitForTimeout(300);

    // A link element should be created (with default https://)
    const link = editor.locator("a");
    await expect(link).toBeVisible({ timeout: 2_000 });
  });

  test("link editor appears when cursor is in a link", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Create a link first
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("click me");
    await page.waitForTimeout(200);

    await page.keyboard.down("Shift");
    await page.keyboard.press("Home");
    await page.keyboard.up("Shift");

    // Use Cmd+K to create link
    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(500);

    // The link editor popover should appear with a URL input
    const linkEditor = page.locator('input[type="url"]');
    await expect(linkEditor).toBeVisible({ timeout: 3_000 });

    // Type a URL and save
    await linkEditor.fill("https://example.com");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);

    // The link should now have the URL
    const link = editor.locator('a[href="https://example.com"]');
    await expect(link).toBeVisible({ timeout: 2_000 });
  });

  test("link can be removed via link editor", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Create a link
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("remove me");
    await page.waitForTimeout(200);

    await page.keyboard.down("Shift");
    await page.keyboard.press("Home");
    await page.keyboard.up("Shift");

    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(500);

    const linkInput = page.locator('input[type="url"]');
    await expect(linkInput).toBeVisible({ timeout: 3_000 });
    await linkInput.fill("https://example.com");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);

    // Click on the link to show the link editor
    const link = editor.locator("a").first();
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForTimeout(300);

    // Click remove button
    const removeBtn = page.getByRole("button", { name: /remove link/i });
    await expect(removeBtn).toBeVisible({ timeout: 3_000 });
    await removeBtn.click();
    await page.waitForTimeout(300);

    // Link should be gone
    const links = editor.locator("a");
    await expect(links).toHaveCount(0, { timeout: 2_000 });
  });
});
