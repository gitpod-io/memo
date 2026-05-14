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
const propertyIds: string[] = [];
const rowPageIds: string[] = [];

// ---------------------------------------------------------------------------
// Setup: create a database with 2 properties and 1 row
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
      title: "Column Resize Test DB",
      is_database: true,
      position: 9992,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create two properties: ColA and ColB
  const propNames = ["ColA", "ColB"];
  for (let i = 0; i < propNames.length; i++) {
    const { data: prop, error: propErr } = await admin
      .from("database_properties")
      .insert({
        database_id: databasePageId,
        name: propNames[i],
        type: "text",
        config: {},
        position: i,
      })
      .select()
      .single();

    if (propErr || !prop)
      throw new Error(`Failed to create property: ${propErr?.message}`);
    propertyIds.push(prop.id);
  }

  // Create a table view
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

  // Create one row so the table renders data rows
  const { data: rowPage, error: rowErr } = await admin
    .from("pages")
    .insert({
      workspace_id: ws.id,
      parent_id: databasePageId,
      title: "Resize Test Row",
      is_database: false,
      position: 0,
      created_by: testUserId,
    })
    .select()
    .single();

  if (rowErr || !rowPage)
    throw new Error(`Failed to create row: ${rowErr?.message}`);
  rowPageIds.push(rowPage.id);
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

/** Get the computed pixel width of a column header by its colIndex. */
async function getColumnWidth(
  page: import("@playwright/test").Page,
  colIndex: number,
): Promise<number> {
  const header = page.getByTestId(`db-table-column-header-${colIndex}`);
  const box = await header.boundingBox();
  if (!box) throw new Error(`Column header ${colIndex} not visible`);
  return box.width;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Table view column resize", () => {
  test("drag resize handle to increase column width", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Wait for the first property column header (ColA at index 0)
    const colAHeader = page.getByTestId("db-table-column-header-0");
    await expect(colAHeader).toBeVisible({ timeout: 10_000 });

    // Record initial widths of both columns
    const initialWidthA = await getColumnWidth(page, 0);
    const initialWidthB = await getColumnWidth(page, 1);

    // Get the resize handle for ColA (index 0)
    const resizeHandle = page.getByTestId("db-table-resize-handle-0");
    await expect(resizeHandle).toBeVisible();

    const handleBox = await resizeHandle.boundingBox();
    if (!handleBox) throw new Error("Resize handle not visible");

    // Drag the handle 100px to the right to widen ColA
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    const dragDistance = 100;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Move in steps to trigger mousemove events
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(startX + (dragDistance * i) / 5, startY);
    }
    await page.mouse.up();

    // Verify ColA width increased
    await expect(async () => {
      const newWidthA = await getColumnWidth(page, 0);
      expect(newWidthA).toBeGreaterThan(initialWidthA + 50);
    }).toPass({ timeout: 5_000 });

    // Verify ColB width is not affected
    const newWidthB = await getColumnWidth(page, 1);
    expect(newWidthB).toBeCloseTo(initialWidthB, -1);
  });

  test("drag resize handle to decrease column width", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    const colAHeader = page.getByTestId("db-table-column-header-0");
    await expect(colAHeader).toBeVisible({ timeout: 10_000 });

    const initialWidthA = await getColumnWidth(page, 0);

    const resizeHandle = page.getByTestId("db-table-resize-handle-0");
    const handleBox = await resizeHandle.boundingBox();
    if (!handleBox) throw new Error("Resize handle not visible");

    // Drag the handle 60px to the left to shrink ColA
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    const dragDistance = -60;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(startX + (dragDistance * i) / 5, startY);
    }
    await page.mouse.up();

    // Verify ColA width decreased
    await expect(async () => {
      const newWidthA = await getColumnWidth(page, 0);
      expect(newWidthA).toBeLessThan(initialWidthA);
    }).toPass({ timeout: 5_000 });
  });

  test("minimum column width constraint is respected", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    const colAHeader = page.getByTestId("db-table-column-header-0");
    await expect(colAHeader).toBeVisible({ timeout: 10_000 });

    const resizeHandle = page.getByTestId("db-table-resize-handle-0");
    const handleBox = await resizeHandle.boundingBox();
    if (!handleBox) throw new Error("Resize handle not visible");

    // Drag the handle far to the left (500px) to try to shrink below minimum
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    const dragDistance = -500;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(startX + (dragDistance * i) / 10, startY);
    }
    await page.mouse.up();

    // Verify column width does not go below minimum (80px)
    await expect(async () => {
      const newWidthA = await getColumnWidth(page, 0);
      expect(newWidthA).toBeGreaterThanOrEqual(80);
    }).toPass({ timeout: 5_000 });
  });

  test("resizing one column does not affect other columns", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    const colBHeader = page.getByTestId("db-table-column-header-1");
    await expect(colBHeader).toBeVisible({ timeout: 10_000 });

    // Record initial width of ColA
    const initialWidthA = await getColumnWidth(page, 0);

    // Resize ColB (index 1) by dragging its handle
    const resizeHandle = page.getByTestId("db-table-resize-handle-1");
    const handleBox = await resizeHandle.boundingBox();
    if (!handleBox) throw new Error("Resize handle not visible");

    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    const dragDistance = 80;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(startX + (dragDistance * i) / 5, startY);
    }
    await page.mouse.up();

    // Verify ColB width increased
    await expect(async () => {
      const newWidthB = await getColumnWidth(page, 1);
      expect(newWidthB).toBeGreaterThan(180);
    }).toPass({ timeout: 5_000 });

    // Verify ColA width is unchanged
    const finalWidthA = await getColumnWidth(page, 0);
    expect(finalWidthA).toBeCloseTo(initialWidthA, -1);
  });
});
