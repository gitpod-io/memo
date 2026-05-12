import { test, expect } from "./fixtures/auth";

/**
 * Helper: waits for the sidebar page tree to finish loading.
 * The tree renders either treeitem elements or "No pages yet" once loaded.
 */
async function waitForTreeLoaded(page: import("@playwright/test").Page) {
  const sidebar = page.getByRole("complementary");
  const treeLoaded = sidebar
    .locator('[role="treeitem"], :text("No pages yet")')
    .first();
  await expect(treeLoaded).toBeVisible({ timeout: 10_000 });
}

/**
 * Helper: creates a new page via the sidebar "New Page" button and waits
 * for the editor to appear. Retries on 404 (Supabase replication lag).
 * Returns the URL of the new page.
 */
async function createPage(page: import("@playwright/test").Page) {
  const sidebar = page.getByRole("complementary");
  await waitForTreeLoaded(page);

  const newPageBtn = sidebar.getByTestId("sb-new-page-btn");
  await newPageBtn.click();

  // Wait for navigation to the new page
  await page.waitForURL(
    (url) => url.pathname.split("/").filter(Boolean).length >= 2,
    { timeout: 10_000 },
  );

  // Wait for the editor to appear. If the server returns a 404 (Supabase
  // replication lag between client-side insert and server-side read), reload
  // and retry — same pattern as navigateToEditorPage.
  const editor = page.locator('[contenteditable="true"]');
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const visible = await editor
      .waitFor({ state: "visible", timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (visible) break;

    const is404 = await page
      .getByText("Page not found")
      .isVisible()
      .catch(() => false);
    if (is404 && attempt < maxRetries) {
      await page.reload({ waitUntil: "domcontentloaded" });
      continue;
    }

    throw new Error(
      `createPage: editor not visible after ${attempt + 1} attempt(s)`,
    );
  }

  // Wait for the page to be saved — the sidebar tree item appears once persisted
  await expect(
    page.getByRole("complementary").locator('[role="treeitem"][aria-selected="true"]'),
  ).toBeVisible({ timeout: 10_000 });

  return page.url();
}

/**
 * Helper: soft-deletes the currently selected tree item in the sidebar.
 * The selected item corresponds to the page currently being viewed.
 * Falls back to the first tree item if no selected item is found.
 */
async function softDeleteCurrentPage(
  page: import("@playwright/test").Page,
) {
  const sidebar = page.getByRole("complementary");
  const treeItems = sidebar.locator('[role="treeitem"]');
  await expect(treeItems.first()).toBeVisible({ timeout: 10_000 });

  // Target the selected tree item (the page we're currently viewing)
  const selectedItem = sidebar.locator('[role="treeitem"][aria-selected="true"]');
  const target =
    (await selectedItem.count()) > 0 ? selectedItem.first() : treeItems.first();

  // Hover to reveal the actions button
  await target.hover();

  // Click the "Page actions" more options button
  const moreBtn = target
    .locator('[aria-label*="action" i]')
    .or(target.locator('[aria-label*="more" i]'));
  await expect(moreBtn.first()).toBeVisible({ timeout: 5_000 });
  await moreBtn.first().click();

  // Click Delete in the dropdown
  const deleteBtn = page.getByRole("menuitem", { name: /delete/i });
  await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
  await deleteBtn.click();

  // Confirm the soft-delete dialog
  const confirmBtn = page.getByRole("button", { name: /move to trash/i });
  await expect(confirmBtn).toBeVisible({ timeout: 3_000 });
  await confirmBtn.click();

  // Wait for the tree to update after deletion
  await expect(confirmBtn).not.toBeVisible({ timeout: 5_000 });
}

test.describe("Trash and soft-delete operations", () => {
  test("user can soft-delete a page from the sidebar context menu", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.getByRole("complementary");

    // Create a page to delete
    await createPage(page);
    await waitForTreeLoaded(page);

    // Count tree items before delete
    const treeItems = sidebar.locator('[role="treeitem"]');
    const countBefore = await treeItems.count();

    // Soft-delete the first tree item
    await softDeleteCurrentPage(page);

    // The tree should have one fewer item (or be empty)
    if (countBefore === 1) {
      // Tree may show "No pages yet" or have zero items
      await expect(treeItems).toHaveCount(0, { timeout: 5_000 });
    } else {
      await expect(treeItems).toHaveCount(countBefore - 1, {
        timeout: 5_000,
      });
    }
  });

  test("deleted page appears in the trash section of the sidebar", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.getByRole("complementary");

    // Create and soft-delete a page
    await createPage(page);
    await waitForTreeLoaded(page);
    await softDeleteCurrentPage(page);

    // The Trash section should now be visible in the sidebar
    const trashToggle = sidebar.getByRole("button", { name: /trash/i });
    await expect(trashToggle).toBeVisible({ timeout: 5_000 });

    // Expand the trash section
    await trashToggle.click();

    // The trash section should contain at least one item (the deleted page)
    // Trash items show "Untitled" for pages without a title
    const trashItem = sidebar.locator("text=Untitled").first();
    await expect(trashItem).toBeVisible({ timeout: 5_000 });
  });

  test("user can restore a page from trash", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.getByRole("complementary");

    // Create and soft-delete a page
    await createPage(page);
    await waitForTreeLoaded(page);

    // Count trash items before (may be 0 if trash section is hidden)
    const trashToggleBefore = sidebar.getByRole("button", {
      name: /trash/i,
    });
    const hadTrashBefore = (await trashToggleBefore.count()) > 0;

    await softDeleteCurrentPage(page);

    // Expand the trash section
    const trashToggle = sidebar.getByRole("button", { name: /trash/i });
    await expect(trashToggle).toBeVisible({ timeout: 5_000 });
    await trashToggle.click();

    // Click the restore button on the first trashed page
    const restoreBtn = sidebar
      .getByRole("button", { name: /restore page/i })
      .first();
    await expect(restoreBtn).toBeVisible({ timeout: 5_000 });
    await restoreBtn.click();

    // Wait for the restore to complete — the restore button disappears
    await expect(restoreBtn).not.toBeVisible({ timeout: 10_000 });

    // Verify the page was restored: a success toast should appear,
    // and the page tree should have the page back. If there was no
    // trash before, the trash section should disappear.
    if (!hadTrashBefore) {
      await expect(trashToggle).not.toBeVisible({ timeout: 5_000 });
    }

    // The page tree should contain at least one item
    const treeItems = sidebar.locator('[role="treeitem"]');
    await expect(treeItems.first()).toBeVisible({ timeout: 5_000 });
  });

  test("user can permanently delete a page from trash", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.getByRole("complementary");

    // Create and soft-delete a page
    await createPage(page);
    await waitForTreeLoaded(page);
    await softDeleteCurrentPage(page);

    // Expand the trash section
    const trashToggle = sidebar.getByRole("button", { name: /trash/i });
    await expect(trashToggle).toBeVisible({ timeout: 5_000 });
    await trashToggle.click();

    // Click the permanent delete button on the first trashed page
    const permanentDeleteBtn = sidebar
      .getByRole("button", { name: /permanently delete page/i })
      .first();
    await expect(permanentDeleteBtn).toBeVisible({ timeout: 5_000 });
    await permanentDeleteBtn.click();

    // Confirmation dialog should appear
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    await expect(dialog.getByText(/permanently deleted/i)).toBeVisible();

    // Confirm permanent deletion
    const deleteForeverBtn = dialog.getByRole("button", {
      name: /delete permanently/i,
    });
    await deleteForeverBtn.click();

    // Wait for the dialog to close (operation complete)
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  });

  test("user can empty all trash", async ({ authenticatedPage: page }) => {
    const sidebar = page.getByRole("complementary");

    // Create and soft-delete a page
    await createPage(page);
    await waitForTreeLoaded(page);
    await softDeleteCurrentPage(page);

    // Expand the trash section
    const trashToggle = sidebar.getByRole("button", { name: /trash/i });
    await expect(trashToggle).toBeVisible({ timeout: 5_000 });
    await trashToggle.click();

    // Click "Empty trash" button
    const emptyTrashBtn = sidebar.getByRole("button", {
      name: /empty trash/i,
    });
    await expect(emptyTrashBtn).toBeVisible({ timeout: 5_000 });
    await emptyTrashBtn.click();

    // Confirmation dialog should appear
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    await expect(dialog.getByText(/permanently deleted/i)).toBeVisible();

    // Confirm empty trash
    const confirmEmptyBtn = dialog.getByRole("button", {
      name: /empty trash/i,
    });
    await confirmEmptyBtn.click();

    // The trash section should disappear (hidden when empty)
    await expect(trashToggle).not.toBeVisible({ timeout: 10_000 });
  });

  test("soft-deleted page is not visible in the main page tree", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.getByRole("complementary");

    // Create a page
    await createPage(page);
    await waitForTreeLoaded(page);

    const treeItems = sidebar.locator('[role="treeitem"]');
    const countBefore = await treeItems.count();

    // Soft-delete the first tree item
    await softDeleteCurrentPage(page);

    // Verify the tree has one fewer item
    if (countBefore === 1) {
      await expect(treeItems).toHaveCount(0, { timeout: 5_000 });
    } else {
      await expect(treeItems).toHaveCount(countBefore - 1, {
        timeout: 5_000,
      });
    }

    // The trash section should be visible (page moved there, not gone)
    const trashToggle = sidebar.getByRole("button", { name: /trash/i });
    await expect(trashToggle).toBeVisible({ timeout: 5_000 });
  });

  test("soft-deleted page is not accessible via direct URL", async ({
    authenticatedPage: page,
  }) => {
    // Create a page and capture its URL
    const pageUrl = await createPage(page);

    // Go back to sidebar and soft-delete
    await waitForTreeLoaded(page);
    await softDeleteCurrentPage(page);

    // Navigate directly to the deleted page's URL
    await page.goto(pageUrl);
    await page.waitForLoadState("domcontentloaded");

    // The page should show a not-found state — match the heading specifically
    // to avoid false positives from sidebar page titles containing "not"
    const notFoundHeading = page.getByRole("heading", {
      name: /page not found/i,
    });
    await expect(notFoundHeading).toBeVisible({ timeout: 10_000 });
  });
});
