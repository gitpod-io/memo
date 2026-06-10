import { test, expect } from "./fixtures/auth";
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Baselines are captured in the devcontainer; CI runs on ubuntu-latest.
// Font rendering / antialiasing differences between environments cause small
// pixel diffs. A 3% threshold avoids false positives while still catching
// meaningful layout regressions.
const DEFAULT_THRESHOLD = 0.03;

// ---------------------------------------------------------------------------
// Admin client for test data cleanup
// ---------------------------------------------------------------------------

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Track page IDs created during the test for cleanup
const cleanupPageIds: string[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait for the page to be fully loaded and stable before taking a screenshot.
 * Waits for network idle and gives animations time to settle.
 */
async function waitForPageStable(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  // Allow CSS transitions and animations to settle
  await page.waitForTimeout(500);
}

/**
 * Wait for the sidebar page tree to finish loading.
 */
async function waitForSidebarTree(page: Page): Promise<void> {
  const sidebar = page.getByRole("complementary");
  const treeLoaded = sidebar
    .locator('[role="treeitem"], :text("No pages yet")')
    .first();
  await expect(treeLoaded).toBeVisible({ timeout: 15_000 });
}

/**
 * Create a new page via the sidebar button and type content into the editor.
 * Returns the page ID extracted from the URL.
 */
async function createPageWithContent(page: Page): Promise<string> {
  await waitForSidebarTree(page);

  const sidebar = page.getByRole("complementary");
  const newPageBtn = sidebar.getByTestId("sb-new-page-btn");
  await expect(newPageBtn).toBeVisible({ timeout: 5_000 });
  await newPageBtn.click();

  // Wait for navigation to the new page
  await page.waitForURL(
    (url) => /\/[^/]+\/[0-9a-f-]{36}/.test(url.pathname),
    { timeout: 15_000 },
  );

  // Wait for the Lexical editor to initialize
  const editor = page.locator('[data-lexical-editor="true"]');
  await expect(editor).toBeVisible({ timeout: 15_000 });

  // Set the page title
  const titleInput = page.locator('input[aria-label="Page title"]');
  await expect(titleInput).toBeVisible({ timeout: 5_000 });
  await titleInput.fill("Visual Regression Test Page");
  await page.keyboard.press("Enter");

  // Type content using markdown shortcuts (more reliable than slash commands)
  // Heading: type "# " to trigger heading conversion
  await page.keyboard.type("# Sample Heading");
  await page.keyboard.press("Enter");

  // Paragraph
  await page.keyboard.type(
    "This page contains sample content for visual regression testing.",
  );
  await page.keyboard.press("Enter");

  // Bullet list: type "- " to trigger list conversion
  await page.keyboard.type("- First list item");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second list item");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Third list item");

  // Wait for auto-save to complete
  await page.waitForTimeout(2_000);

  // Extract page ID from URL
  const pathParts = new URL(page.url()).pathname.split("/").filter(Boolean);
  const pageId = pathParts[pathParts.length - 1];
  cleanupPageIds.push(pageId);
  return pageId;
}

/**
 * Create a new database via the sidebar button and add rows.
 * Returns the database page ID extracted from the URL.
 */
async function createDatabaseWithRows(page: Page): Promise<string> {
  await waitForSidebarTree(page);

  const sidebar = page.getByRole("complementary");
  const newDbBtn = sidebar.getByTestId("sb-new-database-btn");
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

  // Add rows via the "+ New" button
  const addRowBtn = page.getByTestId("db-table-add-row");
  await expect(addRowBtn).toBeVisible({ timeout: 10_000 });

  for (let i = 0; i < 3; i++) {
    await addRowBtn.click();
    // Wait for the grid to update
    await page.waitForTimeout(500);
  }

  // Wait for the grid to render all rows
  await expect(page.locator('[role="grid"]')).toBeVisible({
    timeout: 10_000,
  });

  // Wait for auto-save
  await page.waitForTimeout(2_000);

  // Extract page ID from URL
  const pathParts = new URL(page.url()).pathname.split("/").filter(Boolean);
  const pageId = pathParts[pathParts.length - 1];
  cleanupPageIds.push(pageId);
  return pageId;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

test.afterAll(async () => {
  const admin = getAdminClient();
  for (const id of cleanupPageIds) {
    // Delete child pages (database rows) first
    await admin.from("pages").delete().eq("parent_id", id);
    await admin.from("pages").delete().eq("id", id);
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("live app visual regression", () => {
  // All screenshots are taken in a single test to avoid repeated logins
  // which trigger Supabase auth rate limiting.
  test("key app pages match baselines", async ({
    authenticatedPage: page,
  }) => {
    // 1. Workspace home page (before creating test data — captures existing state)
    const sidebar = page.getByRole("complementary");
    await waitForSidebarTree(page);

    // Extract workspace slug from the current URL
    const initialUrl = new URL(page.url());
    const workspaceSlug = initialUrl.pathname.split("/").filter(Boolean)[0];

    // Navigate to workspace home explicitly
    await page.goto(`/${workspaceSlug}`);
    const filterInput = page.getByTestId("wh-filter-input");
    await expect(filterInput).toBeVisible({ timeout: 15_000 });
    await waitForPageStable(page);

    await expect(page).toHaveScreenshot("workspace-home.png", {
      maxDiffPixelRatio: DEFAULT_THRESHOLD,
      fullPage: true,
    });

    // 2. Create a page with content and screenshot the editor
    const testPageId = await createPageWithContent(page);

    // Navigate back to the page to get a clean view (no slash menu artifacts)
    await page.goto(`/${workspaceSlug}/${testPageId}`);
    const editor = page.locator('[data-lexical-editor="true"]');
    await expect(editor).toBeVisible({ timeout: 15_000 });
    await waitForPageStable(page);

    // Click outside the editor to remove any cursor/selection artifacts
    await page.locator("body").click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot("page-editor.png", {
      maxDiffPixelRatio: DEFAULT_THRESHOLD,
      fullPage: true,
    });

    // 3. Create a database with rows and screenshot the table view
    const testDatabaseId = await createDatabaseWithRows(page);

    // Navigate back to get a clean view
    await page.goto(`/${workspaceSlug}/${testDatabaseId}`);
    const grid = page.locator('[role="grid"]');
    await expect(grid).toBeVisible({ timeout: 15_000 });
    await waitForPageStable(page);

    await expect(page).toHaveScreenshot("database-table-view.png", {
      maxDiffPixelRatio: DEFAULT_THRESHOLD,
      fullPage: true,
    });

    // 4. Workspace settings page
    await page.goto(`/${workspaceSlug}/settings`);
    const nameInput = page.locator("#ws-name");
    await expect(nameInput).toBeVisible({ timeout: 15_000 });
    await waitForPageStable(page);

    await expect(page).toHaveScreenshot("workspace-settings.png", {
      maxDiffPixelRatio: DEFAULT_THRESHOLD,
      fullPage: true,
    });
  });
});
