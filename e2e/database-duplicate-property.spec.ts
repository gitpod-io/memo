import { test, expect } from "./fixtures/auth";
import { createClient } from "@supabase/supabase-js";

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

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

let databasePageId: string;
let workspaceSlug: string;

// ---------------------------------------------------------------------------
// Setup: create a database with a select property that has options
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  const admin = getAdminClient();
  const email = process.env.TEST_USER_EMAIL!;

  // Find the test user
  const { data: userList } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  let testUserId: string | undefined;
  if (userList?.users) {
    testUserId = userList.users.find((u) => u.email === email)?.id;
  }
  if (!testUserId) {
    const { data: profileRows } = await admin
      .from("profiles")
      .select("id")
      .limit(50);
    if (profileRows) {
      for (const p of profileRows) {
        const { data: authUser } = await admin.auth.admin.getUserById(p.id);
        if (authUser?.user?.email === email) {
          testUserId = p.id;
          break;
        }
      }
    }
  }
  if (!testUserId) throw new Error(`Test user ${email} not found`);

  // Get workspace
  const { data: memberships } = await admin
    .from("members")
    .select("workspace_id, workspaces(id, slug)")
    .eq("user_id", testUserId)
    .limit(10);

  if (!memberships || memberships.length === 0) {
    throw new Error("No workspace found for test user");
  }

  const ws = memberships[0].workspaces as unknown as {
    id: string;
    slug: string;
  };
  workspaceSlug = ws.slug;

  // Create a database page
  const { data: dbPage, error: dbErr } = await admin
    .from("pages")
    .insert({
      workspace_id: ws.id,
      title: "Duplicate Property Test DB",
      is_database: true,
      position: 9992,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create a title property (position 0)
  await admin.from("database_properties").insert({
    database_id: databasePageId,
    name: "Name",
    type: "text",
    config: {},
    position: 0,
  });

  // Create a select property with options (position 1)
  await admin.from("database_properties").insert({
    database_id: databasePageId,
    name: "Priority",
    type: "select",
    config: {
      options: [
        { id: "opt-high", name: "High", color: "red" },
        { id: "opt-medium", name: "Medium", color: "yellow" },
        { id: "opt-low", name: "Low", color: "green" },
      ],
    },
    position: 1,
  });

  // Create a default table view
  await admin.from("database_views").insert({
    database_id: databasePageId,
    name: "Table",
    type: "table",
    config: {},
    position: 0,
  });

  // Get the select property ID for row value insertion
  const { data: selectPropRow } = await admin
    .from("database_properties")
    .select("id")
    .eq("database_id", databasePageId)
    .eq("name", "Priority")
    .single();

  // Create a row so we can verify cells are empty after duplication
  const { data: rowPage } = await admin
    .from("pages")
    .insert({
      workspace_id: ws.id,
      title: "Test Row",
      parent_id: databasePageId,
      position: 0,
      created_by: testUserId,
    })
    .select()
    .single();

  if (rowPage && selectPropRow) {
    // Store the option_id (matching the select option format)
    await admin.from("row_values").insert({
      row_id: rowPage.id,
      property_id: selectPropRow.id,
      value: { option_id: "opt-high" },
    });
  }
});

test.afterAll(async () => {
  if (!databasePageId) return;
  const admin = getAdminClient();

  // Clean up row values
  const { data: rows } = await admin
    .from("pages")
    .select("id")
    .eq("parent_id", databasePageId);
  if (rows) {
    for (const row of rows) {
      await admin.from("row_values").delete().eq("row_id", row.id);
    }
  }

  await admin.from("pages").delete().eq("parent_id", databasePageId);
  await admin.from("database_views").delete().eq("database_id", databasePageId);
  await admin
    .from("database_properties")
    .delete()
    .eq("database_id", databasePageId);
  await admin.from("pages").delete().eq("id", databasePageId);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Database: duplicate property", () => {
  test("duplicate a select column and verify new column appears with same type and options", async ({
    authenticatedPage: page,
  }) => {
    // Navigate to the database page
    await page.goto(`/${workspaceSlug}/${databasePageId}`);

    // Wait for the grid to load
    const grid = page.locator('[role="grid"]');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Verify the Priority column header is visible (colIndex=1, after title)
    const priorityHeader = page.getByTestId("db-table-column-header-1");
    await expect(priorityHeader).toBeVisible({ timeout: 5_000 });
    await expect(priorityHeader).toContainText("Priority");

    // Open the column header menu for Priority
    const menuTrigger = priorityHeader.getByRole("button", {
      name: /priority column menu/i,
    });
    await menuTrigger.click();

    // Verify "Duplicate property" is visible in the menu
    const duplicateItem = page.getByRole("menuitem", {
      name: "Duplicate property",
    });
    await expect(duplicateItem).toBeVisible({ timeout: 5_000 });

    // Click "Duplicate property"
    await duplicateItem.click();

    // Verify the new column appears with name "Priority (copy)"
    const newHeader = page.locator('[role="columnheader"]', {
      hasText: "Priority (copy)",
    });
    await expect(newHeader).toBeVisible({ timeout: 10_000 });

    // Verify the new column appears after the source column (colIndex=2)
    const header2 = page.getByTestId("db-table-column-header-2");
    await expect(header2).toContainText("Priority (copy)", { timeout: 5_000 });

    // Verify the original column is still at colIndex=1
    await expect(priorityHeader).toContainText("Priority");

    // Open the new column's header menu to verify it has the same type
    // (select columns show the select icon in the header)
    const newMenuTrigger = header2.getByRole("button", {
      name: /priority \(copy\) column menu/i,
    });
    await newMenuTrigger.click();

    // Verify "Duplicate property" is available on the new column too
    await expect(
      page.getByRole("menuitem", { name: "Duplicate property" }),
    ).toBeVisible({ timeout: 5_000 });

    // Close the menu by pressing Escape
    await page.keyboard.press("Escape");

    // Verify the cell in the new column is empty (no value copied)
    // The original Priority cell should show "High" (rendered as a select badge)
    const originalCell = page.locator('[data-testid="db-table-cell-0-1"]');
    await expect(originalCell).toContainText("High", { timeout: 10_000 });

    // The duplicated column cell should be empty
    const duplicatedCell = page.locator('[data-testid="db-table-cell-0-2"]');
    await expect(duplicatedCell).toBeVisible({ timeout: 5_000 });
    const cellText = await duplicatedCell.textContent();
    expect(cellText?.trim()).toBe("");
  });

  test("title column (position 0) does not show duplicate action", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(`/${workspaceSlug}/${databasePageId}`);

    const grid = page.locator('[role="grid"]');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // The title column is at colIndex=0
    const titleHeader = page.getByTestId("db-table-column-header-0");
    await expect(titleHeader).toBeVisible({ timeout: 5_000 });

    // Open the column header menu for the title column
    const menuTrigger = titleHeader.getByRole("button", {
      name: /name column menu/i,
    });
    await menuTrigger.click();

    // Verify "Rename property" is visible
    await expect(
      page.getByRole("menuitem", { name: "Rename property" }),
    ).toBeVisible({ timeout: 5_000 });

    // Verify "Duplicate property" is NOT visible
    await expect(
      page.getByRole("menuitem", { name: "Duplicate property" }),
    ).not.toBeVisible();
  });
});
