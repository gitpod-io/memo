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

// Track IDs for cleanup
let databasePageId: string;
let workspaceSlug: string;
let statusPropertyId: string;
let priorityPropertyId: string;
let emailPropertyId: string;
const rowPageIds: string[] = [];

const SELECT_OPTIONS_STATUS = [
  { id: crypto.randomUUID(), name: "To Do", color: "blue" },
  { id: crypto.randomUUID(), name: "Done", color: "green" },
];

const SELECT_OPTIONS_PRIORITY = [
  { id: crypto.randomUUID(), name: "High", color: "red" },
  { id: crypto.randomUUID(), name: "Low", color: "gray" },
];

// ---------------------------------------------------------------------------
// Setup: database with multiple properties and two table views
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
    .select("workspace_id, workspaces(id, slug, is_personal)")
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
      title: "Property Visibility Test DB",
      is_database: true,
      position: 9980,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create Status property
  const { data: statusProp, error: statusErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Status",
      type: "select",
      config: { options: SELECT_OPTIONS_STATUS },
      position: 1,
    })
    .select()
    .single();

  if (statusErr || !statusProp)
    throw new Error(`Failed to create Status property: ${statusErr?.message}`);
  statusPropertyId = statusProp.id;

  // Create Priority property
  const { data: priorityProp, error: priorityErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Priority",
      type: "select",
      config: { options: SELECT_OPTIONS_PRIORITY },
      position: 2,
    })
    .select()
    .single();

  if (priorityErr || !priorityProp)
    throw new Error(
      `Failed to create Priority property: ${priorityErr?.message}`,
    );
  priorityPropertyId = priorityProp.id;

  // Create Email property
  const { data: emailProp, error: emailErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Contact Email",
      type: "email",
      config: {},
      position: 3,
    })
    .select()
    .single();

  if (emailErr || !emailProp)
    throw new Error(
      `Failed to create Email property: ${emailErr?.message}`,
    );
  emailPropertyId = emailProp.id;

  // Create the first table view (all properties visible by default)
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

  if (tvErr)
    throw new Error(`Failed to create table view: ${tvErr.message}`);

  // Create a second table view with all properties visible
  const { error: tv2Err } = await admin
    .from("database_views")
    .insert({
      database_id: databasePageId,
      name: "Second view",
      type: "table",
      config: {
        visible_properties: [
          statusPropertyId,
          priorityPropertyId,
          emailPropertyId,
        ],
      },
      position: 1,
    })
    .select()
    .single();

  if (tv2Err)
    throw new Error(`Failed to create second view: ${tv2Err.message}`);

  // Create rows
  const rowData = [
    { title: "Row Alpha", statusOptionId: SELECT_OPTIONS_STATUS[0].id },
    { title: "Row Beta", statusOptionId: SELECT_OPTIONS_STATUS[1].id },
  ];

  for (const row of rowData) {
    const { data: rowPage, error: rowErr } = await admin
      .from("pages")
      .insert({
        workspace_id: ws.id,
        parent_id: databasePageId,
        title: row.title,
        is_database: false,
        position: rowPageIds.length,
        created_by: testUserId,
      })
      .select()
      .single();

    if (rowErr || !rowPage)
      throw new Error(`Failed to create row: ${rowErr?.message}`);
    rowPageIds.push(rowPage.id);

    await admin.from("row_values").insert({
      row_id: rowPage.id,
      property_id: statusPropertyId,
      value: { option_id: row.statusOptionId },
    });
  }
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

test.afterAll(async () => {
  const admin = getAdminClient();

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
  await expect(
    page.getByRole("button", { name: /Table view/i }),
  ).toBeVisible({ timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Tests — single auth session covers all acceptance criteria
// ---------------------------------------------------------------------------

test.describe("Property visibility panel", () => {
  test("open panel, hide/unhide columns, verify view independence, verify persistence", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // --- Step 1: Open the panel and verify all properties are listed ---
    const trigger = page.locator(
      '[data-testid="property-visibility-trigger"]',
    );
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await trigger.click();

    const panel = page.locator(
      '[data-testid="property-visibility-panel"]',
    );
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Should show all properties
    await expect(panel.locator("text=Status")).toBeVisible();
    await expect(panel.locator("text=Priority")).toBeVisible();
    await expect(panel.locator("text=Contact Email")).toBeVisible();

    // --- Step 2: Hide the Priority column ---
    const priorityToggle = page.locator(
      `[data-testid="property-toggle-${priorityPropertyId}"]`,
    );
    await expect(priorityToggle).toBeVisible({ timeout: 5_000 });
    await priorityToggle.click();

    // Close the panel by pressing Escape
    await page.keyboard.press("Escape");

    // The Priority column header should no longer be visible in the table
    await expect(
      page
        .locator('[data-testid="db-view-container"]')
        .locator("span")
        .filter({ hasText: /^PRIORITY$/i }),
    ).not.toBeVisible({ timeout: 5_000 });

    // Status column should still be visible
    await expect(
      page
        .locator('[data-testid="db-view-container"]')
        .locator("span")
        .filter({ hasText: /^STATUS$/i })
        .first(),
    ).toBeVisible();

    // --- Step 3: Switch to second view — Priority should still be visible there ---
    const secondViewTab = page.getByRole("button", {
      name: /Second view/i,
    });
    await expect(secondViewTab).toBeVisible({ timeout: 10_000 });
    await secondViewTab.click();

    // In the second view, all properties should be visible
    await expect(
      page
        .locator('[data-testid="db-view-container"]')
        .locator("span")
        .filter({ hasText: /^PRIORITY$/i })
        .first(),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page
        .locator('[data-testid="db-view-container"]')
        .locator("span")
        .filter({ hasText: /^STATUS$/i })
        .first(),
    ).toBeVisible();

    await expect(
      page
        .locator('[data-testid="db-view-container"]')
        .locator("span")
        .filter({ hasText: /^CONTACT EMAIL$/i })
        .first(),
    ).toBeVisible();

    // --- Step 4: Switch back to first view and unhide Priority ---
    const firstViewTab = page.getByRole("button", {
      name: /Table view/i,
    });
    await firstViewTab.click();

    // Priority should still be hidden
    await expect(
      page
        .locator('[data-testid="db-view-container"]')
        .locator("span")
        .filter({ hasText: /^PRIORITY$/i }),
    ).not.toBeVisible({ timeout: 5_000 });

    // Open the panel and re-enable Priority
    await trigger.click();
    await expect(panel).toBeVisible({ timeout: 5_000 });

    const priorityToggle2 = page.locator(
      `[data-testid="property-toggle-${priorityPropertyId}"]`,
    );
    await priorityToggle2.click();

    // Close the panel
    await page.keyboard.press("Escape");

    // Priority should now be visible again
    await expect(
      page
        .locator('[data-testid="db-view-container"]')
        .locator("span")
        .filter({ hasText: /^PRIORITY$/i })
        .first(),
    ).toBeVisible({ timeout: 5_000 });

    // --- Step 5: Hide Contact Email and verify persistence after reload ---
    await trigger.click();
    await expect(panel).toBeVisible({ timeout: 5_000 });

    const emailToggle = page.locator(
      `[data-testid="property-toggle-${emailPropertyId}"]`,
    );
    await expect(emailToggle).toBeVisible({ timeout: 5_000 });
    await emailToggle.click();

    // Close the panel
    await page.keyboard.press("Escape");

    // Verify Contact Email is hidden
    await expect(
      page
        .locator('[data-testid="db-view-container"]')
        .locator("span")
        .filter({ hasText: /^CONTACT EMAIL$/i }),
    ).not.toBeVisible({ timeout: 5_000 });

    // Reload the page
    await page.reload();
    await expect(
      page.getByRole("button", { name: /Table view/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Contact Email should still be hidden after reload
    await expect(
      page
        .locator('[data-testid="db-view-container"]')
        .locator("span")
        .filter({ hasText: /^CONTACT EMAIL$/i }),
    ).not.toBeVisible({ timeout: 5_000 });

    // Status and Priority should still be visible
    await expect(
      page
        .locator('[data-testid="db-view-container"]')
        .locator("span")
        .filter({ hasText: /^STATUS$/i })
        .first(),
    ).toBeVisible();

    await expect(
      page
        .locator('[data-testid="db-view-container"]')
        .locator("span")
        .filter({ hasText: /^PRIORITY$/i })
        .first(),
    ).toBeVisible();
  });
});
