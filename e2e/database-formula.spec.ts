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
let numberPropertyId: string;
let rowId: string;

// ---------------------------------------------------------------------------
// Setup: create a database with number, text, and formula properties
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
      title: "Formula Test DB",
      is_database: true,
      position: 9980,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create a number property
  const { data: numProp, error: numErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Price",
      type: "number",
      config: {},
      position: 0,
    })
    .select()
    .single();

  if (numErr || !numProp)
    throw new Error(`Failed to create number property: ${numErr?.message}`);
  numberPropertyId = numProp.id;

  // Create a text property
  const { data: txtProp, error: txtErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Label",
      type: "text",
      config: {},
      position: 1,
    })
    .select()
    .single();

  if (txtErr || !txtProp)
    throw new Error(`Failed to create text property: ${txtErr?.message}`);

  // Create a formula property: prop("Price") * 2
  const { data: fmlProp, error: fmlErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Double Price",
      type: "formula",
      config: { expression: 'prop("Price") * 2' },
      position: 2,
    })
    .select()
    .single();

  if (fmlErr || !fmlProp)
    throw new Error(`Failed to create formula property: ${fmlErr?.message}`);

  // Create a formula property with an invalid expression
  const { data: badFmlProp, error: badFmlErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Bad Formula",
      type: "formula",
      config: { expression: "prop(nonexistent) +++" },
      position: 3,
    })
    .select()
    .single();

  if (badFmlErr || !badFmlProp)
    throw new Error(
      `Failed to create invalid formula property: ${badFmlErr?.message}`,
    );

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

  // Create a row with a Price value
  const { data: rowPage, error: rowErr } = await admin
    .from("pages")
    .insert({
      workspace_id: ws.id,
      parent_id: databasePageId,
      title: "Item A",
      is_database: false,
      position: 0,
      created_by: testUserId,
    })
    .select()
    .single();

  if (rowErr || !rowPage)
    throw new Error(`Failed to create row: ${rowErr?.message}`);
  rowId = rowPage.id;

  // Set the Price value to 50
  const { error: rvErr } = await admin.from("row_values").insert({
    row_id: rowId,
    property_id: numberPropertyId,
    value: { number: 50 },
  });

  if (rvErr)
    throw new Error(`Failed to set row value: ${rvErr.message}`);
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

test.afterAll(async () => {
  const admin = getAdminClient();

  // Delete row values
  await admin.from("row_values").delete().eq("row_id", rowId);

  // Delete rows
  await admin.from("pages").delete().eq("parent_id", databasePageId);

  // Delete views, properties, and the database page
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

test.describe("Formula property type", () => {
  test("formula column displays computed value in table view", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // The grid should show the computed formula value: 50 * 2 = 100
    const grid = page.locator('[role="grid"]');
    await expect(grid.getByText("100")).toBeVisible({ timeout: 10_000 });
  });

  test("formula updates when referenced property value changes", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Verify initial formula value is 100
    const grid = page.locator('[role="grid"]');
    await expect(grid.getByText("100")).toBeVisible({ timeout: 10_000 });

    // Find the Price cell and click to edit it.
    // The Price column is the first property column (data-col="0").
    const priceCell = page.locator('[role="gridcell"][data-col="0"]').first();
    await expect(priceCell).toBeVisible({ timeout: 5_000 });
    await priceCell.click();

    // An input should appear for inline editing
    const cellInput = page.locator(
      '[role="gridcell"] input[type="number"]',
    );
    await expect(cellInput).toBeVisible({ timeout: 5_000 });

    // Change the price to 75
    await cellInput.fill("75");

    // Click outside to blur and save
    await page.locator("h1, input[aria-label]").first().click();

    // The formula should now show 75 * 2 = 150
    await expect(grid.getByText("150")).toBeVisible({ timeout: 10_000 });

    // Restore the original value for other tests
    const priceCellAgain = page
      .locator('[role="gridcell"][data-col="0"]')
      .first();
    await priceCellAgain.click();
    const cellInputAgain = page.locator(
      '[role="gridcell"] input[type="number"]',
    );
    await expect(cellInputAgain).toBeVisible({ timeout: 5_000 });
    await cellInputAgain.fill("50");
    await page.locator("h1, input[aria-label]").first().click();
    await expect(grid.getByText("100")).toBeVisible({ timeout: 10_000 });
  });

  test("formula error state renders for invalid expressions", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // The invalid formula column should display "Error" with destructive styling
    const grid = page.locator('[role="grid"]');
    const errorCell = grid.locator("span.text-destructive", {
      hasText: "Error",
    });
    await expect(errorCell).toBeVisible({ timeout: 10_000 });
  });
});
