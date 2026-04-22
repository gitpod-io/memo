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

  await page.waitForTimeout(1_500);
}

// ---------------------------------------------------------------------------
// Tests — verify floating editors are not clipped by table overflow
// ---------------------------------------------------------------------------

test.describe("Table editor portals", () => {
  test("date picker calendar is fully visible when opened in a table cell", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a row so the grid renders
    const addRowBtn = page.locator("button", { hasText: "+ New" });
    await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
    await addRowBtn.click();
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // Add a date column
    await addColumnViaTypePicker(page, "Date");

    // Click the date cell to open the editor
    const dateCells = page.locator('[role="gridcell"]');
    // Find the date column cell — it's the last property cell before the
    // empty add-column cell. We look for the cell in the data row that
    // corresponds to the date column header.
    const dateHeader = page.locator('[role="columnheader"]', {
      hasText: /date/i,
    });
    await expect(dateHeader.first()).toBeVisible({ timeout: 5_000 });

    // The date cell is in the same column position. Click it to open the editor.
    // In the grid layout, cells follow the same column order as headers.
    // The date column is the last property column we added.
    // Find all gridcells in the data row and click the one for the date column.
    const allCells = dateCells.all();
    const cells = await allCells;
    // The grid has: title cell, then property cells, then empty add-column cell.
    // Date is the last property column, so it's the second-to-last cell.
    const dateCell = cells[cells.length - 2];
    await dateCell.click();

    // The date picker calendar should be visible — rendered via portal on document.body
    const calendar = page.locator(".grid-cols-7").first();
    await expect(calendar).toBeVisible({ timeout: 5_000 });

    // Verify the calendar is not clipped: its bounding box should be fully
    // within the viewport (not cut off by the table overflow container).
    const calendarBox = await calendar.boundingBox();
    expect(calendarBox).not.toBeNull();
    if (calendarBox) {
      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();
      if (viewport) {
        // Calendar should be fully visible within the viewport
        expect(calendarBox.x).toBeGreaterThanOrEqual(0);
        expect(calendarBox.y).toBeGreaterThanOrEqual(0);
        expect(calendarBox.x + calendarBox.width).toBeLessThanOrEqual(
          viewport.width + 1,
        );
        expect(calendarBox.y + calendarBox.height).toBeLessThanOrEqual(
          viewport.height + 1,
        );
      }
    }

    // Dismiss with Escape
    await page.keyboard.press("Escape");
    await expect(calendar).not.toBeVisible({ timeout: 3_000 });
  });

  test("select dropdown is fully visible when opened in a table cell", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a row
    const addRowBtn = page.locator("button", { hasText: "+ New" });
    await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
    await addRowBtn.click();
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // Add a select column
    await addColumnViaTypePicker(page, "Select");

    // Click the select cell to open the editor
    const selectHeader = page.locator('[role="columnheader"]', {
      hasText: /select/i,
    });
    await expect(selectHeader.first()).toBeVisible({ timeout: 5_000 });

    const dataCells = page.locator('[role="gridcell"]');
    const cells = await dataCells.all();
    const selectCell = cells[cells.length - 2];
    await selectCell.click();

    // The select dropdown should be visible — rendered via portal
    const dropdown = page.locator(
      ".rounded-sm.border.border-border.bg-background",
    );
    await expect(dropdown).toBeVisible({ timeout: 5_000 });

    // Verify the dropdown is not clipped
    const dropdownBox = await dropdown.boundingBox();
    expect(dropdownBox).not.toBeNull();
    if (dropdownBox) {
      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();
      if (viewport) {
        expect(dropdownBox.x).toBeGreaterThanOrEqual(0);
        expect(dropdownBox.y).toBeGreaterThanOrEqual(0);
        expect(dropdownBox.x + dropdownBox.width).toBeLessThanOrEqual(
          viewport.width + 1,
        );
        expect(dropdownBox.y + dropdownBox.height).toBeLessThanOrEqual(
          viewport.height + 1,
        );
      }
    }

    // Dismiss with Escape
    await page.keyboard.press("Escape");
    await expect(dropdown).not.toBeVisible({ timeout: 3_000 });
  });
});
