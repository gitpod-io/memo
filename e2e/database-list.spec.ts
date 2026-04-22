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

const SELECT_OPTIONS = [
  { id: crypto.randomUUID(), name: "Active", color: "green" },
  { id: crypto.randomUUID(), name: "Archived", color: "gray" },
];

// Track IDs for cleanup
let databasePageId: string;
let workspaceSlug: string;
let selectPropertyId: string;
let textPropertyId: string;
const rowPageIds: string[] = [];

// ---------------------------------------------------------------------------
// Setup: create a database with properties, rows, and a list view
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
      title: "List Test DB",
      is_database: true,
      position: 9991,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create a text property (Description)
  const { data: textProp, error: textPropErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Description",
      type: "text",
      config: {},
      position: 0,
    })
    .select()
    .single();

  if (textPropErr || !textProp)
    throw new Error(`Failed to create text property: ${textPropErr?.message}`);
  textPropertyId = textProp.id;

  // Create a select property (Status)
  const { data: selectProp, error: propErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Status",
      type: "select",
      config: { options: SELECT_OPTIONS },
      position: 1,
    })
    .select()
    .single();

  if (propErr || !selectProp)
    throw new Error(`Failed to create select property: ${propErr?.message}`);
  selectPropertyId = selectProp.id;

  // Create the default table view
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

  // Create a list view with visible properties
  const { error: lvErr } = await admin
    .from("database_views")
    .insert({
      database_id: databasePageId,
      name: "List view",
      type: "list",
      config: {
        visible_properties: [textPropertyId, selectPropertyId],
      },
      position: 1,
    })
    .select()
    .single();

  if (lvErr) throw new Error(`Failed to create list view: ${lvErr.message}`);

  // Create rows with property values
  const rowData = [
    {
      title: "Item Alpha",
      text: "First item description",
      optionId: SELECT_OPTIONS[0].id,
    },
    {
      title: "Item Beta",
      text: "Second item description",
      optionId: SELECT_OPTIONS[1].id,
    },
    {
      title: "Item Gamma",
      text: "Third item description",
      optionId: SELECT_OPTIONS[0].id,
    },
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

    // Set text property value
    const { error: textValErr } = await admin.from("row_values").insert({
      row_id: rowPage.id,
      property_id: textPropertyId,
      value: { value: row.text },
    });

    if (textValErr)
      throw new Error(`Failed to set text value: ${textValErr.message}`);

    // Set select property value
    const { error: selValErr } = await admin.from("row_values").insert({
      row_id: rowPage.id,
      property_id: selectPropertyId,
      value: { option_id: row.optionId },
    });

    if (selValErr)
      throw new Error(`Failed to set select value: ${selValErr.message}`);
  }
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

test.afterAll(async () => {
  const admin = getAdminClient();

  // Delete any rows (includes rows added during tests)
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

/** Navigate to the database page and wait for it to load. */
async function navigateToDatabase(page: import("@playwright/test").Page) {
  await page.goto(`/${workspaceSlug}/${databasePageId}`);
  // Wait for the view tabs to appear
  await expect(
    page.getByRole("button", { name: /Table view/i }),
  ).toBeVisible({ timeout: 15_000 });
}

/** Click the List view tab and wait for the list to render. */
async function switchToListView(page: import("@playwright/test").Page) {
  const listTab = page.getByRole("button", { name: /List view/i });
  await listTab.click();

  // Wait for the list container to render
  await expect(
    page.locator('[role="list"][aria-label="Database list"]'),
  ).toBeVisible({ timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Tests — run serially to avoid data race conditions
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("Database list view", () => {
  test("switch to list view via view tabs", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Table view should be active initially — grid is visible
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // Switch to list view
    await switchToListView(page);

    // The list container should be visible
    await expect(
      page.locator('[role="list"][aria-label="Database list"]'),
    ).toBeVisible({ timeout: 5_000 });

    // The table grid should NOT be visible in list view
    await expect(page.locator('[role="grid"]')).toBeHidden({ timeout: 5_000 });
  });

  test("list rows display with title and visible property values", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToListView(page);

    // All three rows should be visible as list items
    const listContainer = page.locator(
      '[role="list"][aria-label="Database list"]',
    );
    const listItems = listContainer.locator('[role="listitem"]');
    await expect(listItems).toHaveCount(3, { timeout: 10_000 });

    // Verify each row title is displayed
    await expect(
      listContainer.locator("a").filter({ hasText: "Item Alpha" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      listContainer.locator("a").filter({ hasText: "Item Beta" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      listContainer.locator("a").filter({ hasText: "Item Gamma" }),
    ).toBeVisible({ timeout: 5_000 });

    // Verify visible property values are rendered.
    // The text property "Description" values should appear (truncated).
    await expect(
      listContainer.getByText(/First item descri/i).first(),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      listContainer.getByText(/Second item descr/i).first(),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      listContainer.getByText(/Third item descri/i).first(),
    ).toBeVisible({ timeout: 5_000 });

    // Each row should have a FileText icon (svg.lucide-file-text)
    const rowsWithIcon = listContainer.locator("a").filter({
      has: page.locator("svg.lucide-file-text"),
    });
    await expect(rowsWithIcon.first()).toBeVisible({ timeout: 5_000 });
  });

  test("click a list row to open it as a full page", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToListView(page);

    // Click on "Item Alpha" row
    const alphaRow = page
      .locator('[role="list"][aria-label="Database list"]')
      .locator("a")
      .filter({ hasText: "Item Alpha" });
    await expect(alphaRow).toBeVisible({ timeout: 5_000 });
    await alphaRow.click();

    // Should navigate to the row's page — URL should change
    await page.waitForURL(
      (url) => {
        const parts = url.pathname.split("/").filter(Boolean);
        // Should be /<workspace>/<pageId> where pageId is NOT the database page
        return parts.length >= 2 && parts[1] !== databasePageId;
      },
      { timeout: 15_000 },
    );

    // The page should show the row title in the heading area.
    // Use .first() because the title may appear in multiple places
    // (page heading, sidebar tree item, breadcrumb).
    await expect(
      page.getByRole("button", { name: "Item Alpha" }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("create a new row from the list view", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToListView(page);

    // Wait for the list to fully render before counting
    const listContainer = page.locator(
      '[role="list"][aria-label="Database list"]',
    );
    const listItems = listContainer.locator('[role="listitem"]');
    await expect(listItems.first()).toBeVisible({ timeout: 10_000 });
    const initialCount = await listItems.count();

    // Click the "+ New" button below the list (exact match to avoid sidebar buttons)
    const addButton = page.getByRole("button", { name: "New", exact: true });
    await expect(addButton).toBeVisible({ timeout: 5_000 });
    await addButton.click();

    // Wait for the new "Untitled" row to appear in the list
    await expect(
      listContainer.locator("a").filter({ hasText: "Untitled" }),
    ).toBeVisible({ timeout: 10_000 });

    // The list should now have one more item
    await expect(listItems).toHaveCount(initialCount + 1, {
      timeout: 5_000,
    });
  });
});
