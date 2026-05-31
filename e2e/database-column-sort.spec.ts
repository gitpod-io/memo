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
    const { data: rows } = await admin
      .from("pages")
      .select("id")
      .eq("parent_id", id);
    if (rows) {
      for (const row of rows) {
        await admin.from("row_values").delete().eq("row_id", row.id);
      }
    }
    await admin.from("pages").delete().eq("parent_id", id);
    await admin.from("database_views").delete().eq("database_id", id);
    await admin.from("database_properties").delete().eq("database_id", id);
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

  const newDbBtn = sidebar.getByTestId("sb-new-database-btn");
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
  const addRowBtn = page.getByTestId("db-table-add-row");
  await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
  await addRowBtn.click();
  await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 10_000 });
}

async function addColumn(page: import("@playwright/test").Page) {
  const addColumnBtn = page.locator('button[aria-label="Add column"]');
  await expect(addColumnBtn).toBeVisible({ timeout: 5_000 });
  await addColumnBtn.click();

  const textMenuItem = page.getByRole("menuitem", { name: "Text" });
  await expect(textMenuItem).toBeVisible({ timeout: 5_000 });
  await textMenuItem.click();

  await expect(textMenuItem).not.toBeVisible({ timeout: 5_000 });
}

async function fillCell(
  page: import("@playwright/test").Page,
  cellIndex: number,
  value: string,
) {
  const cell = page.locator('[role="gridcell"][data-col]').nth(cellIndex);
  await cell.click();
  const cellInput = page.locator(
    '[role="gridcell"] input[type="text"], [role="gridcell"] input[type="number"]',
  );
  await expect(cellInput).toBeVisible({ timeout: 5_000 });
  await cellInput.fill(value);
  await page.locator("h1, input[aria-label]").first().click();

  await expect(cellInput).not.toBeVisible({ timeout: 5_000 });
  await expect(cell).toHaveText(value, { timeout: 5_000 });
}

/**
 * Returns the text content of the Text column cells (odd indices) in order.
 */
async function getTextColumnValues(
  page: import("@playwright/test").Page,
  rowCount: number,
): Promise<string[]> {
  const values: string[] = [];
  for (let i = 0; i < rowCount; i++) {
    const cell = page.locator('[role="gridcell"][data-col]').nth(i * 2 + 1);
    const text = await cell.textContent();
    values.push(text?.trim() ?? "");
  }
  return values;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Database: column header sort actions", () => {
  test("sort ascending and descending via column header menu", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a Text column and 3 rows with values
    await addRow(page);
    await addColumn(page);

    for (let i = 0; i < 2; i++) {
      const addRowBtn = page.getByTestId("db-table-add-row");
      await addRowBtn.click();
      await expect(page.locator('[role="row"]')).toHaveCount(i + 3, {
        timeout: 10_000,
      });
    }

    // Fill Text column with values: Cherry, Apple, Banana
    await fillCell(page, 1, "Cherry");
    await fillCell(page, 3, "Apple");
    await fillCell(page, 5, "Banana");

    // Open column header menu for the Text column (colIndex=1)
    const textHeader = page.getByTestId("db-table-column-header-1");
    await expect(textHeader).toBeVisible({ timeout: 5_000 });
    const menuTrigger = textHeader.getByRole("button", {
      name: /text column menu/i,
    });
    await menuTrigger.click();

    // Click "Sort ascending"
    const sortAscItem = page.getByTestId("sort-ascending");
    await expect(sortAscItem).toBeVisible({ timeout: 5_000 });
    await sortAscItem.click();

    // Verify rows reorder: Apple, Banana, Cherry
    await expect(async () => {
      const values = await getTextColumnValues(page, 3);
      expect(values).toEqual(["Apple", "Banana", "Cherry"]);
    }).toPass({ timeout: 10_000 });

    // Open menu again — verify checkmark on ascending
    await menuTrigger.click();
    const sortAscItemAgain = page.getByTestId("sort-ascending");
    await expect(sortAscItemAgain).toBeVisible({ timeout: 5_000 });
    // The ascending item should contain a Check icon (2 SVGs: icon + check)
    await expect(sortAscItemAgain.locator("svg")).toHaveCount(2, {
      timeout: 5_000,
    });
    // The descending item should NOT have a checkmark (only 1 SVG: icon)
    const sortDescItem = page.getByTestId("sort-descending");
    await expect(sortDescItem.locator("svg")).toHaveCount(1, {
      timeout: 5_000,
    });

    // Click "Sort descending"
    await sortDescItem.click();

    // Verify rows reorder: Cherry, Banana, Apple
    await expect(async () => {
      const values = await getTextColumnValues(page, 3);
      expect(values).toEqual(["Cherry", "Banana", "Apple"]);
    }).toPass({ timeout: 10_000 });

    // Open menu again — verify checkmark on descending
    await menuTrigger.click();
    const sortDescItemFinal = page.getByTestId("sort-descending");
    await expect(sortDescItemFinal).toBeVisible({ timeout: 5_000 });
    await expect(sortDescItemFinal.locator("svg")).toHaveCount(2, {
      timeout: 5_000,
    });
    // Ascending should NOT have checkmark
    const sortAscItemFinal = page.getByTestId("sort-ascending");
    await expect(sortAscItemFinal.locator("svg")).toHaveCount(1, {
      timeout: 5_000,
    });
  });

  test("sort toolbar pills update when sort applied from column header", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a Text column and a row
    await addRow(page);
    await addColumn(page);

    // Open column header menu for the Text column and sort ascending
    const textHeader = page.getByTestId("db-table-column-header-1");
    await expect(textHeader).toBeVisible({ timeout: 5_000 });
    const menuTrigger = textHeader.getByRole("button", {
      name: /text column menu/i,
    });
    await menuTrigger.click();

    const sortAscItem = page.getByTestId("sort-ascending");
    await expect(sortAscItem).toBeVisible({ timeout: 5_000 });
    await sortAscItem.click();

    // The sort toolbar button should reflect the active sort
    const sortButton = page.getByTestId("db-sort-button");
    await expect(sortButton).toBeVisible({ timeout: 5_000 });
    await expect(sortButton).toHaveText(/Sort\s*\(1\)/, { timeout: 5_000 });
  });
});
