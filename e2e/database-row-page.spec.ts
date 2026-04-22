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

// Track database page IDs created during tests for cleanup
const createdDatabaseIds: string[] = [];

test.afterAll(async () => {
  if (createdDatabaseIds.length === 0) return;
  const admin = getAdminClient();
  for (const id of createdDatabaseIds) {
    // Hard-delete child pages (rows) first, then the database page
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

/**
 * Create a new database via the sidebar, add a row, and return the database
 * page ID. Reuses the pattern from database-crud.spec.ts.
 */
async function createDatabaseWithRow(
  page: import("@playwright/test").Page,
): Promise<string> {
  const sidebar = await waitForSidebarTree(page);

  const newDbBtn = sidebar.getByRole("button", { name: /new database/i });
  await expect(newDbBtn).toBeVisible({ timeout: 5_000 });
  await newDbBtn.click();

  // Wait for navigation to the database page
  await page.waitForURL(
    (url) => url.pathname.split("/").filter(Boolean).length >= 2,
    { timeout: 15_000 },
  );

  // Wait for the database view to load
  const dbLoaded = page
    .locator('[role="grid"], :text("No rows yet")')
    .first();
  await expect(dbLoaded).toBeVisible({ timeout: 15_000 });

  // Extract page ID from URL
  const pathParts = new URL(page.url()).pathname.split("/").filter(Boolean);
  const pageId = pathParts[pathParts.length - 1];
  createdDatabaseIds.push(pageId);

  // Add a row
  const addRowBtn = page.locator("button", { hasText: "+ New" });
  await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
  await addRowBtn.click();

  // Wait for the grid to appear with the new row
  await expect(page.locator('[role="grid"]')).toBeVisible({
    timeout: 10_000,
  });

  return pageId;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Database Row Page", () => {
  test("click a row in table view to open it as a full page", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseWithRow(page);
    const dbUrl = page.url();

    // Click the row title link to navigate to the row page
    const rowLink = page.locator('[role="gridcell"] a').first();
    await expect(rowLink).toBeVisible({ timeout: 5_000 });
    await rowLink.click();

    // Should navigate to a different URL (the row page)
    await page.waitForURL((url) => url.href !== dbUrl, { timeout: 15_000 });

    // The row page should show the Lexical editor
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 15_000 });
  });

  test("row page shows properties header with editable fields", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseWithRow(page);

    // Add a text property column so the row page has a property to display.
    // Select "Text" from the PropertyTypePicker dropdown to dismiss the overlay.
    const addColumnBtn = page.locator('button[aria-label="Add column"]');
    await expect(addColumnBtn).toBeVisible({ timeout: 5_000 });
    await addColumnBtn.click();

    const textMenuItem = page.getByRole("menuitem", { name: "Text" });
    await expect(textMenuItem).toBeVisible({ timeout: 5_000 });
    await textMenuItem.click();
    await page.waitForTimeout(1_500);

    // Navigate to the row page
    const rowLink = page.locator('[role="gridcell"] a').first();
    await expect(rowLink).toBeVisible({ timeout: 5_000 });
    await rowLink.click();

    // Wait for the row page to load
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 15_000 });

    // The properties header should be visible with the property name label.
    // Properties are rendered as rows with a label (w-32 text-right) and a value cell.
    // The added column is named "Property N" by default.
    const propertyLabel = page.locator("text=/Property \\d+/i").first();
    await expect(propertyLabel).toBeVisible({ timeout: 10_000 });

    // The value cell should show "Empty" since no value has been set
    const emptyValue = page.locator("text=Empty").first();
    await expect(emptyValue).toBeVisible({ timeout: 5_000 });
  });

  test("edit a select property value from the row page properties header", async ({
    authenticatedPage: page,
  }) => {
    const dbPageId = await createDatabaseWithRow(page);

    // Create a select property directly via admin client so the config
    // (including options) is persisted before we navigate to the row page.
    const admin = getAdminClient();

    const selectOptions = [
      { id: crypto.randomUUID(), name: "To Do", color: "gray" },
      { id: crypto.randomUUID(), name: "In Progress", color: "blue" },
      { id: crypto.randomUUID(), name: "Done", color: "green" },
    ];

    // Get the next position for the new property
    const { data: existingProps } = await admin
      .from("database_properties")
      .select("position")
      .eq("database_id", dbPageId)
      .order("position", { ascending: false })
      .limit(1);

    const nextPosition = (existingProps?.[0]?.position ?? -1) + 1;

    await admin.from("database_properties").insert({
      database_id: dbPageId,
      name: "Status",
      type: "select",
      config: { options: selectOptions },
      position: nextPosition,
    });

    // Navigate to the row page — the server will load the select property
    // with its full config including options.
    const rowLink = page.locator('[role="gridcell"] a').first();
    await expect(rowLink).toBeVisible({ timeout: 5_000 });
    await rowLink.click();

    // Wait for the row page to load
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 15_000 });

    // The properties header should show the "Status" label
    await expect(page.locator("text=Status").first()).toBeVisible({
      timeout: 10_000,
    });

    // Click the "Empty" value next to "Status" to open the select editor.
    // Target the value cell in the same row as the "Status" label.
    const statusRow = page.locator("div.flex.items-start.gap-4", {
      hasText: "Status",
    });
    const emptyValue = statusRow.locator("text=Empty");
    await expect(emptyValue).toBeVisible({ timeout: 5_000 });
    await emptyValue.click();

    // The select dropdown should appear with a search input and options
    const dropdownContainer = page.locator(
      ".rounded-sm.border.border-border.bg-background",
    );
    await expect(dropdownContainer).toBeVisible({ timeout: 5_000 });

    // Click "In Progress" to select it
    const inProgressOption = dropdownContainer.locator("text=In Progress");
    await expect(inProgressOption).toBeVisible({ timeout: 5_000 });
    await inProgressOption.click();

    // The dropdown should close and the selected value should be displayed
    // as a badge with the option name
    const badge = statusRow.locator("text=In Progress");
    await expect(badge).toBeVisible({ timeout: 5_000 });
  });

  test("edit the row page content using the Lexical editor", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseWithRow(page);

    // Navigate to the row page
    const rowLink = page.locator('[role="gridcell"] a').first();
    await expect(rowLink).toBeVisible({ timeout: 5_000 });
    await rowLink.click();

    // Wait for the editor to load
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 15_000 });

    // Type content into the editor
    await editor.click();
    await page.keyboard.type("Hello from the row page");

    // Wait for auto-save
    await page.waitForTimeout(2_000);

    // Verify the content is visible in the editor
    await expect(editor).toContainText("Hello from the row page");

    // Reload the page to verify persistence
    await page.reload();
    const reloadedEditor = page.locator('[contenteditable="true"]');
    await expect(reloadedEditor).toBeVisible({ timeout: 15_000 });
    await expect(reloadedEditor).toContainText("Hello from the row page");
  });

  test("breadcrumb shows workspace → database → row", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseWithRow(page);

    // Navigate to the row page
    const rowLink = page.locator('[role="gridcell"] a').first();
    await expect(rowLink).toBeVisible({ timeout: 5_000 });
    await rowLink.click();

    // Wait for the row page to load
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 15_000 });

    // The breadcrumb nav should be visible
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).toBeVisible({ timeout: 10_000 });

    // The breadcrumb should contain the database name ("Untitled Database")
    await expect(breadcrumb).toContainText("Untitled Database");

    // The breadcrumb should contain the row title ("Untitled")
    // There should be at least 3 segments: workspace, database, row
    const segments = breadcrumb.locator("span.flex");
    const segmentCount = await segments.count();
    expect(segmentCount).toBeGreaterThanOrEqual(3);

    // The database segment should be a clickable link
    const dbLink = breadcrumb.locator('a:has-text("Untitled Database")');
    await expect(dbLink).toBeVisible({ timeout: 5_000 });
  });

  test("navigate back to the database from the row page", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseWithRow(page);
    const dbUrl = page.url();

    // Navigate to the row page
    const rowLink = page.locator('[role="gridcell"] a').first();
    await expect(rowLink).toBeVisible({ timeout: 5_000 });
    await rowLink.click();

    // Wait for the row page to load
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 15_000 });

    // Click the database link in the breadcrumb to navigate back
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).toBeVisible({ timeout: 10_000 });

    const dbLink = breadcrumb.locator('a:has-text("Untitled Database")');
    await expect(dbLink).toBeVisible({ timeout: 5_000 });
    await dbLink.click();

    // Should navigate back to the database page
    await page.waitForURL((url) => url.href === dbUrl, { timeout: 15_000 });

    // The database grid should be visible again
    const grid = page.locator('[role="grid"]');
    await expect(grid).toBeVisible({ timeout: 15_000 });
  });
});
