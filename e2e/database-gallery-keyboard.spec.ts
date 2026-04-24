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
// Setup: database with 6 rows and a gallery view
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
      title: "Gallery Keyboard Test DB",
      is_database: true,
      position: 9970,
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

  // Create gallery view
  const { error: gvErr } = await admin
    .from("database_views")
    .insert({
      database_id: databasePageId,
      name: "Gallery view",
      type: "gallery",
      config: {},
      position: 1,
    })
    .select()
    .single();

  if (gvErr)
    throw new Error(`Failed to create gallery view: ${gvErr?.message}`);

  // Create 6 rows for a 2-column or wider grid
  const titles = [
    "Gallery A",
    "Gallery B",
    "Gallery C",
    "Gallery D",
    "Gallery E",
    "Gallery F",
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

async function switchToGalleryView(page: import("@playwright/test").Page) {
  const galleryTab = page.getByRole("button", { name: /Gallery view/i });
  await galleryTab.click();

  await expect(
    page.locator("a").filter({ hasText: "Gallery A" }),
  ).toBeVisible({ timeout: 15_000 });
}

function getGalleryCard(page: import("@playwright/test").Page, index: number) {
  return page.locator(`[data-gallery-index="${index}"]`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("Gallery view keyboard navigation", () => {
  test("ArrowRight and ArrowLeft navigate between adjacent cards", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToGalleryView(page);

    // Focus the first card (index 0)
    const firstCard = getGalleryCard(page, 0);
    await firstCard.focus();
    await expect(firstCard).toBeFocused({ timeout: 3_000 });

    // Press ArrowRight — should move to index 1
    await page.keyboard.press("ArrowRight");
    const secondCard = getGalleryCard(page, 1);
    await expect(secondCard).toBeFocused({ timeout: 3_000 });

    // Press ArrowLeft — should move back to index 0
    await page.keyboard.press("ArrowLeft");
    await expect(firstCard).toBeFocused({ timeout: 3_000 });
  });

  test("ArrowDown and ArrowUp navigate between rows in the grid", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToGalleryView(page);

    // Focus the first card (index 0)
    const firstCard = getGalleryCard(page, 0);
    await firstCard.focus();
    await expect(firstCard).toBeFocused({ timeout: 3_000 });

    // The gallery grid has at least 2 columns. ArrowDown should jump
    // by the number of columns. At minimum viewport (grid-cols-2),
    // ArrowDown from index 0 goes to index 2.
    await page.keyboard.press("ArrowDown");

    // Determine which card got focus — it should be index 2, 3, or 4
    // depending on the viewport column count (2, 3, or 4 cols).
    // We verify the focused element has a data-gallery-index >= 2.
    const focusedIndex = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.getAttribute("data-gallery-index");
    });
    expect(Number(focusedIndex)).toBeGreaterThanOrEqual(2);

    // Press ArrowUp — should return to index 0
    await page.keyboard.press("ArrowUp");
    await expect(firstCard).toBeFocused({ timeout: 3_000 });
  });

  test("Enter opens the focused card page", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToGalleryView(page);

    // Focus the first card
    const firstCard = getGalleryCard(page, 0);
    await firstCard.focus();
    await expect(firstCard).toBeFocused({ timeout: 3_000 });

    // Press Enter — should navigate to the row page
    await page.keyboard.press("Enter");

    await page.waitForURL(
      (url) => url.pathname.includes(rowPageIds[0]),
      { timeout: 15_000 },
    );
  });

  test("Escape clears card focus", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToGalleryView(page);

    // Focus a card
    const firstCard = getGalleryCard(page, 0);
    await firstCard.focus();
    await expect(firstCard).toBeFocused({ timeout: 3_000 });

    // Press Escape — should clear focus
    await page.keyboard.press("Escape");
    await expect(firstCard).not.toBeFocused({ timeout: 3_000 });
  });

  test("navigation stops at boundaries", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToGalleryView(page);

    // Focus the first card (index 0)
    const firstCard = getGalleryCard(page, 0);
    await firstCard.focus();
    await expect(firstCard).toBeFocused({ timeout: 3_000 });

    // Press ArrowLeft at first card — should stay
    await page.keyboard.press("ArrowLeft");
    await expect(firstCard).toBeFocused({ timeout: 3_000 });

    // Press ArrowUp at first row — should stay
    await page.keyboard.press("ArrowUp");
    await expect(firstCard).toBeFocused({ timeout: 3_000 });

    // Navigate to the last card (index 5)
    const lastCard = getGalleryCard(page, 5);
    await lastCard.focus();
    await expect(lastCard).toBeFocused({ timeout: 3_000 });

    // Press ArrowRight at last card — should stay
    await page.keyboard.press("ArrowRight");
    await expect(lastCard).toBeFocused({ timeout: 3_000 });
  });
});
