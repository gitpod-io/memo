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
const rowPageIds: string[] = [];

// ---------------------------------------------------------------------------
// Setup: database with rows and two table views
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
      title: "Row Height Test DB",
      is_database: true,
      position: 9980,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create a text property
  const { error: propErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Notes",
      type: "text",
      config: {},
      position: 0,
    })
    .select()
    .single();

  if (propErr)
    throw new Error(`Failed to create property: ${propErr.message}`);

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

  if (tvErr)
    throw new Error(`Failed to create table view: ${tvErr.message}`);

  // Create a second table view to test independent row height per view
  const { error: tv2Err } = await admin
    .from("database_views")
    .insert({
      database_id: databasePageId,
      name: "Second table",
      type: "table",
      config: {},
      position: 1,
    })
    .select()
    .single();

  if (tv2Err)
    throw new Error(`Failed to create second table view: ${tv2Err.message}`);

  // Create rows
  const titles = ["Row Alpha", "Row Beta", "Row Gamma"];
  for (const title of titles) {
    const { data: rowPage, error: rowErr } = await admin
      .from("pages")
      .insert({
        workspace_id: ws.id,
        parent_id: databasePageId,
        title,
        is_database: false,
        position: rowPageIds.length,
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

// ---------------------------------------------------------------------------
// Tests — single test to avoid auth rate limits
// ---------------------------------------------------------------------------

test.describe("Row height toggle", () => {
  test("opens dropdown, changes row height, persists across reload, and maintains independent height per view", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Wait for table rows to render
    await expect(page.locator('[data-testid="db-table-row-0"]')).toBeVisible({
      timeout: 15_000,
    });

    // --- Step 1: Toggle appears and opens dropdown with three options ---
    const toggle = page.locator('[data-testid="row-height-toggle"]');
    await expect(toggle).toBeVisible({ timeout: 5_000 });
    await toggle.click();

    await expect(
      page.locator('[data-testid="row-height-option-compact"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('[data-testid="row-height-option-default"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="row-height-option-tall"]'),
    ).toBeVisible();

    // --- Step 2: Select compact → rows shrink ---
    await page.locator('[data-testid="row-height-option-compact"]').click();

    // Wait for dropdown to close
    await expect(
      page.locator('[data-testid="row-height-option-compact"]'),
    ).toBeHidden({ timeout: 5_000 });

    const firstRowCell = page
      .locator('[data-testid="db-table-row-0"]')
      .locator('[role="gridcell"]')
      .first();
    await expect(firstRowCell).toBeVisible({ timeout: 5_000 });

    // Compact rows are h-8 (32px). Allow tolerance for borders.
    const compactHeight = await firstRowCell.evaluate(
      (el) => getComputedStyle(el).height,
    );
    expect(parseFloat(compactHeight)).toBeLessThanOrEqual(36);

    // --- Step 3: Select tall → rows expand ---
    await toggle.click();
    await page.locator('[data-testid="row-height-option-tall"]').click();

    await expect(
      page.locator('[data-testid="row-height-option-tall"]'),
    ).toBeHidden({ timeout: 5_000 });

    const tallHeight = await firstRowCell.evaluate(
      (el) => getComputedStyle(el).height,
    );
    // Tall rows are h-14 (56px).
    expect(parseFloat(tallHeight)).toBeGreaterThanOrEqual(50);

    // --- Step 4: Set to compact, reload, verify persistence ---
    await toggle.click();
    await page.locator('[data-testid="row-height-option-compact"]').click();
    await expect(
      page.locator('[data-testid="row-height-option-compact"]'),
    ).toBeHidden({ timeout: 5_000 });

    await page.reload();
    await expect(
      page.getByRole("button", { name: /Table view/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="db-table-row-0"]')).toBeVisible({
      timeout: 15_000,
    });

    const heightAfterReload = await page
      .locator('[data-testid="db-table-row-0"]')
      .locator('[role="gridcell"]')
      .first()
      .evaluate((el) => getComputedStyle(el).height);
    expect(parseFloat(heightAfterReload)).toBeLessThanOrEqual(36);

    // --- Step 5: Switch to second view → should have default height ---
    const secondTab = page.getByRole("button", { name: /Second table/i });
    await expect(secondTab).toBeVisible({ timeout: 5_000 });
    await secondTab.click();

    await expect(page.locator('[data-testid="db-table-row-0"]')).toBeVisible({
      timeout: 15_000,
    });

    const secondViewHeight = await page
      .locator('[data-testid="db-table-row-0"]')
      .locator('[role="gridcell"]')
      .first()
      .evaluate((el) => getComputedStyle(el).height);
    // Default rows are h-10 (40px). Should be greater than compact (32px).
    expect(parseFloat(secondViewHeight)).toBeGreaterThanOrEqual(37);

    // --- Step 6: Switch back to first view → still compact ---
    const firstTab = page.getByRole("button", { name: /Table view/i });
    await firstTab.click();
    await expect(page.locator('[data-testid="db-table-row-0"]')).toBeVisible({
      timeout: 15_000,
    });

    const firstViewHeightAgain = await page
      .locator('[data-testid="db-table-row-0"]')
      .locator('[role="gridcell"]')
      .first()
      .evaluate((el) => getComputedStyle(el).height);
    expect(parseFloat(firstViewHeightAgain)).toBeLessThanOrEqual(36);
  });
});
