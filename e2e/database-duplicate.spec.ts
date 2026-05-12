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
  createdPageIds.push(pageId);
  return pageId;
}

async function duplicateViaSidebarContextMenu(
  page: import("@playwright/test").Page,
) {
  const sidebar = page.getByRole("complementary");
  const selectedItem = sidebar.locator(
    '[role="treeitem"][aria-selected="true"]',
  );
  await expect(selectedItem).toBeVisible({ timeout: 10_000 });

  const urlBefore = page.url();

  await selectedItem.hover();

  const moreBtn = selectedItem.locator('[aria-label="Page actions"]');
  await expect(moreBtn).toBeVisible({ timeout: 3_000 });
  await moreBtn.click();

  const duplicateItem = page.getByRole("menuitem", { name: /duplicate/i });
  await expect(duplicateItem).toBeVisible({ timeout: 3_000 });
  await duplicateItem.click();

  await page.waitForURL((url) => url.href !== urlBefore, {
    timeout: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Database Duplication", () => {
  test("duplicating a database page creates a working database", async ({
    authenticatedPage: page,
  }) => {
    // Create a database
    const originalDbId = await createDatabaseFromSidebar(page);

    // Duplicate via sidebar context menu
    await duplicateViaSidebarContextMenu(page);

    // Extract the new page ID
    const pathParts = new URL(page.url()).pathname.split("/").filter(Boolean);
    const newPageId = pathParts[pathParts.length - 1];
    createdPageIds.push(newPageId);

    // The new page should be different from the original
    expect(newPageId).not.toBe(originalDbId);

    // The duplicated database should render as a database (grid or empty state),
    // not as a blank regular page
    const dbView = page
      .locator('[role="grid"], :text("No rows yet")')
      .first();
    await expect(dbView).toBeVisible({ timeout: 15_000 });

    // The title should contain "(copy)"
    const titleInput = page.locator('input[aria-label="Page title"]');
    await expect(titleInput).toBeVisible({ timeout: 10_000 });
    const title = await titleInput.inputValue();
    expect(title).toContain("(copy)");
  });

  test("duplicated database appears with grid icon in sidebar", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    await duplicateViaSidebarContextMenu(page);

    const pathParts = new URL(page.url()).pathname.split("/").filter(Boolean);
    const newPageId = pathParts[pathParts.length - 1];
    createdPageIds.push(newPageId);

    // The duplicated database should be selected in the sidebar
    const sidebar = page.getByRole("complementary");
    const selectedItem = sidebar.locator(
      '[role="treeitem"][aria-selected="true"]',
    );
    await expect(selectedItem).toBeVisible({ timeout: 10_000 });
    await expect(selectedItem).toContainText("(copy)", { timeout: 5_000 });
  });
});
