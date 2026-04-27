import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage, modifierKey, waitForEditor } from "./fixtures/editor-helpers";

const mod = modifierKey();

test.describe("Editor floating link editor", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await navigateToEditorPage(page);
  });

  test("link button in toolbar creates a link", async ({
    authenticatedPage: page,
  }) => {
    const editor = await waitForEditor(page);

    // Count existing links before we create one
    const linksBefore = await editor.locator("a").count();

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("link text here");

    // Select text
    await page.keyboard.down("Shift");
    await page.keyboard.press("Home");
    await page.keyboard.up("Shift");

    // Click link button in toolbar
    const toolbar = page.locator('[role="toolbar"][aria-label="Text formatting"]');
    await expect(toolbar).toBeVisible({ timeout: 3_000 });

    const linkBtn = toolbar.getByRole("button", { name: /link/i });
    await linkBtn.click();

    // A new link element should be created
    const links = editor.locator("a");
    await expect(links).toHaveCount(linksBefore + 1, { timeout: 2_000 });
  });

  test("link editor appears when cursor is in a link", async ({
    authenticatedPage: page,
  }) => {
    const editor = await waitForEditor(page);

    // Create a link first
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("click me");

    await page.keyboard.down("Shift");
    await page.keyboard.press("Home");
    await page.keyboard.up("Shift");

    // Use Cmd/Ctrl+K to create link — the shortcut handler is registered
    // via useEffect in FloatingLinkEditorPlugin which may not have fired
    // yet after the lazy-load boundary resolves. Wait for the toolbar to
    // confirm floating plugins are mounted before sending the shortcut.
    const toolbar = page.locator('[role="toolbar"][aria-label="Text formatting"]');
    await expect(toolbar).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press(`${mod}+k`);

    // The link editor popover should appear with a URL input
    const linkEditor = page.locator('input[type="url"]');
    await expect(linkEditor).toBeVisible({ timeout: 5_000 });

    // Type a URL and save
    await linkEditor.fill("https://example.com");
    await page.keyboard.press("Enter");

    // The link should now have the URL
    const link = editor.locator('a[href="https://example.com"]').last();
    await expect(link).toBeVisible({ timeout: 2_000 });
  });

  test("link can be removed via link editor", async ({
    authenticatedPage: page,
  }) => {
    const editor = await waitForEditor(page);

    // Count existing links before we create one
    const linksBefore = await editor.locator("a").count();

    // Create a link
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("remove me");

    await page.keyboard.down("Shift");
    await page.keyboard.press("Home");
    await page.keyboard.up("Shift");

    // Wait for the floating toolbar to confirm plugins are mounted
    const toolbar = page.locator('[role="toolbar"][aria-label="Text formatting"]');
    await expect(toolbar).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press(`${mod}+k`);

    const linkInput = page.locator('input[type="url"]');
    await expect(linkInput).toBeVisible({ timeout: 5_000 });
    await linkInput.fill("https://example.com");
    await page.keyboard.press("Enter");

    // Click on the link we just created to show the link editor
    const link = editor.locator('a[href="https://example.com"]').last();
    await expect(link).toBeVisible();
    await link.click();

    // Click remove button
    const removeBtn = page.getByRole("button", { name: /remove link/i });
    await expect(removeBtn).toBeVisible({ timeout: 3_000 });
    await removeBtn.click();

    // The link we created should be gone — count should be back to what it was
    const links = editor.locator("a");
    await expect(links).toHaveCount(linksBefore, { timeout: 2_000 });
  });
});
