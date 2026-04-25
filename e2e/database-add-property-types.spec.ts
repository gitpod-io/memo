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
    // Delete row_values for child rows
    const { data: rows } = await admin
      .from("pages")
      .select("id")
      .eq("parent_id", id);
    if (rows) {
      for (const row of rows) {
        await admin.from("row_values").delete().eq("row_id", row.id);
      }
    }
    // Delete child pages (rows), then the database page
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

  // Use exact match to avoid "Select" matching "Multi-select"
  const menuItem = page.getByRole("menuitem", { name: typeName, exact: true });
  await expect(menuItem).toBeVisible({ timeout: 5_000 });
  await menuItem.click();

  await expect(menuItem).not.toBeVisible({ timeout: 5_000 });
}

/**
 * Click the last property cell in the first data row.
 * The newly added column is always the last property column.
 * Property cells have data-col attributes; we find the highest col index.
 */
async function clickLastPropertyCell(
  page: import("@playwright/test").Page,
) {
  // All property cells in the grid have [data-col]. The last one per row
  // is the newly added column.
  const propertyCells = page.locator(
    '[role="gridcell"][data-col]',
  );
  await expect(propertyCells.first()).toBeVisible({ timeout: 5_000 });
  const count = await propertyCells.count();
  // Click the last property cell (the newly added column)
  await propertyCells.nth(count - 1).click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Database: add each property type", () => {
  test("add a Text column and edit a cell", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRowAndWaitForGrid(page);
    await addColumnViaTypePicker(page, "Text");

    // Verify column header
    const headers = page.locator('[role="columnheader"]', {
      hasText: /^text$/i,
    });
    await expect(headers.first()).toBeVisible({ timeout: 5_000 });

    // Click the last property cell (the newly added Text column)
    await clickLastPropertyCell(page);
    const input = page.locator(
      '[role="gridcell"] input[type="text"]',
    );
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill("Hello World");
    await input.blur();

    // Verify persisted value
    const cell = page.locator('[role="gridcell"]', {
      hasText: "Hello World",
    });
    await expect(cell.first()).toBeVisible({ timeout: 5_000 });
  });

  test("add a Number column and edit a cell", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRowAndWaitForGrid(page);
    await addColumnViaTypePicker(page, "Number");

    const header = page.locator('[role="columnheader"]', {
      hasText: /^number$/i,
    });
    await expect(header.first()).toBeVisible({ timeout: 5_000 });

    await clickLastPropertyCell(page);
    const input = page.locator(
      '[role="gridcell"] input[type="number"]',
    );
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill("42");
    await input.blur();

    // Number renderer shows formatted value
    const cell = page.locator('[role="gridcell"]', { hasText: "42" });
    await expect(cell.first()).toBeVisible({ timeout: 5_000 });
  });

  test("add a Select column and edit a cell", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRowAndWaitForGrid(page);
    await addColumnViaTypePicker(page, "Select");

    const header = page.locator('[role="columnheader"]', {
      hasText: /^select$/i,
    });
    await expect(header.first()).toBeVisible({ timeout: 5_000 });

    // Click the last property cell to open the select dropdown editor
    await clickLastPropertyCell(page);

    // The SelectDropdown renders a search input with placeholder "Search or create…"
    const searchInput = page.locator('input[placeholder="Search or create…"]');
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Type a new option name and click Create
    await searchInput.fill("High");
    const createBtn = page.locator("button", { hasText: "Create" });
    await expect(createBtn).toBeVisible({ timeout: 3_000 });
    await createBtn.click();

    // The dropdown closes for single-select after creation.
    // Verify the badge appears in the cell.
    const badge = page.locator('[role="gridcell"]', { hasText: "High" });
    await expect(badge.first()).toBeVisible({ timeout: 5_000 });
  });

  test("add a Multi-select column and edit a cell", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRowAndWaitForGrid(page);
    await addColumnViaTypePicker(page, "Multi-select");

    const header = page.locator('[role="columnheader"]', {
      hasText: /^multi-select$/i,
    });
    await expect(header.first()).toBeVisible({ timeout: 5_000 });

    // Click the last property cell to open the multi-select dropdown editor
    await clickLastPropertyCell(page);

    const searchInput = page.locator('input[placeholder="Search or create…"]');
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Create first option — the table view commits each change immediately,
    // which closes the editor after creation.
    await searchInput.fill("TagA");
    const createBtn = page.locator("button", { hasText: "Create" });
    await expect(createBtn).toBeVisible({ timeout: 3_000 });
    await createBtn.click();

    // Verify first badge appears
    const cellWithTagA = page.locator('[role="gridcell"]', {
      hasText: "TagA",
    });
    await expect(cellWithTagA.first()).toBeVisible({ timeout: 5_000 });

    // Reopen the editor to add a second option
    await clickLastPropertyCell(page);
    const searchInput2 = page.locator('input[placeholder="Search or create…"]');
    await expect(searchInput2).toBeVisible({ timeout: 5_000 });

    await searchInput2.fill("TagB");
    const createBtn2 = page.locator("button", { hasText: "Create" });
    await expect(createBtn2).toBeVisible({ timeout: 3_000 });
    await createBtn2.click();

    // Verify both badges appear
    await expect(cellWithTagA.first()).toBeVisible({ timeout: 5_000 });
    const cellWithTagB = page.locator('[role="gridcell"]', {
      hasText: "TagB",
    });
    await expect(cellWithTagB.first()).toBeVisible({ timeout: 5_000 });
  });

  test("add a Checkbox column and toggle it", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRowAndWaitForGrid(page);
    await addColumnViaTypePicker(page, "Checkbox");

    const header = page.locator('[role="columnheader"]', {
      hasText: /^checkbox$/i,
    });
    await expect(header.first()).toBeVisible({ timeout: 5_000 });

    // Checkbox cells render a button with aria-label "Check" or "Uncheck"
    const checkBtn = page.locator(
      '[role="gridcell"] button[aria-label="Check"]',
    );
    await expect(checkBtn.first()).toBeVisible({ timeout: 5_000 });
    await checkBtn.first().click();

    // After toggling, the button label changes to "Uncheck"
    const uncheckBtn = page.locator(
      '[role="gridcell"] button[aria-label="Uncheck"]',
    );
    await expect(uncheckBtn.first()).toBeVisible({ timeout: 5_000 });
  });

  test("add a Date column and edit a cell", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRowAndWaitForGrid(page);
    await addColumnViaTypePicker(page, "Date");

    const header = page.locator('[role="columnheader"]', {
      hasText: /^date$/i,
    });
    await expect(header.first()).toBeVisible({ timeout: 5_000 });

    // Click the last property cell to open the date picker
    await clickLastPropertyCell(page);

    // The DatePicker renders a "Today" button
    const todayBtn = page.getByRole("button", { name: "Today" });
    await expect(todayBtn).toBeVisible({ timeout: 5_000 });
    await todayBtn.click();

    // Verify a date string appears in the cell (e.g., "Apr 25, 2026")
    // Match the pattern: 3-letter month, space, 1-2 digit day, comma, space, 4-digit year
    const dateCell = page.locator('[role="gridcell"]').filter({
      hasText: /[A-Z][a-z]{2} \d{1,2}, \d{4}/,
    });
    await expect(dateCell.first()).toBeVisible({ timeout: 5_000 });
  });

  test("add a URL column and edit a cell", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRowAndWaitForGrid(page);
    await addColumnViaTypePicker(page, "URL");

    const header = page.locator('[role="columnheader"]', {
      hasText: /^url$/i,
    });
    await expect(header.first()).toBeVisible({ timeout: 5_000 });

    await clickLastPropertyCell(page);
    // The URL cell uses a plain text input (same as text/number/email/phone)
    const input = page.locator('[role="gridcell"] input');
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill("https://example.com");
    await input.blur();

    // URL renderer shows the hostname as a link
    const link = page.locator('[role="gridcell"] a', {
      hasText: "example.com",
    });
    await expect(link.first()).toBeVisible({ timeout: 5_000 });
  });

  test("add an Email column and edit a cell", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRowAndWaitForGrid(page);
    await addColumnViaTypePicker(page, "Email");

    const header = page.locator('[role="columnheader"]', {
      hasText: /^email$/i,
    });
    await expect(header.first()).toBeVisible({ timeout: 5_000 });

    await clickLastPropertyCell(page);
    const input = page.locator('[role="gridcell"] input');
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill("test@example.com");
    await input.blur();

    // Email renderer shows the email as a mailto link
    const link = page.locator('[role="gridcell"] a', {
      hasText: "test@example.com",
    });
    await expect(link.first()).toBeVisible({ timeout: 5_000 });
  });

  test("add a Phone column and edit a cell", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRowAndWaitForGrid(page);
    await addColumnViaTypePicker(page, "Phone");

    const header = page.locator('[role="columnheader"]', {
      hasText: /^phone$/i,
    });
    await expect(header.first()).toBeVisible({ timeout: 5_000 });

    await clickLastPropertyCell(page);
    const input = page.locator('[role="gridcell"] input');
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill("5551234567");
    await input.blur();

    // The table CellRenderer displays the raw phone value.
    // PhoneRenderer formatting is used in row-page detail view, not table cells.
    const cell = page.locator('[role="gridcell"]', {
      hasText: "5551234567",
    });
    await expect(cell.first()).toBeVisible({ timeout: 5_000 });
  });

  test("add a Status column and edit a cell", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRowAndWaitForGrid(page);
    await addColumnViaTypePicker(page, "Status");

    const header = page.locator('[role="columnheader"]', {
      hasText: /^status$/i,
    });
    await expect(header.first()).toBeVisible({ timeout: 5_000 });

    // Click the last property cell to open the status dropdown
    await clickLastPropertyCell(page);

    // The SelectDropdown renders with default status options.
    const searchInput = page.locator('input[placeholder="Search or create…"]');
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Select "In Progress" from the pre-seeded options
    const optionBtn = page.locator("button", { hasText: "In Progress" });
    await expect(optionBtn).toBeVisible({ timeout: 5_000 });
    await optionBtn.click();

    // Verify the badge appears in the cell
    const badge = page.locator('[role="gridcell"]', {
      hasText: "In Progress",
    });
    await expect(badge.first()).toBeVisible({ timeout: 5_000 });
  });
});
