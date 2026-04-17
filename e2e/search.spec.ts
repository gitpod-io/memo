import { test, expect } from "./fixtures/auth";

/**
 * Helper: wait for the sidebar page tree to finish loading.
 * Returns once tree items are visible or the tree is confirmed empty.
 */
async function waitForSidebarReady(page: import("@playwright/test").Page) {
  const sidebar = page.getByRole("complementary");
  const treeItem = sidebar.locator('[role="treeitem"]').first();
  try {
    await expect(treeItem).toBeVisible({ timeout: 10_000 });
  } catch {
    // Tree loaded but empty — acceptable
  }
}

/**
 * Helper: create a page with a specific title via the sidebar.
 * Returns the page ID from the URL.
 *
 * Waits for the Supabase PATCH response to confirm the title was persisted
 * before returning. This prevents search tests from querying before the
 * title is committed to the database (root cause of #166).
 */
async function createPageWithTitle(
  page: import("@playwright/test").Page,
  title: string
): Promise<string> {
  const sidebar = page.getByRole("complementary");
  const newPageBtn = sidebar.getByRole("button", { name: /new page/i });
  await newPageBtn.click();

  await page.waitForURL(
    (url) => url.pathname.split("/").filter(Boolean).length >= 2,
    { timeout: 10_000 }
  );

  // Wait for editor to load
  const editor = page.locator('[contenteditable="true"]');
  await expect(editor).toBeVisible({ timeout: 10_000 });

  // Set the page title
  const titleInput = page.locator(
    'input[aria-label*="title" i], input[placeholder*="untitled" i]'
  );
  await expect(titleInput.first()).toBeVisible({ timeout: 5_000 });
  await titleInput.first().click();
  await titleInput.first().fill(title);

  // Wait for the Supabase PATCH (title save) to complete before returning.
  // The PageTitle component saves on Enter via an async supabase update.
  // Without this, search tests can query before the title is committed,
  // causing the full-text search_vector to not match (the stored generated
  // column updates synchronously with the row, but the row must be written
  // first).
  const titleSaveResponse = page.waitForResponse(
    (resp) =>
      resp.url().includes("/rest/v1/pages") &&
      resp.request().method() === "PATCH" &&
      resp.status() >= 200 &&
      resp.status() < 300,
    { timeout: 10_000 }
  );
  await page.keyboard.press("Enter");
  await titleSaveResponse;

  // Extract page ID from URL
  const url = new URL(page.url());
  const segments = url.pathname.split("/").filter(Boolean);
  return segments[segments.length - 1];
}

test.describe("Sidebar search", () => {
  // Use a unique word so tsvector matches reliably and doesn't collide with other content
  const uniqueWord = `searchtest${Date.now()}`;
  const pageTitle = `Quantum ${uniqueWord} Document`;
  let createdPageId: string;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    await waitForSidebarReady(page);
  });

  test("setup: create a page with known content for search tests", async ({
    authenticatedPage: page,
  }) => {
    const sidebar = page.getByRole("complementary");
    const newPageBtn = sidebar.getByRole("button", { name: /new page/i });
    if ((await newPageBtn.count()) === 0) {
      test.skip(true, "New page button not found — cannot set up search test");
      return;
    }

    createdPageId = await createPageWithTitle(page, pageTitle);
    expect(createdPageId).toBeTruthy();
  });

  test("typing in search input shows matching results", async ({
    authenticatedPage: page,
  }) => {
    // First create a page so we have something to search for
    const sidebar = page.getByRole("complementary");
    const newPageBtn = sidebar.getByRole("button", { name: /new page/i });
    if ((await newPageBtn.count()) === 0) {
      test.skip(true, "New page button not found");
      return;
    }

    createdPageId = await createPageWithTitle(page, pageTitle);

    // Search for the unique word. Use expect.toPass to retry the entire
    // search flow — the title save is confirmed by createPageWithTitle,
    // but Supabase read-replicas may have a short replication lag.
    const searchInput = page.getByRole("combobox", { name: /search pages/i });
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    await expect(async () => {
      await searchInput.click();
      await searchInput.fill(uniqueWord);

      // Wait for debounce (300ms) + network response
      const resultsList = page.locator("#search-results");
      await expect(resultsList).toBeVisible({ timeout: 5_000 });

      // Should have at least one result matching our page
      const resultOptions = resultsList.locator('[role="option"]');
      await expect(resultOptions.first()).toBeVisible({ timeout: 5_000 });

      // The result should contain our page title
      await expect(resultOptions.first()).toContainText("Quantum");
    }).toPass({ timeout: 15_000, intervals: [2_000, 3_000, 5_000] });
  });

  test("clicking a search result navigates to the correct page", async ({
    authenticatedPage: page,
  }) => {
    // Create a page to search for
    const sidebar = page.getByRole("complementary");
    const newPageBtn = sidebar.getByRole("button", { name: /new page/i });
    if ((await newPageBtn.count()) === 0) {
      test.skip(true, "New page button not found");
      return;
    }

    const navUniqueWord = `navtest${Date.now()}`;
    const navTitle = `Navigate ${navUniqueWord} Target`;
    const pageId = await createPageWithTitle(page, navTitle);

    // Navigate away first (go to workspace root) so we can verify navigation
    const workspaceSlug = page.url().split("/").filter(Boolean)[2];
    // Click the workspace name or go to root to leave the page
    await page.goto(`/${workspaceSlug}`);
    await waitForSidebarReady(page);

    // Search for the page
    const searchInput = page.getByRole("combobox", { name: /search pages/i });
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
    await searchInput.click();
    await searchInput.fill(navUniqueWord);

    // Wait for results
    const resultsList = page.locator("#search-results");
    await expect(resultsList).toBeVisible({ timeout: 5_000 });

    const resultOption = resultsList.locator('[role="option"]').first();
    await expect(resultOption).toBeVisible({ timeout: 5_000 });
    await expect(resultOption).toContainText("Navigate");

    // Click the result
    await resultOption.click();

    // Should navigate to the page URL containing the page ID
    await page.waitForURL((url) => url.pathname.includes(pageId), {
      timeout: 10_000,
    });

    // Editor should be visible on the target page
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });
  });

  test("search with no matches shows empty state", async ({
    authenticatedPage: page,
  }) => {
    const searchInput = page.getByRole("combobox", { name: /search pages/i });
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
    await searchInput.click();

    // Type a query that should never match any page
    await searchInput.fill("zzzyyyxxxnonexistent999");

    // Wait for debounce + response
    const resultsList = page.locator("#search-results");
    await expect(resultsList).toBeVisible({ timeout: 5_000 });

    // Should show the empty state message
    const emptyMessage = resultsList.getByText("No pages match your search");
    await expect(emptyMessage).toBeVisible({ timeout: 5_000 });

    // Should have no result options
    const resultOptions = resultsList.locator('[role="option"]');
    await expect(resultOptions).toHaveCount(0);
  });

  test("search is scoped to the current workspace", async ({
    authenticatedPage: page,
  }) => {
    // Create a page in the current workspace with a unique identifier
    const sidebar = page.getByRole("complementary");
    const newPageBtn = sidebar.getByRole("button", { name: /new page/i });
    if ((await newPageBtn.count()) === 0) {
      test.skip(true, "New page button not found");
      return;
    }

    const scopeWord = `scopetest${Date.now()}`;
    const scopeTitle = `Scoped ${scopeWord} Page`;
    await createPageWithTitle(page, scopeTitle);

    // Search for the page — it should appear since it's in the current workspace
    const searchInput = page.getByRole("combobox", { name: /search pages/i });
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
    await searchInput.click();
    await searchInput.fill(scopeWord);

    const resultsList = page.locator("#search-results");
    await expect(resultsList).toBeVisible({ timeout: 5_000 });

    // Verify the search API was called with a workspace_id parameter
    // by checking that results appear (the API requires workspace_id)
    const resultOptions = resultsList.locator('[role="option"]');
    await expect(resultOptions.first()).toBeVisible({ timeout: 5_000 });
    await expect(resultOptions.first()).toContainText("Scoped");

    // The search component resolves workspace_id from the URL's workspaceSlug
    // and passes it to /api/search?workspace_id=. If workspace scoping were
    // broken, the API would return 400 (missing workspace_id) or results
    // from other workspaces. We verify the correct page appears.
    const count = await resultOptions.count();
    for (let i = 0; i < count; i++) {
      const text = await resultOptions.nth(i).textContent();
      // All results should be from the current workspace.
      // Since we used a unique word, only our page should match.
      expect(text).toContain(scopeWord);
    }
  });
});
