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

async function clickLastPropertyCell(page: import("@playwright/test").Page) {
  const propertyCells = page.locator('[role="gridcell"][data-col]');
  await expect(propertyCells.first()).toBeVisible({ timeout: 5_000 });
  const count = await propertyCells.count();
  await propertyCells.nth(count - 1).click();
}

async function openColumnMenu(
  page: import("@playwright/test").Page,
  headerLocator: import("@playwright/test").Locator,
) {
  const menuTrigger = headerLocator.locator('[aria-label$="column menu"]');
  await expect(menuTrigger).toBeAttached({ timeout: 5_000 });
  await headerLocator.hover();
  await menuTrigger.click();
}

/**
 * Select a date format from the column header submenu.
 * Opens the column menu, hovers the "Date format" submenu trigger,
 * and clicks the specified format option.
 */
async function selectDateFormat(
  page: import("@playwright/test").Page,
  headerLocator: import("@playwright/test").Locator,
  formatName: string,
) {
  await openColumnMenu(page, headerLocator);

  // Hover the submenu trigger to open the submenu
  const dateFormatTrigger = page.getByRole("menuitem", { name: "Date format" });
  await expect(dateFormatTrigger).toBeVisible({ timeout: 5_000 });
  await dateFormatTrigger.hover();

  // Wait for submenu to appear and click the format option
  const formatOption = page.getByRole("menuitemradio", { name: new RegExp(formatName) });
  await expect(formatOption).toBeVisible({ timeout: 5_000 });
  await formatOption.click();

  // Dismiss the menu by pressing Escape (radio items may not auto-close the menu)
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // Wait for the menu to fully close
  await expect(dateFormatTrigger).not.toBeVisible({ timeout: 5_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Database date format picker", () => {
  test("change date format via column header menu", async ({
    authenticatedPage: page,
  }) => {
    test.setTimeout(60_000);

    await createDatabaseFromSidebar(page);
    await addRowAndWaitForGrid(page);
    await addColumnViaTypePicker(page, "Date");

    const header = page.locator('[role="columnheader"]', {
      hasText: /^date$/i,
    });
    await expect(header.first()).toBeVisible({ timeout: 5_000 });

    // Wait for the grid to be fully loaded before interacting
    await page.waitForTimeout(1_000);

    // Click the last property cell to open the date picker and set today's date
    await clickLastPropertyCell(page);
    const todayBtn = page.getByRole("button", { name: "Today" });
    await expect(todayBtn).toBeVisible({ timeout: 10_000 });
    await todayBtn.click();

    // Verify the default short format appears (e.g., "May 30, 2026")
    const shortDateCell = page.locator('[role="gridcell"]').filter({
      hasText: /[A-Z][a-z]{2} \d{1,2}, \d{4}/,
    });
    await expect(shortDateCell.first()).toBeVisible({ timeout: 5_000 });

    // Select ISO format
    await selectDateFormat(page, header.first(), "ISO");

    // Verify the cell now shows ISO format (YYYY-MM-DD)
    const isoDateCell = page.locator('[role="gridcell"]').filter({
      hasText: /\d{4}-\d{2}-\d{2}/,
    });
    await expect(isoDateCell.first()).toBeVisible({ timeout: 10_000 });

    // Select Slash format (e.g., "5/30/2026")
    await selectDateFormat(page, header.first(), "Slash");

    // Verify the cell now shows slash format (M/D/YYYY)
    const slashDateCell = page.locator('[role="gridcell"]').filter({
      hasText: /\d{1,2}\/\d{1,2}\/\d{4}/,
    });
    await expect(slashDateCell.first()).toBeVisible({ timeout: 10_000 });
  });
});
