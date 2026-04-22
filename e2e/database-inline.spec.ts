import { test, expect } from "./fixtures/auth";
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

// Multi-step tests: create database → navigate → slash command → picker.
test.setTimeout(90_000);

// ---------------------------------------------------------------------------
// Admin client for setup and cleanup
// ---------------------------------------------------------------------------

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Track page IDs created during tests for cleanup
const createdPageIds: string[] = [];

test.afterAll(async () => {
  if (createdPageIds.length === 0) return;
  const admin = getAdminClient();
  for (const id of createdPageIds) {
    await admin.from("pages").delete().eq("parent_id", id);
    await admin.from("pages").delete().eq("id", id);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForSidebarTree(page: Page) {
  const sidebar = page.getByRole("complementary");
  const treeLoaded = sidebar
    .locator('[role="treeitem"], :text("No pages yet")')
    .first();
  await expect(treeLoaded).toBeVisible({ timeout: 15_000 });
  return sidebar;
}

/**
 * Create a database via the sidebar and return its page ID.
 */
async function createDatabaseFromSidebar(page: Page): Promise<string> {
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
  createdPageIds.push(pageId);
  return pageId;
}

/**
 * Add a row to the current database.
 */
async function addRowToDatabase(page: Page) {
  const addRowBtn = page.locator("button", { hasText: "+ New" });
  await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
  await addRowBtn.click();
  await expect(page.locator('[role="grid"]')).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * Navigate to a new page via the sidebar. Returns the page ID.
 */
async function navigateToNewPage(page: Page): Promise<string> {
  const sidebar = await waitForSidebarTree(page);

  const newPageBtn = sidebar.getByRole("button", { name: /new page/i });
  await expect(newPageBtn).toBeVisible({ timeout: 5_000 });
  await newPageBtn.click();

  const editor = page.locator('[contenteditable="true"]');
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const visible = await editor
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (visible) break;

    const is404 = await page
      .getByText("This page could not be found")
      .isVisible()
      .catch(() => false);
    if (is404 && attempt < maxRetries) {
      await page.reload({ waitUntil: "domcontentloaded" });
      continue;
    }

    throw new Error(
      `navigateToNewPage: editor not visible after ${attempt + 1} attempt(s)`,
    );
  }

  await expect(editor).toBeVisible({ timeout: 10_000 });

  const pathParts = new URL(page.url()).pathname.split("/").filter(Boolean);
  const pageId = pathParts[pathParts.length - 1];
  createdPageIds.push(pageId);
  return pageId;
}

/**
 * Open the slash command menu and select the "Database" option.
 */
async function openDatabaseSlashCommand(page: Page) {
  const editor = page.locator('[contenteditable="true"]');
  await expect(editor).toBeVisible({ timeout: 10_000 });

  await editor.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");

  const options = page.locator('[role="option"]');
  await expect(options.first()).toBeVisible({ timeout: 5_000 });

  await page.keyboard.type("database");

  const dbOption = page
    .locator('[role="option"]')
    .filter({
      has: page.locator("span.font-medium", { hasText: /^Database$/ }),
    });
  await expect(dbOption).toBeVisible({ timeout: 3_000 });
  await dbOption.click();
}

/**
 * Select a database from the picker by its unique name.
 */
async function selectDatabaseFromPicker(page: Page, name: string | RegExp) {
  const searchInput = page.locator('input[aria-label="Search databases"]');
  await expect(searchInput).toBeVisible({ timeout: 5_000 });

  // Type the name to filter results and avoid picking a stale database
  if (typeof name === "string") {
    await searchInput.fill(name);
  }

  const dbOption = page
    .locator('[role="option"]')
    .filter({ hasText: name });
  await expect(dbOption.first()).toBeVisible({ timeout: 5_000 });
  await dbOption.first().click();
}

/**
 * Full flow: open slash command, select database, wait for inline block.
 */
async function insertInlineDatabaseBlock(page: Page, dbName: string | RegExp) {
  await openDatabaseSlashCommand(page);
  await selectDatabaseFromPicker(page, dbName);

  const inlineDb = page.locator(".editor-database");
  await expect(inlineDb).toBeVisible({ timeout: 15_000 });
  return inlineDb;
}

// ---------------------------------------------------------------------------
// Tests — serial to avoid cleanup races (databases are shared workspace state)
// ---------------------------------------------------------------------------

test.describe("Inline DatabaseNode", () => {
  test.describe.configure({ mode: "serial" });

  // Unique database name to avoid picking stale databases from other test runs
  const uniqueDbName = `InlineDB-${Date.now()}`;
  let databaseId: string;

  test.beforeAll(async () => {
    // Rename the database via admin client after creating it in the first test.
    // We can't create via sidebar in beforeAll without a full browser session,
    // so we'll create + rename in the first test instead.
  });

  test("insert a database block via /database slash command", async ({
    authenticatedPage: page,
  }) => {
    // Create a database from the sidebar
    databaseId = await createDatabaseFromSidebar(page);

    // Add a row so the compact view test has data
    await addRowToDatabase(page);

    // Rename via admin client to a unique name
    const admin = getAdminClient();
    await admin
      .from("pages")
      .update({ title: uniqueDbName })
      .eq("id", databaseId);

    // Navigate to a fresh editor page
    await navigateToNewPage(page);

    // Use /database slash command and select our uniquely-named database
    const inlineDb = await insertInlineDatabaseBlock(page, uniqueDbName);

    // The database title link should be visible
    const titleLink = inlineDb.locator("a", { hasText: uniqueDbName });
    await expect(titleLink).toBeVisible({ timeout: 5_000 });
  });

  test("inline database renders a compact view with data", async ({
    authenticatedPage: page,
  }) => {
    await navigateToNewPage(page);

    const inlineDb = await insertInlineDatabaseBlock(page, uniqueDbName);

    // The compact table should have a header row with "TITLE" column
    const titleHeader = inlineDb
      .locator("th")
      .filter({ hasText: /title/i })
      .first();
    await expect(titleHeader).toBeVisible({ timeout: 5_000 });

    // The table body should have at least one row (added in first test)
    const tableRows = inlineDb.locator("tbody tr");
    await expect(tableRows.first()).toBeVisible({ timeout: 5_000 });
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  test("click expand button to navigate to full database page", async ({
    authenticatedPage: page,
  }) => {
    await navigateToNewPage(page);
    const editorUrl = page.url();

    const inlineDb = await insertInlineDatabaseBlock(page, uniqueDbName);

    const expandBtn = inlineDb.locator(
      'button[aria-label="Open full database"]',
    );
    await expect(expandBtn).toBeVisible({ timeout: 5_000 });
    await expandBtn.click();

    // Should navigate away from the editor page
    await expect(async () => {
      expect(page.url()).not.toBe(editorUrl);
    }).toPass({ timeout: 15_000 });

    // The full database view should load
    const dbView = page
      .locator('[role="grid"], :text("No rows yet")')
      .first();
    await expect(dbView).toBeVisible({ timeout: 15_000 });
  });

  test("inline database block persists after page reload", async ({
    authenticatedPage: page,
  }) => {
    await navigateToNewPage(page);

    await insertInlineDatabaseBlock(page, uniqueDbName);

    // Wait for auto-save
    await page.waitForTimeout(3_000);

    await page.reload({ waitUntil: "domcontentloaded" });

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 15_000 });

    // The inline database block should persist
    const inlineDbAfterReload = page.locator(".editor-database");
    await expect(inlineDbAfterReload).toBeVisible({ timeout: 15_000 });

    const titleLink = inlineDbAfterReload.locator("a", {
      hasText: uniqueDbName,
    });
    await expect(titleLink).toBeVisible({ timeout: 10_000 });
  });
});
