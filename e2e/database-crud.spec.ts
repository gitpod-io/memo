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
    const addRowBtn = page.locator("button", { hasText: "+ New" });
    await expect(addRowBtn).toBeVisible({ timeout: 5_000 });
  });

  test("user can add a text property column to a database", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // The empty state doesn't render the "Add column" button with
    // aria-label. Add a row first so the full grid renders.
    const addRowBtn = page.locator("button", { hasText: "+ New" });
    await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
    await addRowBtn.click();

    // Wait for the grid to appear (row added → non-empty state)
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // Click the "Add column" button (+ icon in the last column header)
    const addColumnBtn = page.locator('button[aria-label="Add column"]');
    await expect(addColumnBtn).toBeVisible({ timeout: 5_000 });
    await addColumnBtn.click();

    // Wait for the new column header to appear
    await page.waitForTimeout(1_500);

    // The new column should contain "Property" in its name
    const newHeader = page.locator('[role="columnheader"]', {
      hasText: /property/i,
    });
    await expect(newHeader.first()).toBeVisible({ timeout: 5_000 });
  });

  test("user can add a row and edit cell values inline in table view", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a row to get the full grid
    const addRowBtn = page.locator("button", { hasText: "+ New" });
    await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
    await addRowBtn.click();

    // Wait for the grid
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // Add a text property column so we have an editable cell
    const addColumnBtn = page.locator('button[aria-label="Add column"]');
    await expect(addColumnBtn).toBeVisible({ timeout: 5_000 });
    await addColumnBtn.click();
    await page.waitForTimeout(1_500);

    // Click on the property cell to start editing.
    // Editable cells have tabindex="0" and cursor-text styling.
    const editableCells = page.locator(
      '[role="gridcell"][tabindex="0"]',
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
    await page.waitForTimeout(1_500);

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
    await page.waitForTimeout(500);

    // Click the delete button
    const deleteBtn = page.locator('button[aria-label="Delete row"]').first();
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
    await deleteBtn.click();

    // Wait for the row to be removed — "No rows yet" should appear
    await expect(page.locator(':text("No rows yet")')).toBeVisible({
      timeout: 10_000,
    });
  });

  test("user can rename a database property (column header)", async ({
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

    const addColumnBtn = page.locator('button[aria-label="Add column"]');
    await expect(addColumnBtn).toBeVisible({ timeout: 5_000 });
    await addColumnBtn.click();
    await page.waitForTimeout(1_500);

    // Set up dialog handler before clicking the header.
    // The rename uses window.prompt — handle it with a dialog listener.
    page.on("dialog", async (dialog) => {
      if (dialog.type() === "prompt") {
        await dialog.accept("Renamed Column");
      }
    });

    // Click the property column header button to trigger rename.
    const propertyHeader = page
      .locator('[role="columnheader"]', { hasText: /property/i })
      .first();
    const headerButton = propertyHeader.locator("button").first();
    await headerButton.click();

    // Wait for the rename to take effect
    await page.waitForTimeout(2_000);

    // The column header should now show the new name
    const renamedHeader = page.locator('[role="columnheader"]', {
      hasText: "Renamed Column",
    });
    await expect(renamedHeader.first()).toBeVisible({ timeout: 5_000 });
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
