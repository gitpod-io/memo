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
const rowPageIds: string[] = [];

// ---------------------------------------------------------------------------
// Setup: database with 5 rows and a list view
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  const admin = getAdminClient();
  const email = process.env.TEST_USER_EMAIL!;

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

  // Create database page
  const { data: dbPage, error: dbErr } = await admin
    .from("pages")
    .insert({
      workspace_id: ws.id,
      title: "List Keyboard Test DB",
      is_database: true,
      position: 9968,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create table view (default)
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

  // Create list view
  const { error: lvErr } = await admin
    .from("database_views")
    .insert({
      database_id: databasePageId,
      name: "List view",
      type: "list",
      config: {},
      position: 1,
    })
    .select()
    .single();

  if (lvErr) throw new Error(`Failed to create list view: ${lvErr.message}`);

  // Create 5 rows
  const titles = [
    "List Row A",
    "List Row B",
    "List Row C",
    "List Row D",
    "List Row E",
  ];

  for (let i = 0; i < titles.length; i++) {
    const { data: rowPage, error: rowErr } = await admin
      .from("pages")
      .insert({
        workspace_id: ws.id,
        parent_id: databasePageId,
        title: titles[i],
        is_database: false,
        position: i,
        created_by: testUserId,
      })
      .select()
      .single();

    if (rowErr || !rowPage)
      throw new Error(`Failed to create row: ${rowErr?.message}`);
    rowPageIds.push(rowPage.id);
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

async function switchToListView(page: import("@playwright/test").Page) {
  const listTab = page.getByRole("button", { name: /List view/i });
  await listTab.click();

  await expect(
    page.locator('[role="list"][aria-label="Database list"]'),
  ).toBeVisible({ timeout: 15_000 });
}

function getListRow(page: import("@playwright/test").Page, index: number) {
  return page.locator(`[data-list-index="${index}"]`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("List view keyboard navigation", () => {
  test("ArrowDown and ArrowUp navigate between rows", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToListView(page);

    // Focus the first row (index 0)
    const firstRow = getListRow(page, 0);
    await firstRow.focus();
    await expect(firstRow).toBeFocused({ timeout: 3_000 });

    // Press ArrowDown — should move to index 1
    await page.keyboard.press("ArrowDown");
    const secondRow = getListRow(page, 1);
    await expect(secondRow).toBeFocused({ timeout: 3_000 });

    // Press ArrowDown again — should move to index 2
    await page.keyboard.press("ArrowDown");
    const thirdRow = getListRow(page, 2);
    await expect(thirdRow).toBeFocused({ timeout: 3_000 });

    // Press ArrowUp — should move back to index 1
    await page.keyboard.press("ArrowUp");
    await expect(secondRow).toBeFocused({ timeout: 3_000 });
  });

  test("Home and End jump to first and last row", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToListView(page);

    // Focus the middle row (index 2)
    const middleRow = getListRow(page, 2);
    await middleRow.focus();
    await expect(middleRow).toBeFocused({ timeout: 3_000 });

    // Press End — should jump to last row (index 4)
    await page.keyboard.press("End");
    const lastRow = getListRow(page, 4);
    await expect(lastRow).toBeFocused({ timeout: 3_000 });

    // Press Home — should jump to first row (index 0)
    await page.keyboard.press("Home");
    const firstRow = getListRow(page, 0);
    await expect(firstRow).toBeFocused({ timeout: 3_000 });
  });

  test("Enter opens the focused row page", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToListView(page);

    // Focus the first row
    const firstRow = getListRow(page, 0);
    await firstRow.focus();
    await expect(firstRow).toBeFocused({ timeout: 3_000 });

    // Press Enter — should navigate to the row page
    await page.keyboard.press("Enter");

    await page.waitForURL(
      (url) => url.pathname.includes(rowPageIds[0]),
      { timeout: 15_000 },
    );
  });

  test("Escape clears row focus", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToListView(page);

    // Focus a row
    const firstRow = getListRow(page, 0);
    await firstRow.focus();
    await expect(firstRow).toBeFocused({ timeout: 3_000 });

    // Press Escape — should clear focus
    await page.keyboard.press("Escape");
    await expect(firstRow).not.toBeFocused({ timeout: 3_000 });
  });

  test("navigation stops at boundaries", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToListView(page);

    // Focus the first row (index 0)
    const firstRow = getListRow(page, 0);
    await firstRow.focus();
    await expect(firstRow).toBeFocused({ timeout: 3_000 });

    // Press ArrowUp at first row — should stay
    await page.keyboard.press("ArrowUp");
    await expect(firstRow).toBeFocused({ timeout: 3_000 });

    // Navigate to the last row (index 4)
    const lastRow = getListRow(page, 4);
    await lastRow.focus();
    await expect(lastRow).toBeFocused({ timeout: 3_000 });

    // Press ArrowDown at last row — should stay
    await page.keyboard.press("ArrowDown");
    await expect(lastRow).toBeFocused({ timeout: 3_000 });
  });

  test("focused row has aria-selected attribute", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToListView(page);

    const firstRow = getListRow(page, 0);
    await firstRow.focus();
    await expect(firstRow).toBeFocused({ timeout: 3_000 });

    // The focused row should have aria-selected="true"
    await expect(firstRow).toHaveAttribute("aria-selected", "true");

    // Other rows should have aria-selected="false"
    const secondRow = getListRow(page, 1);
    await expect(secondRow).toHaveAttribute("aria-selected", "false");
  });
});
