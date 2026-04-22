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

const createdDatabaseIds: string[] = [];

test.afterAll(async () => {
  if (createdDatabaseIds.length === 0) return;
  const admin = getAdminClient();
  for (const id of createdDatabaseIds) {
    await admin.from("pages").delete().eq("parent_id", id);
    await admin.from("pages").delete().eq("id", id);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForSidebarTree(page: import("@playwright/test").Page) {
  const sidebar = page.getByRole("complementary");
  const treeLoaded = sidebar
    .locator('[role="treeitem"], :text("No pages yet")')
    .first();
  await expect(treeLoaded).toBeVisible({ timeout: 15_000 });
  return sidebar;
}

async function createDatabaseFromSidebar(
  page: import("@playwright/test").Page,
): Promise<string> {
  const sidebar = await waitForSidebarTree(page);

  const newDbBtn = sidebar.getByRole("button", { name: /new database/i });
  await expect(newDbBtn).toBeVisible({ timeout: 5_000 });
  await newDbBtn.click();

  await page.waitForURL(
    (url) => url.pathname.split("/").filter(Boolean).length >= 2,
    { timeout: 15_000 },
  );

  const dbLoaded = page
    .locator('[role="grid"], :text("No rows yet")')
    .first();
  await expect(dbLoaded).toBeVisible({ timeout: 15_000 });

  const pathParts = new URL(page.url()).pathname.split("/").filter(Boolean);
  const pageId = pathParts[pathParts.length - 1];
  createdDatabaseIds.push(pageId);
  return pageId;
}

async function addRow(page: import("@playwright/test").Page) {
  const addRowBtn = page.locator("button", { hasText: "+ New" });
  await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
  await addRowBtn.click();
  await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 10_000 });
}

async function addColumn(page: import("@playwright/test").Page) {
  const addColumnBtn = page.locator('button[aria-label="Add column"]');
  await expect(addColumnBtn).toBeVisible({ timeout: 5_000 });
  await addColumnBtn.click();
  await page.waitForTimeout(1_500);
}

/**
 * Fill a cell value. Clicks the cell, fills the input, then blurs.
 */
async function fillCell(
  page: import("@playwright/test").Page,
  cellIndex: number,
  value: string,
) {
  const cell = page.locator('[role="gridcell"][tabindex="0"]').nth(cellIndex);
  await cell.click();
  const cellInput = page.locator(
    '[role="gridcell"] input[type="text"], [role="gridcell"] input[type="number"]',
  );
  await expect(cellInput).toBeVisible({ timeout: 5_000 });
  await cellInput.fill(value);
  await page.locator("h1, input[aria-label]").first().click();
  await page.waitForTimeout(1_000);
}

/**
 * Set up a database with a new property column and N rows with values.
 *
 * The database starts with 1 default property ("Title"). This adds a second
 * property column ("Property 2") and populates it. Each row has 2 editable
 * property cells: [Title, Property 2]. Property 2 cells are at odd indices
 * (1, 3, 5, ...).
 */
async function setupDatabaseWithValues(
  page: import("@playwright/test").Page,
  values: string[],
) {
  await addRow(page);
  await addColumn(page);

  for (let i = 1; i < values.length; i++) {
    const addRowBtn = page.locator("button", { hasText: "+ New" });
    await addRowBtn.click();
    await page.waitForTimeout(1_000);
  }

  // Fill Property 2 column (odd indices: 1, 3, 5, ...)
  for (let i = 0; i < values.length; i++) {
    await fillCell(page, i * 2 + 1, values[i]);
  }
}

/**
 * Get the Property 2 column cell for a given row index.
 */
function prop2Cell(
  page: import("@playwright/test").Page,
  rowIndex: number,
) {
  return page.locator('[role="gridcell"][tabindex="0"]').nth(rowIndex * 2 + 1);
}

/**
 * Add a sort rule for "Property 2" via the Sort menu.
 * Leaves the sort menu open after adding.
 */
async function addSortOnProperty2(page: import("@playwright/test").Page) {
  const sortButton = page.locator("button", { hasText: "Sort" }).first();
  await expect(sortButton).toBeVisible({ timeout: 5_000 });
  await sortButton.click();

  const addSortBtn = page.locator("button", { hasText: "Add sort" });
  await expect(addSortBtn).toBeVisible({ timeout: 5_000 });
  await addSortBtn.click();

  // The property picker is inside the sort menu dropdown (a div with
  // class max-h-48). Pick "Property 2" specifically.
  const sortDropdown = page.locator(".max-h-48");
  await expect(sortDropdown).toBeVisible({ timeout: 5_000 });
  const prop2Option = sortDropdown.locator("button", {
    hasText: "Property 2",
  });
  await expect(prop2Option).toBeVisible({ timeout: 5_000 });
  await prop2Option.click();

  // Wait for sort to apply
  await page.waitForTimeout(2_000);
}

/**
 * Add a filter rule for "Property 2" containing the given value.
 */
async function addFilterOnProperty2(
  page: import("@playwright/test").Page,
  value: string,
) {
  const addFilterBtn = page.locator("button", { hasText: "Add filter" });
  await expect(addFilterBtn).toBeVisible({ timeout: 5_000 });
  await addFilterBtn.click();

  // The filter property picker is an absolute-positioned dropdown (z-50).
  // Pick "Property 2".
  const filterDropdown = page.locator(".z-50").first();
  await expect(filterDropdown).toBeVisible({ timeout: 5_000 });
  const prop2Option = filterDropdown.locator("button", {
    hasText: "Property 2",
  });
  await expect(prop2Option).toBeVisible({ timeout: 5_000 });
  await prop2Option.click();

  // Pick "contains" operator
  const operatorDropdown = page.locator(".z-50").first();
  await expect(operatorDropdown).toBeVisible({ timeout: 5_000 });
  const containsOption = operatorDropdown.locator("button", {
    hasText: "contains",
  });
  await expect(containsOption).toBeVisible({ timeout: 5_000 });
  await containsOption.click();

  // Enter value and apply
  const filterInput = page.locator('input[placeholder="Enter value…"]');
  await expect(filterInput).toBeVisible({ timeout: 5_000 });
  await filterInput.fill(value);

  const applyBtn = page.locator(".z-50 button", { hasText: "Apply" });
  await expect(applyBtn).toBeVisible({ timeout: 5_000 });
  await applyBtn.click();

  await page.waitForTimeout(2_000);
}

/**
 * Close the sort menu by clicking outside it.
 */
async function closeSortMenu(page: import("@playwright/test").Page) {
  await page.locator("h1, input[aria-label]").first().click();
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Database sort, filter, and multi-view management", () => {
  test("add a sort rule and verify row order changes", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await setupDatabaseWithValues(page, ["Cherry", "Apple", "Banana"]);

    // Verify initial order in Property 2 column
    await expect(prop2Cell(page, 0)).toHaveText("Cherry");
    await expect(prop2Cell(page, 1)).toHaveText("Apple");
    await expect(prop2Cell(page, 2)).toHaveText("Banana");

    // Add ascending sort on Property 2
    await addSortOnProperty2(page);
    await closeSortMenu(page);

    // Verify ascending order: Apple, Banana, Cherry
    await expect(prop2Cell(page, 0)).toHaveText("Apple");
    await expect(prop2Cell(page, 1)).toHaveText("Banana");
    await expect(prop2Cell(page, 2)).toHaveText("Cherry");
  });

  test("add a filter and verify rows are filtered", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await setupDatabaseWithValues(page, ["Hello", "World"]);

    // Verify both rows visible
    await expect(prop2Cell(page, 0)).toHaveText("Hello");
    await expect(prop2Cell(page, 1)).toHaveText("World");

    // Add filter: Property 2 contains "Hello"
    await addFilterOnProperty2(page, "Hello");

    // "Hello" row should be visible, "World" row should be hidden
    await expect(
      page.locator('[role="gridcell"]', { hasText: "Hello" }).first(),
    ).toBeVisible();
    await expect(
      page.locator('[role="gridcell"]', { hasText: "World" }),
    ).toBeHidden({ timeout: 5_000 });
  });

  test("remove a filter pill and verify all rows reappear", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await setupDatabaseWithValues(page, ["Foo", "Bar"]);

    // Add filter: Property 2 contains "Foo"
    await addFilterOnProperty2(page, "Foo");

    // Only "Foo" should be visible
    await expect(
      page.locator('[role="gridcell"]', { hasText: "Foo" }).first(),
    ).toBeVisible();
    await expect(
      page.locator('[role="gridcell"]', { hasText: "Bar" }),
    ).toBeHidden({ timeout: 5_000 });

    // Remove the filter pill by clicking the X button on the badge
    const removeFilterBtn = page.locator(
      'button[aria-label*="Remove"][aria-label*="filter"]',
    );
    await expect(removeFilterBtn).toBeVisible({ timeout: 5_000 });
    await removeFilterBtn.click();
    await page.waitForTimeout(2_000);

    // Both rows should reappear
    await expect(
      page.locator('[role="gridcell"]', { hasText: "Foo" }).first(),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('[role="gridcell"]', { hasText: "Bar" }).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("create a second view (list view) and verify independent config", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRow(page);

    // The default view should be a table view — verify the grid is visible
    await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 10_000 });

    // Click the "Add view" button (+ icon next to view tabs)
    const addViewBtn = page.locator('button[aria-label="Add view"]');
    await expect(addViewBtn).toBeVisible({ timeout: 5_000 });
    await addViewBtn.click();

    // Select "List view" from the dropdown
    const listViewOption = page.locator('[role="menuitem"]', {
      hasText: "List view",
    });
    await expect(listViewOption).toBeVisible({ timeout: 5_000 });
    await listViewOption.click();
    await page.waitForTimeout(2_000);

    // The new "List view" tab should be visible
    const listTab = page.locator("button", { hasText: "List view" });
    await expect(listTab).toBeVisible({ timeout: 5_000 });

    // The list view renders rows as links with a FileText icon.
    const listItems = page.locator("a").filter({
      has: page.locator("svg.lucide-file-text"),
    });
    await expect(listItems.first()).toBeVisible({ timeout: 10_000 });

    // The table grid should NOT be visible in list view
    await expect(page.locator('[role="grid"]')).toBeHidden({ timeout: 5_000 });

    // Switch back to the default table view tab
    const tableTab = page.locator("button", { hasText: "Default view" });
    await expect(tableTab).toBeVisible({ timeout: 5_000 });
    await tableTab.click();
    await page.waitForTimeout(1_500);

    // The grid should be visible again
    await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 10_000 });
  });

  test("rename a view via the view tabs", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRow(page);

    // The default view tab should show "Default view"
    const defaultTab = page.locator("button", { hasText: "Default view" });
    await expect(defaultTab).toBeVisible({ timeout: 10_000 });

    // Double-click the tab to enter rename mode
    await defaultTab.dblclick();

    // An inline rename input should appear
    const renameInput = page.locator('input[aria-label="Rename view"]');
    await expect(renameInput).toBeVisible({ timeout: 5_000 });

    // Clear and type a new name
    await renameInput.fill("My Custom View");
    await renameInput.press("Enter");
    await page.waitForTimeout(2_000);

    // The tab should now show the new name
    const renamedTab = page.locator("button", { hasText: "My Custom View" });
    await expect(renamedTab).toBeVisible({ timeout: 5_000 });

    // The old name should no longer be visible
    await expect(
      page.locator("button", { hasText: "Default view" }),
    ).toBeHidden({ timeout: 3_000 });
  });

  test("switch between views and verify each retains its own sort/filter state", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await setupDatabaseWithValues(page, ["Alpha", "Beta"]);

    // Add ascending sort on Property 2, then toggle to descending
    await addSortOnProperty2(page);

    // The sort rule should now show "Asc" — click to toggle to descending.
    // The toggle button has aria-label "Sort ascending" or "Sort descending".
    const toggleBtn = page.locator('button[aria-label="Sort ascending"]');
    await expect(toggleBtn).toBeVisible({ timeout: 5_000 });
    await toggleBtn.click();
    await page.waitForTimeout(1_000);

    await closeSortMenu(page);

    // Verify descending order: Beta, Alpha
    await expect(prop2Cell(page, 0)).toHaveText("Beta");
    await expect(prop2Cell(page, 1)).toHaveText("Alpha");

    // Create a second table view (which should have no sort)
    const addViewBtn = page.locator('button[aria-label="Add view"]');
    await expect(addViewBtn).toBeVisible({ timeout: 5_000 });
    await addViewBtn.click();

    const tableViewOption = page.locator('[role="menuitem"]', {
      hasText: "Table view",
    });
    await expect(tableViewOption).toBeVisible({ timeout: 5_000 });
    await tableViewOption.click();

    // Wait for the new view tab to appear and the grid to load
    const tableViewTab = page.locator("button", { hasText: "Table view" });
    await expect(tableViewTab).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 10_000 });

    // The second view should show rows in original order (no sort): Alpha, Beta
    await expect(prop2Cell(page, 0)).toHaveText("Alpha", { timeout: 10_000 });
    await expect(prop2Cell(page, 1)).toHaveText("Beta", { timeout: 5_000 });

    // The sort button should show no active sorts (no count badge)
    await expect(
      page
        .locator("button", { hasText: "Sort" })
        .first()
        .locator("span", { hasText: "(1)" }),
    ).toBeHidden();

    // Switch back to the first view (Default view)
    const firstViewTab = page.locator("button", { hasText: "Default view" });
    await expect(firstViewTab).toBeVisible({ timeout: 5_000 });
    await firstViewTab.click();

    // Wait for the grid to stabilize with data after view switch
    await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_000);

    // The first view should still have descending sort: Beta, Alpha
    await expect(prop2Cell(page, 0)).toHaveText("Beta", { timeout: 10_000 });
    await expect(prop2Cell(page, 1)).toHaveText("Alpha", { timeout: 5_000 });
  });
});
