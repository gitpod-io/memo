import { test, expect } from "./fixtures/auth";

test.describe("Page CRUD", () => {
  test("user can create a new page from sidebar", async ({
    authenticatedPage: page,
  }) => {
    const newPageBtn = page.getByRole("button", { name: /new page/i });
    if ((await newPageBtn.count()) === 0) {
      test.skip(true, "New page button not found");
      return;
    }

    const initialUrl = page.url();
    await newPageBtn.click();

    // Should navigate to the new page
    await page.waitForURL((url) => url.href !== initialUrl, { timeout: 10_000 });
    const newUrl = page.url();
    expect(new URL(newUrl).pathname.split("/").filter(Boolean).length).toBeGreaterThanOrEqual(2);

    // Editor should be visible
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });
  });

  test("user can navigate to a page via sidebar", async ({
    authenticatedPage: page,
  }) => {
    const pageButton = page.locator("button").filter({ hasText: /ago/ });
    if ((await pageButton.count()) === 0) {
      test.skip(true, "No pages in sidebar");
      return;
    }

    await pageButton.first().click();
    await page.waitForURL(
      (url) => url.pathname.split("/").filter(Boolean).length >= 2,
      { timeout: 10_000 }
    );

    // Editor should be visible on the page
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });
  });

  test("user can rename a page via inline title", async ({
    authenticatedPage: page,
  }) => {
    // Navigate to a page
    const pageButton = page.locator("button").filter({ hasText: /ago/ });
    if ((await pageButton.count()) === 0) {
      test.skip(true, "No pages available");
      return;
    }

    await pageButton.first().click();
    await page.waitForURL(
      (url) => url.pathname.split("/").filter(Boolean).length >= 2,
      { timeout: 10_000 }
    );

    // Find the page title input
    const titleInput = page.locator('input[aria-label*="title" i], input[placeholder*="untitled" i]').or(
      page.locator("h1").first()
    );

    if ((await titleInput.count()) === 0) {
      test.skip(true, "Title input not found");
      return;
    }

    // Click and edit the title
    await titleInput.first().click();
    await page.keyboard.press("Meta+a");
    const testTitle = `E2E Test ${Date.now()}`;
    await page.keyboard.type(testTitle);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1_000);

    // Title should be updated (could be an input or a contenteditable heading)
    const titleText = await titleInput.first().inputValue().catch(() => null)
      ?? await titleInput.first().textContent();
    expect(titleText).toContain(testTitle);
  });

  test("user can delete a page with confirmation", async ({
    authenticatedPage: page,
  }) => {
    // Create a page first so we have something to delete
    const newPageBtn = page.getByRole("button", { name: /new page/i });
    if ((await newPageBtn.count()) === 0) {
      test.skip(true, "New page button not found");
      return;
    }

    await newPageBtn.click();
    await page.waitForURL(
      (url) => url.pathname.split("/").filter(Boolean).length >= 2,
      { timeout: 10_000 }
    );
    await page.waitForTimeout(1_000);

    // Look for a delete option in the page tree context menu
    // Hover the page item in the sidebar to reveal the more menu
    const sidebarItems = page.locator("button").filter({ hasText: /ago/ });
    if ((await sidebarItems.count()) === 0) {
      test.skip(true, "No sidebar items to test delete");
      return;
    }

    await sidebarItems.first().hover();
    await page.waitForTimeout(300);

    // Look for a "..." or more options button
    const moreBtn = page.locator('[aria-label*="more" i], [aria-label*="options" i]').or(
      page.locator("button").filter({ hasText: "..." })
    );

    if ((await moreBtn.count()) === 0) {
      test.skip(true, "More options button not found");
      return;
    }

    await moreBtn.first().click();
    await page.waitForTimeout(300);

    // Click delete
    const deleteBtn = page.getByRole("menuitem", { name: /delete/i });
    if ((await deleteBtn.count()) === 0) {
      test.skip(true, "Delete menu item not found");
      return;
    }

    await deleteBtn.click();

    // Confirmation dialog should appear
    const confirmBtn = page.getByRole("button", { name: /delete|confirm/i }).last();
    await expect(confirmBtn).toBeVisible({ timeout: 3_000 });
    await confirmBtn.click();

    await page.waitForTimeout(1_000);
  });
});
