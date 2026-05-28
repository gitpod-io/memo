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
let textPropertyId: string;
const rowPageIds: string[] = [];

const LONG_TEXT =
  "This is a very long text value that should definitely wrap to multiple lines when the wrap cells toggle is enabled in the database table view toolbar settings";

// ---------------------------------------------------------------------------
// Setup: database with a long-text row and two table views
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
      title: "Wrap Cells Test DB",
      is_database: true,
      position: 9970,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create a text property
  const { data: textProp, error: propErr } = await admin
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

  if (propErr || !textProp)
    throw new Error(`Failed to create property: ${propErr?.message}`);
  textPropertyId = textProp.id;

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

  // Create a second table view to test independent wrap settings per view
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

  // Create a row with long text
  const { data: rowPage, error: rowErr } = await admin
    .from("pages")
    .insert({
      workspace_id: ws.id,
      parent_id: databasePageId,
      title: "Long Text Row",
      is_database: false,
      position: 0,
      created_by: testUserId,
    })
    .select()
    .single();

  if (rowErr || !rowPage)
    throw new Error(`Failed to create row: ${rowErr?.message}`);
  rowPageIds.push(rowPage.id);

  // Set the long text value on the row
  const { error: rvErr } = await admin.from("row_values").insert({
    row_id: rowPage.id,
    property_id: textPropertyId,
    value: { text: LONG_TEXT },
  });

  if (rvErr)
    throw new Error(`Failed to set row value: ${rvErr.message}`);
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
// Tests
// ---------------------------------------------------------------------------

test.describe("Wrap cells toggle", () => {
  test("toggles wrap on/off, persists across reload, and maintains independent settings per view", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Wait for table rows to render
    await expect(page.locator('[data-testid="db-table-row-0"]')).toBeVisible({
      timeout: 15_000,
    });

    // --- Step 1: Toggle is visible and defaults to off (not pressed) ---
    const toggle = page.locator('[data-testid="wrap-cells-toggle"]');
    await expect(toggle).toBeVisible({ timeout: 5_000 });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    // Find the text cell (column 0 = Description property)
    const textCell = page
      .locator('[data-testid="db-table-row-0"]')
      .locator('[data-testid="db-table-cell-0-0"]');
    await expect(textCell).toBeVisible({ timeout: 5_000 });

    // Measure initial height — text should be truncated (single line)
    const truncatedHeight = await textCell.evaluate(
      (el) => el.getBoundingClientRect().height,
    );

    // --- Step 2: Toggle wrap on → text cell should expand ---
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    // Wait for the DOM to update
    await page.waitForTimeout(300);

    const wrappedHeight = await textCell.evaluate(
      (el) => el.getBoundingClientRect().height,
    );
    // Wrapped text should be taller than truncated (at least 1.5x for long text)
    expect(wrappedHeight).toBeGreaterThan(truncatedHeight * 1.3);

    // --- Step 3: Toggle wrap off → text truncates again ---
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await page.waitForTimeout(300);

    const truncatedAgainHeight = await textCell.evaluate(
      (el) => el.getBoundingClientRect().height,
    );
    // Should be back to approximately the original truncated height
    expect(truncatedAgainHeight).toBeLessThanOrEqual(truncatedHeight + 4);

    // --- Step 4: Enable wrap, reload, verify persistence ---
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    // Wait for the config to persist to Supabase
    await page.waitForTimeout(500);

    await page.reload();
    await expect(
      page.getByRole("button", { name: /Table view/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="db-table-row-0"]')).toBeVisible({
      timeout: 15_000,
    });

    // Toggle should still be pressed after reload
    const toggleAfterReload = page.locator('[data-testid="wrap-cells-toggle"]');
    await expect(toggleAfterReload).toHaveAttribute("aria-pressed", "true");

    const heightAfterReload = await page
      .locator('[data-testid="db-table-cell-0-0"]')
      .evaluate((el) => el.getBoundingClientRect().height);
    // Should still be wrapped (taller than truncated)
    expect(heightAfterReload).toBeGreaterThan(truncatedHeight * 1.3);

    // --- Step 5: Switch to second view → should have wrap off (default) ---
    const secondTab = page.getByRole("button", { name: /Second table/i });
    await expect(secondTab).toBeVisible({ timeout: 5_000 });
    await secondTab.click();

    await expect(page.locator('[data-testid="db-table-row-0"]')).toBeVisible({
      timeout: 15_000,
    });

    const secondViewToggle = page.locator('[data-testid="wrap-cells-toggle"]');
    await expect(secondViewToggle).toHaveAttribute("aria-pressed", "false");

    // --- Step 6: Switch back to first view → still wrapped ---
    const firstTab = page.getByRole("button", { name: /Table view/i });
    await firstTab.click();
    await expect(page.locator('[data-testid="db-table-row-0"]')).toBeVisible({
      timeout: 15_000,
    });

    await expect(
      page.locator('[data-testid="wrap-cells-toggle"]'),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
