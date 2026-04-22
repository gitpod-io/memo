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
let selectPropertyId: string;

// ---------------------------------------------------------------------------
// Setup: create a database with select and multi-select properties (no options)
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
      title: "Select Options Test DB",
      is_database: true,
      position: 9991,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create a select property with no options
  const { data: selectProp, error: selErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Priority",
      type: "select",
      config: { options: [] },
      position: 0,
    })
    .select()
    .single();

  if (selErr || !selectProp)
    throw new Error(`Failed to create select property: ${selErr?.message}`);
  selectPropertyId = selectProp.id;

  // Create a multi-select property with no options
  const { error: msErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Tags",
      type: "multi_select",
      config: { options: [] },
      position: 1,
    })
    .select()
    .single();

  if (msErr)
    throw new Error(`Failed to create multi-select property: ${msErr?.message}`);

  // Create a default table view
  const { error: tvErr } = await admin
    .from("database_views")
    .insert({
      database_id: databasePageId,
      name: "Table view",
      type: "table",
      config: {},
      position: 0,
    })
    .select()
    .single();

  if (tvErr) throw new Error(`Failed to create table view: ${tvErr.message}`);

  // Create a row so the grid renders
  const { error: rowErr } = await admin
    .from("pages")
    .insert({
      workspace_id: ws.id,
      parent_id: databasePageId,
      title: "Test Row",
      is_database: false,
      position: 0,
      created_by: testUserId,
    })
    .select()
    .single();

  if (rowErr)
    throw new Error(`Failed to create row: ${rowErr?.message}`);
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

test.afterAll(async () => {
  const admin = getAdminClient();

  // Delete rows
  const { data: allRows } = await admin
    .from("pages")
    .select("id")
    .eq("parent_id", databasePageId);
  if (allRows) {
    for (const row of allRows) {
      await admin.from("row_values").delete().eq("row_id", row.id);
    }
    for (const row of allRows) {
      await admin.from("pages").delete().eq("id", row.id);
    }
  }

  await admin
    .from("database_views")
    .delete()
    .eq("database_id", databasePageId);
  await admin
    .from("database_properties")
    .delete()
    .eq("database_id", databasePageId);
  await admin.from("pages").delete().eq("id", databasePageId);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function navigateToDatabase(page: import("@playwright/test").Page) {
  await page.goto(`/${workspaceSlug}/${databasePageId}`);
  await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Select/Multi-select option persistence", () => {
  test("new select option persists in property config after page reload", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Click the first editable cell (Priority select) to enter editing mode
    const selectCell = page.locator('[role="gridcell"][tabindex="0"]').first();
    await expect(selectCell).toBeVisible({ timeout: 10_000 });
    await selectCell.click();

    // The select dropdown should appear with a search input
    const dropdownInput = page.locator('input[placeholder="Search or create…"]');
    await expect(dropdownInput).toBeVisible({ timeout: 5_000 });

    // Type a new option name and create it
    await dropdownInput.fill("High");
    const createBtn = page.locator("button").filter({ hasText: /Create/ });
    await expect(createBtn).toBeVisible({ timeout: 3_000 });
    await createBtn.click();

    // Wait for persistence to complete
    await page.waitForTimeout(2_000);

    // Reload the page to verify persistence
    await page.reload();
    await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 15_000 });

    // Click the select cell again to open the dropdown
    const reloadedCell = page.locator('[role="gridcell"][tabindex="0"]').first();
    await expect(reloadedCell).toBeVisible({ timeout: 10_000 });
    await reloadedCell.click();

    const reloadedDropdown = page.locator('input[placeholder="Search or create…"]');
    await expect(reloadedDropdown).toBeVisible({ timeout: 5_000 });

    // "High" should appear as an existing option (with a checkmark since it's selected)
    const highOption = page.locator("button").filter({ hasText: "High" });
    await expect(highOption.first()).toBeVisible({ timeout: 5_000 });

    // Typing "High" should NOT show a "Create" button since it already exists
    await reloadedDropdown.fill("High");
    await expect(
      page.locator("button").filter({ hasText: /Create/ }),
    ).not.toBeVisible({ timeout: 2_000 });
  });

  test("new multi-select options persist in property config after page reload", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Click the second editable cell (Tags multi-select)
    const multiSelectCell = page.locator('[role="gridcell"][tabindex="0"]').nth(1);
    await expect(multiSelectCell).toBeVisible({ timeout: 10_000 });
    await multiSelectCell.click();

    // Create first tag
    const dropdownInput = page.locator('input[placeholder="Search or create…"]');
    await expect(dropdownInput).toBeVisible({ timeout: 5_000 });
    await dropdownInput.fill("Frontend");
    const createBtn = page.locator("button").filter({ hasText: /Create/ });
    await expect(createBtn).toBeVisible({ timeout: 3_000 });
    await createBtn.click();

    // The cell exits editing mode after onChange. Wait and re-click.
    await page.waitForTimeout(1_500);

    // Re-click to create the second tag
    const multiSelectCellAgain = page.locator('[role="gridcell"][tabindex="0"]').nth(1);
    await expect(multiSelectCellAgain).toBeVisible({ timeout: 5_000 });
    await multiSelectCellAgain.click();

    const dropdownInput2 = page.locator('input[placeholder="Search or create…"]');
    await expect(dropdownInput2).toBeVisible({ timeout: 5_000 });
    await dropdownInput2.fill("Backend");
    const createBtn2 = page.locator("button").filter({ hasText: /Create/ });
    await expect(createBtn2).toBeVisible({ timeout: 3_000 });
    await createBtn2.click();

    // Wait for persistence
    await page.waitForTimeout(2_000);

    // Reload the page
    await page.reload();
    await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 15_000 });

    // Click the multi-select cell to verify options persisted
    const reloadedCell = page.locator('[role="gridcell"][tabindex="0"]').nth(1);
    await expect(reloadedCell).toBeVisible({ timeout: 10_000 });
    await reloadedCell.click();

    const reloadedDropdown = page.locator('input[placeholder="Search or create…"]');
    await expect(reloadedDropdown).toBeVisible({ timeout: 5_000 });

    // Both "Frontend" and "Backend" should appear as existing options
    await expect(
      page.locator("button").filter({ hasText: "Frontend" }).first(),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator("button").filter({ hasText: "Backend" }).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("_newOptions is not stored in row_values", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Create a new option in the select cell
    const selectCell = page.locator('[role="gridcell"][tabindex="0"]').first();
    await expect(selectCell).toBeVisible({ timeout: 10_000 });
    await selectCell.click();

    const dropdownInput = page.locator('input[placeholder="Search or create…"]');
    await expect(dropdownInput).toBeVisible({ timeout: 5_000 });
    await dropdownInput.fill("Critical");
    const createBtn = page.locator("button").filter({ hasText: /Create/ });
    await expect(createBtn).toBeVisible({ timeout: 3_000 });
    await createBtn.click();
    await page.waitForTimeout(2_000);

    // Verify via the admin API that _newOptions is not in the row value
    const admin = getAdminClient();
    const { data: rowValues } = await admin
      .from("row_values")
      .select("value")
      .eq("property_id", selectPropertyId)
      .limit(5);

    if (rowValues) {
      for (const rv of rowValues) {
        const val = rv.value as Record<string, unknown>;
        expect(val).not.toHaveProperty("_newOptions");
      }
    }
  });
});
