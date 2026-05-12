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

async function addRows(page: import("@playwright/test").Page, count: number) {
  for (let i = 0; i < count; i++) {
    const addRowBtn = page.locator('[data-testid="db-table-add-row"]');
    await expect(addRowBtn).toBeVisible({ timeout: 5_000 });
    await addRowBtn.click();
    // Wait for the new row to appear
    await expect(
      page.locator(`[data-testid="db-table-row-${i}"]`),
    ).toBeVisible({ timeout: 5_000 });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Database bulk row selection", () => {
  test("select-all checkbox toggles all rows", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRows(page, 3);

    // The select-all checkbox should be visible
    const selectAll = page.locator('[data-testid="db-table-select-all"]');
    await expect(selectAll).toBeVisible({ timeout: 5_000 });

    // Click select-all
    await selectAll.click();

    // All row checkboxes should be checked
    for (let i = 0; i < 3; i++) {
      const rowCheckbox = page.locator(
        `[data-testid="db-table-row-checkbox-${i}"]`,
      );
      await expect(rowCheckbox).toHaveAttribute("data-checked", "", {
        timeout: 5_000,
      });
    }

    // Bulk action bar should appear
    const actionBar = page.locator('[data-testid="db-bulk-action-bar"]');
    await expect(actionBar).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('[data-testid="db-bulk-selection-count"]'),
    ).toHaveText("3 rows selected");

    // Click select-all again to deselect
    await selectAll.click();

    // Action bar should disappear
    await expect(actionBar).not.toBeVisible({ timeout: 5_000 });
  });

  test("single row checkbox toggles selection", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRows(page, 3);

    // Click the first row's checkbox
    const rowCheckbox0 = page.locator(
      '[data-testid="db-table-row-checkbox-0"]',
    );
    await expect(rowCheckbox0).toBeVisible({ timeout: 5_000 });
    await rowCheckbox0.click();

    // Action bar should show 1 row selected
    const actionBar = page.locator('[data-testid="db-bulk-action-bar"]');
    await expect(actionBar).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('[data-testid="db-bulk-selection-count"]'),
    ).toHaveText("1 row selected");

    // Click a second row's checkbox
    const rowCheckbox1 = page.locator(
      '[data-testid="db-table-row-checkbox-1"]',
    );
    await rowCheckbox1.click();

    await expect(
      page.locator('[data-testid="db-bulk-selection-count"]'),
    ).toHaveText("2 rows selected");

    // Uncheck the first row
    await rowCheckbox0.click();

    await expect(
      page.locator('[data-testid="db-bulk-selection-count"]'),
    ).toHaveText("1 row selected");
  });

  test("Escape clears selection", async ({ authenticatedPage: page }) => {
    await createDatabaseFromSidebar(page);
    await addRows(page, 2);

    // Select a row
    const rowCheckbox = page.locator(
      '[data-testid="db-table-row-checkbox-0"]',
    );
    await rowCheckbox.click();

    const actionBar = page.locator('[data-testid="db-bulk-action-bar"]');
    await expect(actionBar).toBeVisible({ timeout: 5_000 });

    // Press Escape
    await page.keyboard.press("Escape");

    // Action bar should disappear
    await expect(actionBar).not.toBeVisible({ timeout: 5_000 });
  });

  test("shift+click selects a range of rows", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRows(page, 4);

    // Click first row checkbox (no shift)
    const rowCheckbox0 = page.locator(
      '[data-testid="db-table-row-checkbox-0"]',
    );
    await rowCheckbox0.click();

    // Shift+click the third row checkbox
    const rowCheckbox2 = page.locator(
      '[data-testid="db-table-row-checkbox-2"]',
    );
    await rowCheckbox2.click({ modifiers: ["Shift"] });

    // Rows 0, 1, 2 should be selected (3 rows)
    await expect(
      page.locator('[data-testid="db-bulk-selection-count"]'),
    ).toHaveText("3 rows selected");

    // Verify individual checkboxes
    for (let i = 0; i < 3; i++) {
      await expect(
        page.locator(`[data-testid="db-table-row-checkbox-${i}"]`),
      ).toHaveAttribute("data-checked", "", { timeout: 5_000 });
    }

    // Row 3 should NOT be selected
    const rowCheckbox3 = page.locator(
      '[data-testid="db-table-row-checkbox-3"]',
    );
    await expect(rowCheckbox3).not.toHaveAttribute("data-checked", "");
  });

  test("bulk delete shows confirmation dialog and removes row on confirm", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRows(page, 2);

    // Select a single row
    const cb0 = page.locator('[data-testid="db-table-row-checkbox-0"]');
    await expect(cb0).toBeVisible({ timeout: 5_000 });
    await cb0.click();

    await expect(
      page.locator('[data-testid="db-bulk-selection-count"]'),
    ).toHaveText("1 row selected", { timeout: 5_000 });

    // Click the bulk delete button — should open confirmation dialog, not delete
    const deleteBtn = page.locator('[data-testid="db-bulk-delete-button"]');
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
    await deleteBtn.click();

    // Confirmation dialog should appear
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText("Delete 1 row?")).toBeVisible();
    await expect(
      dialog.getByText(
        "This row and its page content will be moved to trash.",
      ),
    ).toBeVisible();

    // The destructive confirm button should be present
    const confirmBtn = page.locator('[data-testid="db-bulk-delete-confirm"]');
    await expect(confirmBtn).toBeVisible();

    // Confirm deletion
    await confirmBtn.click();

    // Dialog should close and row should be removed
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('[data-testid="db-table-row-0"]'),
    ).toBeVisible({ timeout: 5_000 });

    // Undo toast should appear
    const undoToast = page.locator('[data-sonner-toast]', {
      hasText: /1 row.* deleted/,
    });
    await expect(undoToast).toBeVisible({ timeout: 5_000 });
  });

  test("bulk delete confirmation dialog can be cancelled", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRows(page, 2);

    // Wait for the grid to stabilise before interacting with checkboxes
    const row0 = page.locator('[data-testid="db-table-row-0"]');
    await expect(row0).toBeVisible({ timeout: 10_000 });

    // Select the row
    const rowCheckbox = page.locator(
      '[data-testid="db-table-row-checkbox-0"]',
    );
    await expect(rowCheckbox).toBeVisible({ timeout: 5_000 });
    await rowCheckbox.click();

    // Wait for action bar to appear
    const actionBar = page.locator('[data-testid="db-bulk-action-bar"]');
    await expect(actionBar).toBeVisible({ timeout: 10_000 });

    // Click the bulk delete button
    const deleteBtn = page.locator('[data-testid="db-bulk-delete-button"]');
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
    await deleteBtn.click();

    // Confirmation dialog should appear
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Cancel the dialog
    const cancelBtn = page.locator('[data-testid="db-bulk-delete-cancel"]');
    await expect(cancelBtn).toBeVisible({ timeout: 5_000 });
    await cancelBtn.click();

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    // Row should still be present
    await expect(row0).toBeVisible({ timeout: 5_000 });

    // Bulk action bar should still be visible (selection preserved)
    await expect(actionBar).toBeVisible({ timeout: 5_000 });
  });

  test("clear selection button in action bar works", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRows(page, 2);

    // Select a row
    const rowCheckbox = page.locator(
      '[data-testid="db-table-row-checkbox-0"]',
    );
    await rowCheckbox.click();

    const actionBar = page.locator('[data-testid="db-bulk-action-bar"]');
    await expect(actionBar).toBeVisible({ timeout: 5_000 });

    // Click the clear selection button (X)
    const clearBtn = page.locator(
      '[data-testid="db-bulk-clear-selection"]',
    );
    await clearBtn.click();

    // Action bar should disappear
    await expect(actionBar).not.toBeVisible({ timeout: 5_000 });
  });
});
