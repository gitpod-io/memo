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

async function addRow(page: import("@playwright/test").Page) {
  const addRowBtn = page.getByTestId("db-table-add-row");
  await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
  await addRowBtn.click();
  await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Database search filter", () => {
  test("search input filters rows by title and clears correctly", async ({
    authenticatedPage: page,
  }) => {
    const dbPageId = await createDatabaseFromSidebar(page);

    // Add three rows
    await addRow(page);
    await addRow(page);
    await addRow(page);

    // Wait for all three rows to appear
    await expect(page.getByTestId("db-table-row-2")).toBeVisible({
      timeout: 10_000,
    });

    // Use admin client to set distinct titles on the row pages
    const admin = getAdminClient();
    const { data: childPages } = await admin
      .from("pages")
      .select("id")
      .eq("parent_id", dbPageId)
      .order("created_at", { ascending: true });

    expect(childPages).toBeTruthy();
    expect(childPages!.length).toBeGreaterThanOrEqual(3);

    await admin
      .from("pages")
      .update({ title: "Alpha Report" })
      .eq("id", childPages![0].id);
    await admin
      .from("pages")
      .update({ title: "Beta Analysis" })
      .eq("id", childPages![1].id);
    await admin
      .from("pages")
      .update({ title: "Gamma Report" })
      .eq("id", childPages![2].id);

    // Reload to pick up the title changes
    await page.reload();
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 15_000,
    });

    // Verify all three rows are visible
    await expect(page.locator(':text("Alpha Report")')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator(':text("Beta Analysis")')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator(':text("Gamma Report")')).toBeVisible({
      timeout: 10_000,
    });

    // --- Search for "Report" — should show Alpha and Gamma, hide Beta ---
    const searchInput = page.getByTestId("db-search-input");
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
    await searchInput.fill("Report");

    // Alpha and Gamma should be visible
    await expect(page.locator(':text("Alpha Report")')).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator(':text("Gamma Report")')).toBeVisible({
      timeout: 5_000,
    });

    // Beta should be hidden
    await expect(page.locator(':text("Beta Analysis")')).not.toBeVisible({
      timeout: 5_000,
    });

    // --- Search is case-insensitive ---
    await searchInput.fill("beta");
    await expect(page.locator(':text("Beta Analysis")')).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator(':text("Alpha Report")')).not.toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator(':text("Gamma Report")')).not.toBeVisible({
      timeout: 5_000,
    });

    // --- Clear search restores all rows ---
    const clearBtn = page.getByTestId("db-search-clear");
    await expect(clearBtn).toBeVisible({ timeout: 5_000 });
    await clearBtn.click();

    await expect(page.locator(':text("Alpha Report")')).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator(':text("Beta Analysis")')).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator(':text("Gamma Report")')).toBeVisible({
      timeout: 5_000,
    });

    // Search input should be empty
    await expect(searchInput).toHaveValue("");
  });

  test("search resets when switching views", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a row so the database is not empty
    await addRow(page);

    // Type something in the search input
    const searchInput = page.getByTestId("db-search-input");
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
    await searchInput.fill("test query");
    await expect(searchInput).toHaveValue("test query");

    // Add a new view (board) via the "+" button in the view tabs
    const addViewBtn = page.getByTestId("db-view-add");
    await expect(addViewBtn).toBeVisible({ timeout: 5_000 });
    await addViewBtn.click();

    // Select "Board view" from the dropdown
    const boardOption = page.getByRole("menuitem", { name: /board view/i });
    await expect(boardOption).toBeVisible({ timeout: 5_000 });
    await boardOption.click();

    // Wait for the board view to render (shows either the board container
    // or a "Group by" prompt when no select property is configured)
    await expect(
      page
        .locator('[data-testid="db-board-container"], :text("Group by")')
        .first(),
    ).toBeVisible({ timeout: 5_000 });

    // Search input should be reset
    const newSearchInput = page.getByTestId("db-search-input");
    await expect(newSearchInput).toBeVisible({ timeout: 5_000 });
    await expect(newSearchInput).toHaveValue("");
  });
});
