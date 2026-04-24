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
// Setup: create a database with multiple properties and rows
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
      title: "Column Reorder Test DB",
      is_database: true,
      position: 9991,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create three properties: Alpha, Beta, Gamma
  const propNames = ["Alpha", "Beta", "Gamma"];
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
      title: "Test Row",
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

/** Get all column header texts in order (excluding the Title header). */
async function getColumnOrder(page: import("@playwright/test").Page) {
  // Column headers are [role="columnheader"] — first is Title, rest are property columns.
  // The add-column button does not have role="columnheader".
  const headers = page.locator('[role="columnheader"]');
  const count = await headers.count();
  const names: string[] = [];
  // Skip first (Title)
  for (let i = 1; i < count; i++) {
    const text = await headers.nth(i).innerText();
    names.push(text.trim());
  }
  return names;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Table view column drag-and-drop reorder", () => {
  test("column headers are draggable", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Wait for property column headers to render
    const alphaHeader = page
      .locator('[role="columnheader"]')
      .filter({ hasText: "Alpha" });
    await expect(alphaHeader).toBeVisible({ timeout: 10_000 });

    // Verify initial column order: Alpha, Beta, Gamma
    const headers = await getColumnOrder(page);
    expect(headers).toEqual(["ALPHA", "BETA", "GAMMA"]);

    // Verify headers have draggable attribute
    await expect(alphaHeader).toHaveAttribute("draggable", "true");
  });

  test("drag column Alpha after Gamma to reorder", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Wait for columns to render
    const alphaHeader = page
      .locator('[role="columnheader"]')
      .filter({ hasText: "Alpha" });
    const gammaHeader = page
      .locator('[role="columnheader"]')
      .filter({ hasText: "Gamma" });
    await expect(alphaHeader).toBeVisible({ timeout: 10_000 });
    await expect(gammaHeader).toBeVisible({ timeout: 5_000 });

    const alphaHandle = await alphaHeader.elementHandle();
    const gammaHandle = await gammaHeader.elementHandle();

    if (!alphaHandle || !gammaHandle) {
      test.skip(true, "Could not get element handles for drag");
      return;
    }

    // Dispatch the full HTML5 drag sequence in a single evaluate call
    // to avoid DataTransfer and coordinate issues across calls.
    await page.evaluate(
      ([source, target]) => {
        const dt = new DataTransfer();
        dt.effectAllowed = "move";
        dt.setData("text/plain", "");

        // dragstart on source
        source.dispatchEvent(
          new DragEvent("dragstart", {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
          }),
        );

        // Use setTimeout to allow React state to flush between events
        setTimeout(() => {
          const rect = target.getBoundingClientRect();
          dt.dropEffect = "move";

          // dragover on target (right side to insert after)
          target.dispatchEvent(
            new DragEvent("dragover", {
              bubbles: true,
              cancelable: true,
              dataTransfer: dt,
              clientX: rect.right - 5,
              clientY: rect.top + rect.height / 2,
            }),
          );

          setTimeout(() => {
            // drop on target
            target.dispatchEvent(
              new DragEvent("drop", {
                bubbles: true,
                cancelable: true,
                dataTransfer: dt,
              }),
            );

            // dragend on source
            source.dispatchEvent(
              new DragEvent("dragend", {
                bubbles: true,
                cancelable: true,
                dataTransfer: dt,
              }),
            );
          }, 100);
        }, 300);
      },
      [alphaHandle, gammaHandle] as const,
    );

    // Wait for the drag sequence to complete and verify new order: Beta, Gamma, Alpha
    await expect(async () => {
      const newOrder = await getColumnOrder(page);
      expect(newOrder).toEqual(["BETA", "GAMMA", "ALPHA"]);
    }).toPass({ timeout: 10_000 });
  });

  test("column order persists after page reload", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Wait for columns to render
    const alphaHeader = page
      .locator('[role="columnheader"]')
      .filter({ hasText: "Alpha" });
    const gammaHeader = page
      .locator('[role="columnheader"]')
      .filter({ hasText: "Gamma" });
    await expect(alphaHeader).toBeVisible({ timeout: 10_000 });
    await expect(gammaHeader).toBeVisible({ timeout: 5_000 });

    // Perform a drag: move Alpha after Gamma
    const alphaHandle = await alphaHeader.elementHandle();
    const gammaHandle = await gammaHeader.elementHandle();

    if (!alphaHandle || !gammaHandle) {
      test.skip(true, "Could not get element handles for drag");
      return;
    }

    await page.evaluate(
      ([source, target]) => {
        const dt = new DataTransfer();
        dt.effectAllowed = "move";
        dt.setData("text/plain", "");

        source.dispatchEvent(
          new DragEvent("dragstart", {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
          }),
        );

        setTimeout(() => {
          const rect = target.getBoundingClientRect();
          dt.dropEffect = "move";
          target.dispatchEvent(
            new DragEvent("dragover", {
              bubbles: true,
              cancelable: true,
              dataTransfer: dt,
              clientX: rect.right - 5,
              clientY: rect.top + rect.height / 2,
            }),
          );

          setTimeout(() => {
            target.dispatchEvent(
              new DragEvent("drop", {
                bubbles: true,
                cancelable: true,
                dataTransfer: dt,
              }),
            );
            source.dispatchEvent(
              new DragEvent("dragend", {
                bubbles: true,
                cancelable: true,
                dataTransfer: dt,
              }),
            );
          }, 100);
        }, 300);
      },
      [alphaHandle, gammaHandle] as const,
    );

    // Wait for drag sequence + Supabase write to complete
    await expect(async () => {
      const order = await getColumnOrder(page);
      expect(order).toEqual(["BETA", "GAMMA", "ALPHA"]);
    }).toPass({ timeout: 10_000 });

    // Verify optimistic update worked
    const orderBeforeReload = await getColumnOrder(page);
    expect(orderBeforeReload).toEqual(["BETA", "GAMMA", "ALPHA"]);

    // Reload and verify persistence
    await page.reload();
    const reloadedAlpha = page
      .locator('[role="columnheader"]')
      .filter({ hasText: "Alpha" });
    await expect(reloadedAlpha).toBeVisible({ timeout: 15_000 });

    const orderAfterReload = await getColumnOrder(page);
    expect(orderAfterReload).toEqual(["BETA", "GAMMA", "ALPHA"]);
  });
});
