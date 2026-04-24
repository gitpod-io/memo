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
  typeName = "Text",
) {
  const addColumnBtn = page.locator('button[aria-label="Add column"]');
  await expect(addColumnBtn).toBeVisible({ timeout: 5_000 });
  await addColumnBtn.click();

  const menuItem = page.getByRole("menuitem", { name: typeName });
  await expect(menuItem).toBeVisible({ timeout: 5_000 });
  await menuItem.click();

  // Wait for the menu to close (column added)
  await expect(menuItem).not.toBeVisible({ timeout: 5_000 });
}

/**
 * Set up a database with 2 rows and 2 property columns (Text + Number).
 */
async function setupGridWith2x2(page: import("@playwright/test").Page) {
  await createDatabaseFromSidebar(page);

  // Add first row
  const addRowBtn = page.getByTestId("db-table-add-row");
  await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
  await addRowBtn.click();

  // Wait for grid
  await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 10_000 });

  // Add second row
  await addRowBtn.click();

  // Wait for the second row to appear
  await expect(page.locator('[role="row"]')).toHaveCount(3, { timeout: 10_000 });

  // Add Text column
  await addColumnViaTypePicker(page, "Text");

  // Add Number column
  await addColumnViaTypePicker(page, "Number");
}

function getCell(page: import("@playwright/test").Page, row: number, col: number) {
  return page.locator(`[data-row="${row}"][data-col="${col}"]`);
}

/**
 * Enter focused (non-editing) mode on a cell by clicking it (starts editing)
 * then pressing Escape (exits editing, enters focused navigation mode).
 */
async function focusCell(page: import("@playwright/test").Page, row: number, col: number) {
  const cell = getCell(page, row, col);
  await cell.click();
  // Click starts editing — press Escape to exit editing and enter focused mode
  await page.keyboard.press("Escape");
  await expect(cell).toBeFocused({ timeout: 3_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Database table keyboard navigation", () => {
  test("arrow keys navigate between cells in focused mode", async ({
    authenticatedPage: page,
  }) => {
    await setupGridWith2x2(page);

    // Enter focused mode on first property cell (row 0, col 0)
    await focusCell(page, 0, 0);

    // Press ArrowDown — should move to row 1, col 0
    await page.keyboard.press("ArrowDown");
    const cellBelow = getCell(page, 1, 0);
    await expect(cellBelow).toBeFocused({ timeout: 3_000 });

    // Press ArrowRight — should move to row 1, col 1
    await page.keyboard.press("ArrowRight");
    const cellRight = getCell(page, 1, 1);
    await expect(cellRight).toBeFocused({ timeout: 3_000 });

    // Press ArrowUp — should move to row 0, col 1
    await page.keyboard.press("ArrowUp");
    const cellAbove = getCell(page, 0, 1);
    await expect(cellAbove).toBeFocused({ timeout: 3_000 });

    // Press ArrowLeft — should move to row 0, col 0
    await page.keyboard.press("ArrowLeft");
    const firstCell = getCell(page, 0, 0);
    await expect(firstCell).toBeFocused({ timeout: 3_000 });
  });

  test("Enter starts editing from focused mode, Escape returns to focused mode", async ({
    authenticatedPage: page,
  }) => {
    await setupGridWith2x2(page);

    // Enter focused mode
    await focusCell(page, 0, 0);

    // Press Enter to start editing
    await page.keyboard.press("Enter");

    // An input should appear
    const cellInput = page.locator(
      '[role="gridcell"] input[type="text"], [role="gridcell"] input[type="number"]',
    );
    await expect(cellInput.first()).toBeVisible({ timeout: 5_000 });

    // Press Escape to exit editing — should return to focused mode on same cell
    await page.keyboard.press("Escape");
    const firstCell = getCell(page, 0, 0);
    await expect(firstCell).toBeFocused({ timeout: 3_000 });

    // The input should no longer be visible
    await expect(cellInput).not.toBeVisible({ timeout: 3_000 });
  });

  test("Enter while editing commits and moves focus down", async ({
    authenticatedPage: page,
  }) => {
    await setupGridWith2x2(page);

    // Enter focused mode then start editing
    await focusCell(page, 0, 0);
    await page.keyboard.press("Enter");

    const cellInput = page.locator(
      '[role="gridcell"] input[type="text"], [role="gridcell"] input[type="number"]',
    );
    await expect(cellInput.first()).toBeVisible({ timeout: 5_000 });

    // Type a value and press Enter to commit
    await cellInput.first().fill("Hello");
    await page.keyboard.press("Enter");

    // Focus should move to the cell below (row 1, col 0)
    const cellBelow = getCell(page, 1, 0);
    await expect(cellBelow).toBeFocused({ timeout: 3_000 });
  });

  test("ArrowRight wraps to next row, ArrowLeft wraps to previous row", async ({
    authenticatedPage: page,
  }) => {
    await setupGridWith2x2(page);

    // Grid has 3 property columns: Title (0), Text (1), Number (2)
    // Focus (0, 0) then navigate right to reach the last column (0, 2)
    await focusCell(page, 0, 0);
    await page.keyboard.press("ArrowRight"); // → (0, 1)
    await page.keyboard.press("ArrowRight"); // → (0, 2)
    const lastColFirstRow = getCell(page, 0, 2);
    await expect(lastColFirstRow).toBeFocused({ timeout: 3_000 });

    // Press ArrowRight — should wrap to first column of next row (row 1, col 0)
    await page.keyboard.press("ArrowRight");
    const firstColSecondRow = getCell(page, 1, 0);
    await expect(firstColSecondRow).toBeFocused({ timeout: 3_000 });

    // Press ArrowLeft — should wrap back to last column of previous row (row 0, col 2)
    await page.keyboard.press("ArrowLeft");
    await expect(lastColFirstRow).toBeFocused({ timeout: 3_000 });
  });

  test("navigation stops at grid boundaries", async ({
    authenticatedPage: page,
  }) => {
    await setupGridWith2x2(page);

    // Grid has 3 property columns: Title (0), Text (1), Number (2)
    // Focus the first cell (row 0, col 0)
    await focusCell(page, 0, 0);

    // Press ArrowUp at top row — should stay on same cell
    await page.keyboard.press("ArrowUp");
    const firstCell = getCell(page, 0, 0);
    await expect(firstCell).toBeFocused({ timeout: 3_000 });

    // Navigate to last cell (row 1, col 2) using arrow keys
    await page.keyboard.press("ArrowDown");  // → (1, 0)
    await page.keyboard.press("ArrowRight"); // → (1, 1)
    await page.keyboard.press("ArrowRight"); // → (1, 2)
    const lastCell = getCell(page, 1, 2);
    await expect(lastCell).toBeFocused({ timeout: 3_000 });

    // Press ArrowDown at bottom row — should stay on same cell
    await page.keyboard.press("ArrowDown");
    await expect(lastCell).toBeFocused({ timeout: 3_000 });

    // Press ArrowRight at last column of last row — should stay (boundary)
    await page.keyboard.press("ArrowRight");
    await expect(lastCell).toBeFocused({ timeout: 3_000 });
  });

  test("Escape from focused mode clears focus", async ({
    authenticatedPage: page,
  }) => {
    await setupGridWith2x2(page);

    // Enter focused mode
    await focusCell(page, 0, 0);
    const firstCell = getCell(page, 0, 0);
    await expect(firstCell).toBeFocused({ timeout: 3_000 });

    // Press Escape — should clear focus
    await page.keyboard.press("Escape");

    // The cell should no longer be focused
    await expect(firstCell).not.toBeFocused({ timeout: 3_000 });
  });
});
