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

// Track IDs for cleanup
let databasePageId: string;
let workspaceSlug: string;
const rowPageIds: string[] = [];

// ---------------------------------------------------------------------------
// Setup: create a database with rows and a gallery view
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
      title: "Gallery Test DB",
      is_database: true,
      position: 9980,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

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

  // Create a gallery view
  const { error: gvErr } = await admin
    .from("database_views")
    .insert({
      database_id: databasePageId,
      name: "Gallery view",
      type: "gallery",
      config: { card_size: "medium" },
      position: 1,
    })
    .select()
    .single();

  if (gvErr)
    throw new Error(`Failed to create gallery view: ${gvErr.message}`);

  // Create rows with titles
  const rowTitles = ["Sunset Photo", "Mountain View", "City Lights"];

  for (let i = 0; i < rowTitles.length; i++) {
    const { data: rowPage, error: rowErr } = await admin
      .from("pages")
      .insert({
        workspace_id: ws.id,
        parent_id: databasePageId,
        title: rowTitles[i],
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

  // Delete any rows added during tests (includes rows from add button)
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

/** Click the Gallery view tab and wait for gallery cards to render. */
async function switchToGalleryView(page: import("@playwright/test").Page) {
  const galleryTab = page.getByRole("button", { name: /Gallery view/i });
  await galleryTab.click();

  // Wait for gallery cards to render — look for the card links with row titles.
  await expect(
    page.locator("a").filter({ hasText: "Sunset Photo" }),
  ).toBeVisible({ timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Tests — run serially to avoid data race conditions
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("Database gallery view", () => {
  test("switch to gallery view via view tabs", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Table view should be active initially — grid is visible
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // Switch to gallery view
    await switchToGalleryView(page);

    // The table grid should no longer be visible
    await expect(page.locator('[role="grid"]')).toBeHidden({
      timeout: 10_000,
    });

    // Gallery cards should be visible — the gallery renders a grid of cards
    await expect(
      page.locator("a").filter({ hasText: "Sunset Photo" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator("a").filter({ hasText: "Mountain View" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator("a").filter({ hasText: "City Lights" }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("gallery cards display with title and cover image placeholder", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToGalleryView(page);

    // Each card should have a title paragraph
    for (const title of ["Sunset Photo", "Mountain View", "City Lights"]) {
      const card = page.locator("a").filter({ hasText: title });
      await expect(card).toBeVisible({ timeout: 5_000 });

      // The card should contain a title text element
      await expect(card.locator("p")).toContainText(title);

      // Since no cover images are set, each card should show the placeholder
      // icon (ImageIcon from lucide-react renders as an SVG)
      await expect(card.locator("svg").first()).toBeVisible({
        timeout: 5_000,
      });
    }
  });

  test("click a gallery card to open the row as a full page", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToGalleryView(page);

    // Click the "Sunset Photo" card
    const card = page.locator("a").filter({ hasText: "Sunset Photo" });
    await expect(card).toBeVisible({ timeout: 5_000 });
    await card.click();

    // Should navigate to the row page — URL should contain the row page ID
    await page.waitForURL(
      (url) => url.pathname.includes(rowPageIds[0]),
      { timeout: 15_000 },
    );

    // The page title input should show "Sunset Photo"
    await expect(page.locator('input[aria-label="Page title"]')).toHaveValue(
      "Sunset Photo",
      { timeout: 10_000 },
    );
  });

  test("create a new row from the gallery view add button", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToGalleryView(page);

    // Count existing cards (links inside the gallery grid)
    const cardsBefore = await page
      .locator("a")
      .filter({ hasText: /Sunset Photo|Mountain View|City Lights|Untitled/ })
      .count();

    // Click the add button (has aria-label "Add new page")
    const addButton = page.locator('button[aria-label="Add new page"]');
    await expect(addButton).toBeVisible({ timeout: 5_000 });
    await addButton.click();

    // Wait for the new card to appear
    await page.waitForTimeout(2_000);

    // A new "Untitled" card should appear in the gallery
    await expect(
      page.locator("a").filter({ hasText: "Untitled" }),
    ).toBeVisible({ timeout: 10_000 });

    // The total card count should have increased
    const cardsAfter = await page
      .locator("a")
      .filter({ hasText: /Sunset Photo|Mountain View|City Lights|Untitled/ })
      .count();
    expect(cardsAfter).toBe(cardsBefore + 1);
  });
});
