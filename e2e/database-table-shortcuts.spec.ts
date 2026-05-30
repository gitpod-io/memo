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

/**
 * Set up a database with the given number of rows.
 * The default database has a single "Title" text property (col 0).
 */
async function setupDatabase(
  page: import("@playwright/test").Page,
  rowCount: number,
) {
  await createDatabaseFromSidebar(page);

  // Add rows
  const addRowBtn = page.getByTestId("db-table-add-row");
  await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
  for (let i = 0; i < rowCount; i++) {
    await addRowBtn.click();
  }

  // Wait for the grid with all rows (header + data rows)
  await expect(page.locator('[role="row"]')).toHaveCount(rowCount + 1, {
    timeout: 10_000,
  });
}

function getCell(
  page: import("@playwright/test").Page,
  row: number,
  col: number,
) {
  return page.locator(`[data-row="${row}"][data-col="${col}"]`);
}

/**
 * Enter focused (non-editing) mode on a cell by clicking it (starts editing)
 * then pressing Escape to exit editing mode.
 */
async function focusCell(
  page: import("@playwright/test").Page,
  row: number,
  col: number,
) {
  const cell = getCell(page, row, col);
  await cell.click();
  await page.keyboard.press("Escape");
  await expect(cell).toBeFocused({ timeout: 3_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const mod = "Control";

test.describe("Database table structural shortcuts", () => {
  test("Ctrl+Enter adds a new row at the bottom", async ({
    authenticatedPage: page,
  }) => {
    await setupDatabase(page, 2);

    // Focus a cell in the first row (col 0 = Title property)
    await focusCell(page, 0, 0);

    // Count rows before shortcut (header + 2 data rows = 3)
    await expect(page.locator('[role="row"]')).toHaveCount(3);

    // Press Ctrl+Enter to add a row at the bottom
    await page.keyboard.press(`${mod}+Enter`);

    // A new row should appear (header + 3 data rows = 4)
    await expect(page.locator('[role="row"]')).toHaveCount(4, {
      timeout: 10_000,
    });
  });

  test("Ctrl+Shift+Enter adds a new row below the focused row", async ({
    authenticatedPage: page,
  }) => {
    await setupDatabase(page, 2);

    // Focus the first row (row 0, col 0)
    await focusCell(page, 0, 0);

    // Press Ctrl+Shift+Enter to add a row below the focused row
    await page.keyboard.press(`${mod}+Shift+Enter`);

    // Should now have 4 rows (header + 3 data rows)
    await expect(page.locator('[role="row"]')).toHaveCount(4, {
      timeout: 10_000,
    });
  });

  test("Delete key on selected rows triggers bulk delete", async ({
    authenticatedPage: page,
  }) => {
    await setupDatabase(page, 2);

    // Wait for rows to be fully persisted (temp IDs replaced with real IDs)
    // by checking that the row link href contains a UUID pattern
    await expect(async () => {
      const firstRowLink = page.locator('[role="row"]').nth(1).locator("a");
      const href = await firstRowLink.getAttribute("href");
      expect(href).toBeTruthy();
      // Real IDs are UUIDs, temp IDs start with "temp-"
      expect(href).not.toContain("temp-");
    }).toPass({ timeout: 10_000 });

    // Select the first row via checkbox
    const checkbox0 = page.getByTestId("db-table-row-checkbox-0");
    await expect(checkbox0).toBeVisible({ timeout: 5_000 });
    await checkbox0.click();

    // Verify the bulk action bar appears
    const bulkBar = page.getByTestId("db-bulk-action-bar");
    await expect(bulkBar).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("db-bulk-selection-count")).toContainText("1 row selected");

    // After clicking the checkbox, focus is on the checkbox which is inside
    // the grid. The keyboard event bubbles up to the grid's onKeyDown.
    await page.keyboard.press("Delete");

    // The confirmation dialog should appear (alertdialog role)
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Confirm the deletion
    const confirmBtn = dialog.getByTestId("db-keyboard-delete-confirm");
    await expect(confirmBtn).toBeVisible({ timeout: 3_000 });
    await confirmBtn.click();

    // The selected row should be removed (header + 1 data row = 2)
    await expect(page.locator('[role="row"]')).toHaveCount(2, {
      timeout: 10_000,
    });
  });

  test("shortcuts do not fire when editing a cell", async ({
    authenticatedPage: page,
  }) => {
    await setupDatabase(page, 1);

    // Click a cell to start editing (col 0 = Title property)
    const cell = getCell(page, 0, 0);
    await cell.click();

    // Verify we're in editing mode — an input or textarea should be visible
    // inside the grid cell
    const cellEditor = page.locator(
      '[role="gridcell"] input, [role="gridcell"] textarea',
    );
    await expect(cellEditor.first()).toBeVisible({ timeout: 5_000 });

    // Count rows before
    const rowsBefore = await page.locator('[role="row"]').count();

    // Press Ctrl+Enter while editing — should NOT add a row
    await page.keyboard.press(`${mod}+Enter`);

    // Wait a moment to ensure no row was added
    await page.waitForTimeout(500);

    // Row count should be unchanged
    const rowsAfter = await page.locator('[role="row"]').count();
    expect(rowsAfter).toBe(rowsBefore);
  });

  test("shortcuts are listed in the keyboard shortcuts dialog", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Open the keyboard shortcuts dialog with "?"
    await page.keyboard.press("?");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Verify the new shortcuts are listed
    await expect(dialog).toContainText("Add new row at bottom");
    await expect(dialog).toContainText("Add new row below focused row");
    await expect(dialog).toContainText("Delete selected rows");
  });
});
