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
    await admin.from("row_values").delete().in(
      "row_id",
      (await admin.from("pages").select("id").eq("parent_id", id)).data?.map(
        (r) => r.id,
      ) ?? [],
    );
    await admin.from("pages").delete().eq("parent_id", id);
    await admin.from("pages").delete().eq("id", id);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Click a context menu item by test ID.
 * @base-ui/react menu items animate on open, making them unstable for
 * Playwright's actionability checks. We poll for the element and click
 * it via evaluate as soon as it appears.
 */
async function clickContextMenuItem(
  page: import("@playwright/test").Page,
  testId: string,
) {
  // Poll until the element exists and click it immediately via JS
  await page.waitForFunction(
    (id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (el) {
        (el as HTMLElement).click();
        return true;
      }
      return false;
    },
    testId,
    { timeout: 5_000 },
  );
}

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Duplicate Row", () => {
  test.setTimeout(120_000);

  test("user can duplicate a row via right-click context menu in table view", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a row
    const addRowBtn = page.getByTestId("db-table-add-row");
    await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
    await addRowBtn.click();

    // Wait for the grid to appear
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // The first row should exist
    const firstRow = page.getByTestId("db-table-row-0");
    await expect(firstRow).toBeVisible({ timeout: 5_000 });

    // Right-click on the row link to open context menu
    const rowLink = firstRow.locator("a").first();
    await expect(rowLink).toBeVisible({ timeout: 5_000 });

    // Open context menu and click Duplicate in one sequence.
    // @base-ui/react's context menu has timing-sensitive mouseup handling,
    // so we dispatch the contextmenu event directly and then click the item.
    await rowLink.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      el.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: rect.x + rect.width / 2,
          clientY: rect.y + rect.height / 2,
          button: 2,
        }),
      );
    });
    await clickContextMenuItem(page, "row-context-duplicate");

    // A success toast should appear
    const successToast = page.locator('[data-sonner-toast]', {
      hasText: "Row duplicated",
    });
    await expect(successToast).toBeVisible({ timeout: 10_000 });

    // A second row should now exist with "(copy)" in the title
    const secondRow = page.getByTestId("db-table-row-1");
    await expect(secondRow).toBeVisible({ timeout: 10_000 });

    // The duplicated row should contain "(copy)" text
    const copyCell = page.getByTestId("db-table-cell-1-title");
    await expect(copyCell).toBeVisible({ timeout: 5_000 });
    await expect(copyCell).toContainText("(copy)");
  });

  test("duplicated row copies cell values from the source row", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a row
    const addRowBtn = page.getByTestId("db-table-add-row");
    await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
    await addRowBtn.click();

    // Wait for the grid
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // Add a text property column
    const addColumnBtn = page.locator('button[aria-label="Add column"]');
    await expect(addColumnBtn).toBeVisible({ timeout: 5_000 });
    await addColumnBtn.click();
    const textMenuItem = page.getByRole("menuitem", { name: "Text" });
    await expect(textMenuItem).toBeVisible({ timeout: 5_000 });
    await textMenuItem.click();
    await expect(textMenuItem).not.toBeVisible({ timeout: 5_000 });

    // Edit the text cell in the first row
    const editableCells = page.locator('[role="gridcell"][data-col]');
    await expect(editableCells.first()).toBeVisible({ timeout: 5_000 });
    await editableCells.first().click();

    const cellInput = page.locator(
      '[role="gridcell"] input[type="text"], [role="gridcell"] input[type="number"]',
    );
    await expect(cellInput).toBeVisible({ timeout: 5_000 });
    await cellInput.fill("Original Value");

    // Blur the cell by clicking the page title area
    await page.locator("h1, input[aria-label]").first().click();

    // Verify the value is saved
    await expect(
      page.locator('[role="gridcell"]', { hasText: "Original Value" }).first(),
    ).toBeVisible({ timeout: 5_000 });

    // Right-click the first row's link to duplicate
    const rowLink = page.getByTestId("db-table-row-0").locator("a").first();
    await rowLink.click({ button: "right" });

    await clickContextMenuItem(page, "row-context-duplicate");

    // Wait for the duplicated row
    const secondRow = page.getByTestId("db-table-row-1");
    await expect(secondRow).toBeVisible({ timeout: 10_000 });

    // The duplicated row should also contain "Original Value"
    // (the text property value was copied)
    const copiedCells = page.locator('[role="gridcell"]', {
      hasText: "Original Value",
    });
    await expect(copiedCells).toHaveCount(2, { timeout: 10_000 });
  });

  test("context menu also shows Delete action", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a row
    const addRowBtn = page.getByTestId("db-table-add-row");
    await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
    await addRowBtn.click();

    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // Right-click on the row link
    const rowLink = page.getByTestId("db-table-row-0").locator("a").first();
    await rowLink.click({ button: "right" });

    // Both Duplicate and Delete should be visible
    const duplicateItem = page.getByTestId("row-context-duplicate");
    const deleteItem = page.getByTestId("row-context-delete");
    await expect(duplicateItem).toBeVisible({ timeout: 5_000 });
    await expect(deleteItem).toBeVisible({ timeout: 5_000 });
  });
});
