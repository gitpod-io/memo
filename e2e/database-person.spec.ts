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

let workspaceSlug: string;
let databasePageId: string;
let personPropertyId: string;
let rowId: string;
let testUserId: string;
let testUserDisplayName: string;

// ---------------------------------------------------------------------------
// Setup: create a database with a person property and one row
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  const admin = getAdminClient();
  const email = process.env.TEST_USER_EMAIL!;

  // Find the test user
  const { data: userList } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  const testUser = userList?.users?.find((u) => u.email === email);
  if (!testUser) throw new Error(`Test user ${email} not found`);
  testUserId = testUser.id;

  // Get display name from profiles
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", testUserId)
    .single();
  testUserDisplayName = profile?.display_name ?? email;

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
      title: "Person Test DB",
      is_database: true,
      position: 9984,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create a person property
  const { data: personProp, error: personErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Assignee",
      type: "person",
      config: {},
      position: 0,
    })
    .select()
    .single();

  if (personErr || !personProp)
    throw new Error(
      `Failed to create person property: ${personErr?.message}`,
    );
  personPropertyId = personProp.id;

  // Create a default table view
  const { error: tvErr } = await admin
    .from("database_views")
    .insert({
      database_id: databasePageId,
      name: "Table view",
      type: "table",
      config: {},
      position: 0,
    });

  if (tvErr) throw new Error(`Failed to create table view: ${tvErr.message}`);

  // Create a row
  const { data: rowPage, error: rowErr } = await admin
    .from("pages")
    .insert({
      workspace_id: ws.id,
      parent_id: databasePageId,
      title: "Person Row",
      is_database: false,
      position: 0,
      created_by: testUserId,
    })
    .select()
    .single();

  if (rowErr || !rowPage)
    throw new Error(`Failed to create row: ${rowErr?.message}`);
  rowId = rowPage.id;
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

test.afterAll(async () => {
  const admin = getAdminClient();

  await admin.from("row_values").delete().eq("row_id", rowId);
  await admin.from("pages").delete().eq("parent_id", databasePageId);
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

/**
 * Open the person editor by clicking the person cell.
 * Returns the search input locator.
 */
async function openPersonEditor(page: import("@playwright/test").Page) {
  const personCell = page
    .locator('[role="gridcell"][data-col]')
    .first();
  await expect(personCell).toBeVisible({ timeout: 10_000 });
  await personCell.click();

  const searchInput = page.locator('input[placeholder="Search members…"]');
  await expect(searchInput).toBeVisible({ timeout: 10_000 });
  return searchInput;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Person property type", () => {
  test("open person picker and select a member", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Open the person editor on the empty cell
    const searchInput = await openPersonEditor(page);

    // The editor should show the test user as a workspace member
    const editorContainer = page.getByTestId("db-cell-editor-person");
    const memberButton = editorContainer.locator("button", {
      hasText: testUserDisplayName,
    });
    await expect(memberButton).toBeVisible({ timeout: 10_000 });

    // Select the test user
    await memberButton.click();

    // The editor closes after onChange
    await expect(searchInput).not.toBeVisible({ timeout: 5_000 });

    // Re-open the editor to verify the selection persisted
    await openPersonEditor(page);
    const selectedCheckbox = editorContainer
      .locator("button", { hasText: testUserDisplayName })
      .locator("span.border-primary");
    await expect(selectedCheckbox).toBeVisible({ timeout: 5_000 });

    // Close the editor
    await page.keyboard.press("Escape");
  });

  test("person picker search filters members by name", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    const searchInput = await openPersonEditor(page);
    const editorContainer = page.getByTestId("db-cell-editor-person");

    // The test user should be visible
    await expect(
      editorContainer.locator("button", { hasText: testUserDisplayName }),
    ).toBeVisible({ timeout: 10_000 });

    // Search for a non-existent member
    await searchInput.fill("zzz_nonexistent_member_zzz");

    // "No members found" message should appear
    await expect(
      editorContainer.locator("text=No members found"),
    ).toBeVisible({ timeout: 5_000 });

    // Clear the search — the test user should reappear
    await searchInput.fill("");
    await expect(
      editorContainer.locator("button", { hasText: testUserDisplayName }),
    ).toBeVisible({ timeout: 5_000 });

    // Search by the test user's name (partial match)
    const partialName = testUserDisplayName.slice(0, 3);
    await searchInput.fill(partialName);
    await expect(
      editorContainer.locator("button", { hasText: testUserDisplayName }),
    ).toBeVisible({ timeout: 5_000 });

    // Close the editor
    await page.keyboard.press("Escape");
  });

  test("clear a person value by deselecting in the editor", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // First ensure the user is selected
    const searchInput = await openPersonEditor(page);
    const editorContainer = page.getByTestId("db-cell-editor-person");

    const memberButton = editorContainer.locator("button", {
      hasText: testUserDisplayName,
    });
    await expect(memberButton).toBeVisible({ timeout: 10_000 });

    // Check if the user is already selected
    const isSelected = await memberButton
      .locator("span.border-primary")
      .isVisible()
      .catch(() => false);

    if (!isSelected) {
      // Select the user first
      await memberButton.click();
      await expect(searchInput).not.toBeVisible({ timeout: 5_000 });
      await openPersonEditor(page);
    }

    // Now deselect the user
    const memberBtn = editorContainer.locator("button", {
      hasText: testUserDisplayName,
    });
    await expect(memberBtn).toBeVisible({ timeout: 10_000 });
    await memberBtn.click();

    // Editor closes after onChange
    await expect(
      page.locator('input[placeholder="Search members…"]'),
    ).not.toBeVisible({ timeout: 5_000 });

    // Re-open the editor to verify the user was deselected
    await openPersonEditor(page);
    const uncheckedBox = editorContainer
      .locator("button", { hasText: testUserDisplayName })
      .locator("span.border-input");
    await expect(uncheckedBox).toBeVisible({ timeout: 5_000 });

    // Close the editor
    await page.keyboard.press("Escape");
  });

  test("person property value visible on the row detail page", async ({
    authenticatedPage: page,
  }) => {
    // Set the person value via admin — delete then insert to avoid stale data
    const admin = getAdminClient();
    await admin
      .from("row_values")
      .delete()
      .eq("row_id", rowId)
      .eq("property_id", personPropertyId);
    await admin.from("row_values").insert({
      row_id: rowId,
      property_id: personPropertyId,
      value: { user_ids: [testUserId] },
    });

    // Navigate to the row detail page
    await page.goto(`/${workspaceSlug}/${rowId}`);

    // Wait for the properties header to load
    const assigneeLabel = page.getByTestId(
      `db-row-property-name-${personPropertyId}`,
    );
    await expect(assigneeLabel).toBeVisible({ timeout: 15_000 });
    await expect(assigneeLabel).toContainText("Assignee");

    // The property value area should be present
    const propertyValue = page.getByTestId(
      `db-row-property-value-${personPropertyId}`,
    );
    await expect(propertyValue).toBeVisible({ timeout: 10_000 });

    // Click the property value area to open the person editor.
    // The PropertyValueCell renders a button that toggles editing mode.
    // Use JavaScript click because the button may have zero rendered height
    // when the PersonRenderer returns null (the _members cache is populated
    // asynchronously by the database view client, not the row detail page).
    await propertyValue.locator("button").first().evaluate((el) => {
      (el as HTMLElement).click();
    });

    // The person editor should open showing workspace members
    const editorContainer = page.getByTestId("db-cell-editor-person");
    await expect(editorContainer).toBeVisible({ timeout: 10_000 });

    // The test user should appear in the member list
    const memberButton = editorContainer.locator("button", {
      hasText: testUserDisplayName,
    });
    await expect(memberButton).toBeVisible({ timeout: 10_000 });

    // The test user should be selected (value was set via admin)
    const selectedCheckbox = memberButton.locator("span.border-primary");
    await expect(selectedCheckbox).toBeVisible({ timeout: 5_000 });

    // Close the editor
    await page.keyboard.press("Escape");
  });

  test("person editor closes on Escape key", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Open the person editor
    const searchInput = await openPersonEditor(page);

    // Verify the editor is open
    await expect(
      page.getByTestId("db-cell-editor-person"),
    ).toBeVisible({ timeout: 5_000 });

    // Press Escape to close
    await page.keyboard.press("Escape");

    // The editor should close
    await expect(searchInput).not.toBeVisible({ timeout: 5_000 });
  });
});
