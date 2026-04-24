import { test, expect } from "./fixtures/auth";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Admin client for cleanup
// ---------------------------------------------------------------------------

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Track database page IDs created during tests for cleanup
const createdDatabaseIds: string[] = [];

test.afterAll(async () => {
  if (createdDatabaseIds.length === 0) return;
  const admin = getAdminClient();
  for (const id of createdDatabaseIds) {
    // Hard-delete child pages (rows) first, then the database page
    await admin.from("pages").delete().eq("parent_id", id);
    await admin.from("pages").delete().eq("id", id);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait for the sidebar page tree to finish loading.
 * Returns the sidebar locator.
 */
async function waitForSidebarTree(page: import("@playwright/test").Page) {
  const sidebar = page.getByRole("complementary");
  const treeLoaded = sidebar
    .locator('[role="treeitem"], :text("No pages yet")')
    .first();
  await expect(treeLoaded).toBeVisible({ timeout: 15_000 });
  return sidebar;
}

/**
 * Create a new database via the sidebar button and wait for the database
 * page to load. Returns the database page ID extracted from the URL.
 */
async function createDatabaseFromSidebar(
  page: import("@playwright/test").Page,
): Promise<string> {
  const sidebar = await waitForSidebarTree(page);

  const newDbBtn = sidebar.getByRole("button", { name: /new database/i });
  await expect(newDbBtn).toBeVisible({ timeout: 5_000 });
  await newDbBtn.click();

  // Wait for navigation to the database page
  await page.waitForURL(
    (url) => url.pathname.split("/").filter(Boolean).length >= 2,
    { timeout: 15_000 },
  );

  // Wait for the database view to load — the empty state shows "No rows yet",
  // the populated state shows a grid with role="grid".
  const dbLoaded = page
    .locator('[role="grid"], :text("No rows yet")')
    .first();
  await expect(dbLoaded).toBeVisible({ timeout: 15_000 });

  // Extract page ID from URL: /<workspaceSlug>/<pageId>
  const pathParts = new URL(page.url()).pathname.split("/").filter(Boolean);
  const pageId = pathParts[pathParts.length - 1];
  createdDatabaseIds.push(pageId);
  return pageId;
}

/**
 * Add a column via the PropertyTypePicker dropdown.
 * Clicks the "Add column" button, selects the given type from the dropdown,
 * and waits for the new column header to appear.
 */
async function addColumnViaTypePicker(
  page: import("@playwright/test").Page,
  typeName = "Text",
) {
  const addColumnBtn = page.locator('button[aria-label="Add column"]');
  await expect(addColumnBtn).toBeVisible({ timeout: 5_000 });
  await addColumnBtn.click();

  // Select the property type from the dropdown menu
  const menuItem = page.getByRole("menuitem", { name: typeName });
  await expect(menuItem).toBeVisible({ timeout: 5_000 });
  await menuItem.click();

  // Wait for the menu to close (column added)
  await expect(menuItem).not.toBeVisible({ timeout: 5_000 });
}

/**
 * Open the column header dropdown menu for a property column.
 * Clicks the "..." menu button inside the column header.
 */
async function openColumnMenu(
  page: import("@playwright/test").Page,
  headerLocator: import("@playwright/test").Locator,
) {
  // The dropdown trigger has aria-label "<name> column menu"
  const menuTrigger = headerLocator.locator('[aria-label$="column menu"]');
  await expect(menuTrigger).toBeAttached({ timeout: 5_000 });
  // Hover to reveal the menu button (it's transparent until hover)
  await headerLocator.hover();
  await menuTrigger.click();
}

/**
 * Rename a property column via the column header dropdown + RenamePropertyDialog.
 * Opens the column menu, clicks "Rename property", fills the dialog input, and confirms.
 */
async function renamePropertyViaDialog(
  page: import("@playwright/test").Page,
  headerLocator: import("@playwright/test").Locator,
  newName: string,
) {
  await openColumnMenu(page, headerLocator);

  // Click "Rename property" in the dropdown
  const renameItem = page.getByRole("menuitem", { name: "Rename property" });
  await expect(renameItem).toBeVisible({ timeout: 5_000 });
  await renameItem.click();

  // Wait for the rename dialog to appear
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  // Fill the input and confirm
  const input = dialog.locator('input#property-name');
  await expect(input).toBeVisible({ timeout: 3_000 });
  await input.fill(newName);

  const renameBtn = dialog.getByRole("button", { name: "Rename" });
  await renameBtn.click();

  // Wait for the dialog to close
  await expect(dialog).not.toBeVisible({ timeout: 5_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Database CRUD", () => {
  test("user can create a new database from the sidebar", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // The breadcrumb should show "Untitled Database"
    const breadcrumb = page.locator(':text("Untitled Database")').first();
    await expect(breadcrumb).toBeVisible({ timeout: 10_000 });

    // The table view empty state should show the "TITLE" column header
    // (rendered as uppercase text in a .bg-muted container)
    const titleHeader = page.locator(".bg-muted").filter({
      hasText: /title/i,
    }).first();
    await expect(titleHeader).toBeVisible({ timeout: 10_000 });

    // The empty state should show "No rows yet"
    await expect(page.locator(':text("No rows yet")')).toBeVisible({
      timeout: 5_000,
    });

    // The "+ New" button should be visible (onAddRow is now wired up)
    const addRowBtn = page.getByTestId("db-table-add-row");
    await expect(addRowBtn).toBeVisible({ timeout: 5_000 });
  });

  test("user can add a text property column to a database", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // The empty state doesn't render the "Add column" button with
    // aria-label. Add a row first so the full grid renders.
    const addRowBtn = page.getByTestId("db-table-add-row");
    await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
    await addRowBtn.click();

    // Wait for the grid to appear (row added → non-empty state)
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // Add a text column via the property type picker dropdown
    await addColumnViaTypePicker(page, "Text");

    // The new column should be named after its type label ("Text")
    const newHeader = page.locator('[role="columnheader"]', {
      hasText: /^text$/i,
    });
    await expect(newHeader.first()).toBeVisible({ timeout: 5_000 });
  });

  test("user can add a row and edit cell values inline in table view", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a row to get the full grid
    const addRowBtn = page.getByTestId("db-table-add-row");
    await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
    await addRowBtn.click();

    // Wait for the grid
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // Add a text property column via the type picker dropdown
    await addColumnViaTypePicker(page, "Text");

    // Click on a property cell to start editing.
    // Property cells use roving tabindex (focused cell gets tabindex=0,
    // others get tabindex=-1). Click the first data cell with a data-col
    // attribute (property cells, not the title cell).
    const editableCells = page.locator(
      '[role="gridcell"][data-col]',
    );
    await expect(editableCells.first()).toBeVisible({ timeout: 5_000 });
    await editableCells.first().click();

    // An input should appear for inline editing
    const cellInput = page.locator(
      '[role="gridcell"] input[type="text"], [role="gridcell"] input[type="number"]',
    );
    await expect(cellInput).toBeVisible({ timeout: 5_000 });

    // Type a value and click outside to blur and save
    await cellInput.fill("Test Value");
    // Click the page title area to blur the cell input
    await page.locator("h1, input[aria-label]").first().click();

    // The cell should now display the value
    const cellText = page.locator('[role="gridcell"]', {
      hasText: "Test Value",
    });
    await expect(cellText.first()).toBeVisible({ timeout: 5_000 });
  });

  test("user can delete a row from the table view", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a row first
    const addRowBtn = page.getByTestId("db-table-add-row");
    await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
    await addRowBtn.click();

    // Wait for the grid to appear
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // Hover over the title cell to reveal the delete button
    const titleCell = page.locator('[role="gridcell"]').first();
    await titleCell.hover();

    // Click the delete button
    const deleteBtn = page.locator('button[aria-label="Delete row"]').first();
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
    await deleteBtn.click();

    // Row is optimistically removed — "No rows yet" should appear
    await expect(page.locator(':text("No rows yet")')).toBeVisible({
      timeout: 10_000,
    });

    // An undo toast should appear
    const undoToast = page.locator('[data-sonner-toast]', { hasText: "Row deleted" });
    await expect(undoToast).toBeVisible({ timeout: 5_000 });

    // Wait for the toast to dismiss and deletion to persist
    await expect(undoToast).not.toBeVisible({ timeout: 12_000 });
  });

  test("user can undo row deletion via toast", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a row first
    const addRowBtn = page.locator("button", { hasText: "+ New" });
    await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
    await addRowBtn.click();

    // Wait for the grid to appear
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // Hover over the title cell to reveal the delete button
    const titleCell = page.locator('[role="gridcell"]').first();
    await titleCell.hover();

    // Click the delete button
    const deleteBtn = page.locator('button[aria-label="Delete row"]').first();
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
    await deleteBtn.click();

    // Row is optimistically removed
    await expect(page.locator(':text("No rows yet")')).toBeVisible({
      timeout: 10_000,
    });

    // Click the Undo button in the toast
    const undoBtn = page.locator('[data-sonner-toast]', { hasText: "Row deleted" })
      .getByRole("button", { name: "Undo" });
    await expect(undoBtn).toBeVisible({ timeout: 5_000 });
    await undoBtn.click();

    // Row should be restored — grid should be visible with a row
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator(':text("No rows yet")')).not.toBeVisible({
      timeout: 5_000,
    });
  });

  test("user can rename a database property (column header)", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a row to get the full grid, then add a column
    const addRowBtn = page.getByTestId("db-table-add-row");
    await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
    await addRowBtn.click();
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // Add a column via the property type picker
    await addColumnViaTypePicker(page, "Text");

    // Click the column header (named "Text" after its type) to open
    // the rename dialog, fill in the new name, and confirm.
    const propertyHeader = page
      .locator('[role="columnheader"]', { hasText: /^text$/i })
      .first();
    await renamePropertyViaDialog(page, propertyHeader, "Renamed Column");

    // The column header should now show the new name
    const renamedHeader = page.locator('[role="columnheader"]', {
      hasText: "Renamed Column",
    });
    await expect(renamedHeader.first()).toBeVisible({ timeout: 10_000 });
  });

  test("user can delete a property column via the column header menu", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a row to get the full grid, then add a column
    const addRowBtn = page.getByTestId("db-table-add-row");
    await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
    await addRowBtn.click();
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // Add a text column
    await addColumnViaTypePicker(page, "Text");

    // Verify the column exists and its menu trigger is attached
    const propertyHeader = page
      .locator('[role="columnheader"]', { hasText: /^text$/i })
      .first();
    await expect(propertyHeader).toBeVisible({ timeout: 5_000 });
    const menuTrigger = propertyHeader.locator('[aria-label$="column menu"]');
    await expect(menuTrigger).toBeAttached({ timeout: 5_000 });

    // Open the column header menu and click "Delete property"
    await openColumnMenu(page, propertyHeader);
    const deleteItem = page.getByRole("menuitem", { name: "Delete property" });
    await expect(deleteItem).toBeVisible({ timeout: 5_000 });
    await deleteItem.click();

    // Column is optimistically removed — no confirmation dialog
    const deletedHeader = page.locator('[role="columnheader"]', {
      hasText: /^text$/i,
    });
    await expect(deletedHeader).not.toBeVisible({ timeout: 5_000 });

    // An undo toast should appear
    const undoToast = page.locator('[data-sonner-toast]', { hasText: /Column .* deleted/ });
    await expect(undoToast).toBeVisible({ timeout: 5_000 });

    // Wait for the toast to dismiss and deletion to persist
    await expect(undoToast).not.toBeVisible({ timeout: 12_000 });

    // Reload and verify the column is still gone (persisted)
    await page.reload();
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 15_000,
    });
    const deletedHeaderAfterReload = page.locator('[role="columnheader"]', {
      hasText: /^text$/i,
    });
    await expect(deletedHeaderAfterReload).not.toBeVisible({ timeout: 5_000 });
  });

  test("user can undo column deletion via toast", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a row to get the full grid, then add a column
    const addRowBtn = page.locator("button", { hasText: "+ New" });
    await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
    await addRowBtn.click();
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // Add a text column
    await addColumnViaTypePicker(page, "Text");

    // Verify the column exists
    const propertyHeader = page
      .locator('[role="columnheader"]', { hasText: /^text$/i })
      .first();
    await expect(propertyHeader).toBeVisible({ timeout: 5_000 });

    // Open the column header menu and click "Delete property"
    await openColumnMenu(page, propertyHeader);
    const deleteItem = page.getByRole("menuitem", { name: "Delete property" });
    await expect(deleteItem).toBeVisible({ timeout: 5_000 });
    await deleteItem.click();

    // Column is optimistically removed
    await expect(
      page.locator('[role="columnheader"]', { hasText: /^text$/i }),
    ).not.toBeVisible({ timeout: 5_000 });

    // Click the Undo button in the toast
    const undoBtn = page.locator('[data-sonner-toast]', { hasText: /Column .* deleted/ })
      .getByRole("button", { name: "Undo" });
    await expect(undoBtn).toBeVisible({ timeout: 5_000 });
    await undoBtn.click();

    // Column should be restored
    const restoredHeader = page
      .locator('[role="columnheader"]', { hasText: /^text$/i })
      .first();
    await expect(restoredHeader).toBeVisible({ timeout: 5_000 });
  });

  test("Title property (position 0) does not show delete option", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a row to get the full grid
    const addRowBtn = page.getByTestId("db-table-add-row");
    await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
    await addRowBtn.click();
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // The Title property is at position 0 — find its column header.
    // It's the first property column header after the hardcoded "Title" header.
    // The Title property is named "Title" and rendered as a columnheader with
    // a dropdown menu. But the hardcoded Title column doesn't have a menu.
    // We need to find the property column header named "Title" (position 0).
    const titlePropertyHeaders = page.locator('[role="columnheader"]').filter({
      has: page.locator('[aria-label$="column menu"]'),
    });

    // If there's a Title property column with a menu, open it and verify
    // there's no "Delete property" option
    const count = await titlePropertyHeaders.count();
    if (count > 0) {
      const firstMenuHeader = titlePropertyHeaders.first();
      await openColumnMenu(page, firstMenuHeader);

      // "Rename property" should be visible
      const renameItem = page.getByRole("menuitem", { name: "Rename property" });
      await expect(renameItem).toBeVisible({ timeout: 5_000 });

      // "Delete property" should NOT be visible for the Title property
      const deleteItem = page.getByRole("menuitem", { name: "Delete property" });
      await expect(deleteItem).not.toBeVisible({ timeout: 2_000 });

      // Close the menu by pressing Escape
      await page.keyboard.press("Escape");
    }
  });

  test("database page shows grid icon in sidebar", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    const sidebar = page.getByRole("complementary");

    // The sidebar tree should have loaded with the new database page.
    // Database pages render a Table2 SVG icon (class "lucide-table-2")
    // instead of the FileText SVG icon used for regular pages.
    const treeItems = sidebar.locator('[role="treeitem"]');
    await expect(treeItems.first()).toBeVisible({ timeout: 10_000 });

    // lucide-react adds class "lucide-table-2" to the Table2 SVG.
    // Check that at least one tree item contains this icon.
    const gridIconItems = treeItems.filter({
      has: page.locator("svg.lucide-table-2"),
    });
    const gridCount = await gridIconItems.count();
    expect(gridCount).toBeGreaterThan(0);
  });
});
