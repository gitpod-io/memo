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

async function addRowAndWaitForGrid(page: import("@playwright/test").Page) {
  const addRowBtn = page.getByTestId("db-table-add-row");
  await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
  await addRowBtn.click();
  await expect(page.locator('[role="grid"]')).toBeVisible({
    timeout: 10_000,
  });
}

async function addColumnViaTypePicker(
  page: import("@playwright/test").Page,
  typeName: string,
) {
  const addColumnBtn = page.locator('button[aria-label="Add column"]');
  await expect(addColumnBtn).toBeVisible({ timeout: 5_000 });
  await addColumnBtn.click();

  const menuItem = page.getByRole("menuitem", { name: typeName, exact: true });
  await expect(menuItem).toBeVisible({ timeout: 5_000 });
  await menuItem.click();

  await expect(menuItem).not.toBeVisible({ timeout: 5_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Database: number format picker", () => {
  test("change number column format via column header menu", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a row and a Number column
    await addRowAndWaitForGrid(page);
    await addColumnViaTypePicker(page, "Number");

    // Find the Number column header by its data-testid. The Number column
    // is the second visible property (after Title), so colIndex=1.
    const numberHeader = page.getByTestId("db-table-column-header-1");
    await expect(numberHeader).toBeVisible({ timeout: 5_000 });

    // Click the last property cell in the row (the Number column)
    const propertyCells = page.locator('[role="gridcell"][data-col]');
    await expect(propertyCells.first()).toBeVisible({ timeout: 5_000 });
    const count = await propertyCells.count();
    await propertyCells.nth(count - 1).click();

    // Fill in a number value
    const input = page.locator('input[type="number"]');
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill("42");
    await input.blur();

    // Number renderer shows formatted value
    const cell = page.locator('[role="gridcell"]', { hasText: "42" });
    await expect(cell.first()).toBeVisible({ timeout: 5_000 });

    // Open column header menu for the number column
    const menuTrigger = numberHeader.getByRole("button", {
      name: /number column menu/i,
    });
    await menuTrigger.click();

    // The format options appear in the dropdown under a "Number format" label
    await expect(page.getByText("Number format")).toBeVisible({
      timeout: 5_000,
    });

    // Select "Currency ($)"
    const currencyOption = page.getByTestId("number-format-currency");
    await expect(currencyOption).toBeVisible({ timeout: 5_000 });
    await currencyOption.click();

    // Verify cell shows currency format with $ prefix
    await expect(
      page.locator('[role="gridcell"]', { hasText: "$42.00" }),
    ).toBeVisible({ timeout: 10_000 });

    // Now change to Percent format
    await menuTrigger.click();
    const percentOption = page.getByTestId("number-format-percent");
    await expect(percentOption).toBeVisible({ timeout: 5_000 });
    await percentOption.click();

    // Verify cell shows percent format with % suffix
    // 42 as percent = 4,200%
    await expect(
      page.locator('[role="gridcell"]', { hasText: "4,200%" }),
    ).toBeVisible({ timeout: 10_000 });

    // Change back to Number format
    await menuTrigger.click();
    const numberOption = page.getByTestId("number-format-number");
    await expect(numberOption).toBeVisible({ timeout: 5_000 });
    await numberOption.click();

    // Verify cell shows plain number format again
    await expect(
      page.locator('[role="gridcell"]', { hasText: "42" }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
