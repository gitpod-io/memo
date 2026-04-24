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

// Source database (has the relation column)
let sourceDbId: string;
let sourceRowId: string;
let relationPropertyId: string;

// Target database (linked to by the relation)
let targetDbId: string;
let targetRowId1: string;

// ---------------------------------------------------------------------------
// Setup: create two databases, a relation property linking them, and rows
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

  // ---- Target database (the one being linked TO) ----

  const { data: targetDb, error: targetDbErr } = await admin
    .from("pages")
    .insert({
      workspace_id: ws.id,
      title: "Target DB",
      is_database: true,
      position: 9982,
      created_by: testUserId,
    })
    .select()
    .single();

  if (targetDbErr || !targetDb)
    throw new Error(
      `Failed to create target database: ${targetDbErr?.message}`,
    );
  targetDbId = targetDb.id;

  // Create a table view for the target database
  await admin
    .from("database_views")
    .insert({
      database_id: targetDbId,
      name: "Table view",
      type: "table",
      config: {},
      position: 0,
    });

  // Create rows in the target database
  const { data: tRow1, error: tRow1Err } = await admin
    .from("pages")
    .insert({
      workspace_id: ws.id,
      parent_id: targetDbId,
      title: "Alpha Item",
      is_database: false,
      position: 0,
      created_by: testUserId,
    })
    .select()
    .single();

  if (tRow1Err || !tRow1)
    throw new Error(`Failed to create target row 1: ${tRow1Err?.message}`);
  targetRowId1 = tRow1.id;

  const { data: tRow2, error: tRow2Err } = await admin
    .from("pages")
    .insert({
      workspace_id: ws.id,
      parent_id: targetDbId,
      title: "Beta Item",
      is_database: false,
      position: 1,
      created_by: testUserId,
    })
    .select()
    .single();

  if (tRow2Err || !tRow2)
    throw new Error(`Failed to create target row 2: ${tRow2Err?.message}`);

  // ---- Source database (has the relation column) ----

  const { data: sourceDb, error: sourceDbErr } = await admin
    .from("pages")
    .insert({
      workspace_id: ws.id,
      title: "Source DB",
      is_database: true,
      position: 9983,
      created_by: testUserId,
    })
    .select()
    .single();

  if (sourceDbErr || !sourceDb)
    throw new Error(
      `Failed to create source database: ${sourceDbErr?.message}`,
    );
  sourceDbId = sourceDb.id;

  // Create a relation property pointing to the target database
  const { data: relProp, error: relErr } = await admin
    .from("database_properties")
    .insert({
      database_id: sourceDbId,
      name: "Linked Items",
      type: "relation",
      config: { database_id: targetDbId },
      position: 0,
    })
    .select()
    .single();

  if (relErr || !relProp)
    throw new Error(
      `Failed to create relation property: ${relErr?.message}`,
    );
  relationPropertyId = relProp.id;

  // Create a table view for the source database
  await admin
    .from("database_views")
    .insert({
      database_id: sourceDbId,
      name: "Table view",
      type: "table",
      config: {},
      position: 0,
    });

  // Create a row in the source database
  const { data: srcRow, error: srcRowErr } = await admin
    .from("pages")
    .insert({
      workspace_id: ws.id,
      parent_id: sourceDbId,
      title: "Source Row",
      is_database: false,
      position: 0,
      created_by: testUserId,
    })
    .select()
    .single();

  if (srcRowErr || !srcRow)
    throw new Error(`Failed to create source row: ${srcRowErr?.message}`);
  sourceRowId = srcRow.id;

  // Pre-populate the relation value so the pill test is independent
  const { error: rvErr } = await admin.from("row_values").insert({
    row_id: sourceRowId,
    property_id: relationPropertyId,
    value: { page_ids: [targetRowId1] },
  });

  if (rvErr)
    throw new Error(`Failed to set relation value: ${rvErr.message}`);
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

test.afterAll(async () => {
  const admin = getAdminClient();

  // Clean up source database
  await admin.from("row_values").delete().eq("row_id", sourceRowId);
  await admin.from("pages").delete().eq("parent_id", sourceDbId);
  await admin
    .from("database_views")
    .delete()
    .eq("database_id", sourceDbId);
  await admin
    .from("database_properties")
    .delete()
    .eq("database_id", sourceDbId);
  await admin.from("pages").delete().eq("id", sourceDbId);

  // Clean up target database
  await admin.from("pages").delete().eq("parent_id", targetDbId);
  await admin
    .from("database_views")
    .delete()
    .eq("database_id", targetDbId);
  await admin
    .from("database_properties")
    .delete()
    .eq("database_id", targetDbId);
  await admin.from("pages").delete().eq("id", targetDbId);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function navigateToSourceDatabase(
  page: import("@playwright/test").Page,
) {
  await page.goto(`/${workspaceSlug}/${sourceDbId}`);
  await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 15_000 });
}

/**
 * Open the relation editor by clicking the relation cell.
 * Returns the search input locator (visible when editor is open).
 */
async function openRelationEditor(page: import("@playwright/test").Page) {
  const relationCell = page
    .locator('[role="gridcell"][data-col]')
    .first();
  await expect(relationCell).toBeVisible({ timeout: 10_000 });
  await relationCell.click();

  const searchInput = page.locator('input[placeholder="Search pages…"]');
  await expect(searchInput).toBeVisible({ timeout: 5_000 });
  return searchInput;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Relation property type", () => {
  test("select a related row via the relation picker and verify selection persists", async ({
    authenticatedPage: page,
  }) => {
    await navigateToSourceDatabase(page);

    // Open the relation editor
    await openRelationEditor(page);

    // "Alpha Item" should already be selected (pre-populated).
    // Verify the "Remove" label indicates it's selected.
    const removeAlpha = page.locator(
      'button[aria-label="Remove Alpha Item"]',
    );
    await expect(removeAlpha).toBeVisible({ timeout: 10_000 });

    // Select "Beta Item" — this triggers onChange which closes the editor
    const betaOption = page.locator(
      'button[aria-label="Add Beta Item"]',
    );
    await expect(betaOption).toBeVisible({ timeout: 5_000 });
    await betaOption.click();

    // The editor closes immediately after selection. Wait for it to close.
    const searchInput = page.locator('input[placeholder="Search pages…"]');
    await expect(searchInput).not.toBeVisible({ timeout: 5_000 });

    // Re-open the editor to verify both selections persisted
    await openRelationEditor(page);

    // Both should now have "Remove" labels
    await expect(
      page.locator('button[aria-label="Remove Alpha Item"]'),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('button[aria-label="Remove Beta Item"]'),
    ).toBeVisible({ timeout: 5_000 });

    // Close the editor
    await page.keyboard.press("Escape");
  });

  test("relation pill renders on the row detail page and navigates on click", async ({
    authenticatedPage: page,
  }) => {
    // Navigate directly to the source row detail page
    await page.goto(`/${workspaceSlug}/${sourceRowId}`);

    // Wait for the row detail page to load — the properties header should appear
    const linkedItemsLabel = page.locator("text=Linked Items").first();
    await expect(linkedItemsLabel).toBeVisible({ timeout: 15_000 });

    // The RelationRenderer renders pills as buttons with aria-label.
    // Wait for the pill to appear (async page resolution).
    const pill = page.locator(
      'button[aria-label="Navigate to Alpha Item"]',
    );
    await expect(pill).toBeVisible({ timeout: 15_000 });

    // Click the pill to navigate to the target row
    await pill.click();

    // Should navigate to the target row page
    await page.waitForURL(
      (url) => url.pathname.includes(targetRowId1),
      { timeout: 15_000 },
    );

    // The page should show "Alpha Item"
    await expect(
      page.locator("text=Alpha Item").first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("relation picker search filters target rows", async ({
    authenticatedPage: page,
  }) => {
    await navigateToSourceDatabase(page);

    // Open the relation editor
    const searchInput = await openRelationEditor(page);

    // Both rows should be visible initially — use the editor's container
    const editorContainer = page.locator(".w-56").first();
    await expect(
      editorContainer.locator("button", { hasText: "Alpha Item" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      editorContainer.locator("button", { hasText: "Beta Item" }),
    ).toBeVisible({ timeout: 5_000 });

    // Type "Beta" to filter
    await searchInput.fill("Beta");

    // Only "Beta Item" should be visible in the editor
    await expect(
      editorContainer.locator("button", { hasText: "Beta Item" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      editorContainer.locator("button", { hasText: "Alpha Item" }),
    ).not.toBeVisible({ timeout: 3_000 });

    // Clear the search
    await searchInput.fill("");

    // Both should be visible again
    await expect(
      editorContainer.locator("button", { hasText: "Alpha Item" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      editorContainer.locator("button", { hasText: "Beta Item" }),
    ).toBeVisible({ timeout: 5_000 });

    // Close the editor
    await page.keyboard.press("Escape");
  });
});
