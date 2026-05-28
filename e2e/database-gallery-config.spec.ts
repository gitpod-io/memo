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
// Setup: database with rows, a table view, and a gallery view
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
      title: "Gallery Config Test DB",
      is_database: true,
      position: 9960,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create the default table view
  await admin
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

  // Create a gallery view with default medium card size
  await admin
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

  // Create rows
  const rowTitles = ["Alpha Card", "Beta Card", "Gamma Card"];
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
    page.locator("a").filter({ hasText: "Alpha Card" }),
  ).toBeVisible({ timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Tests — run serially to avoid data race conditions
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("Gallery view card size and cover configuration", () => {
  test("card size dropdown appears in gallery toolbar and changes card size", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToGalleryView(page);

    // Card size dropdown should be visible
    const cardSizeBtn = page.locator('[data-testid="gallery-card-size"]');
    await expect(cardSizeBtn).toBeVisible({ timeout: 5_000 });
    await expect(cardSizeBtn).toContainText("Card size");

    // Get initial card height (medium = h-52 = 208px)
    const firstCard = page.locator("a").filter({ hasText: "Alpha Card" });
    const initialHeight = await firstCard.evaluate((el) => (el as HTMLElement).offsetHeight);

    // Open the dropdown and select "Small"
    await cardSizeBtn.click();
    const smallOption = page.locator('[data-slot="dropdown-menu-radio-item"]', {
      hasText: "Small",
    });
    await expect(smallOption).toBeVisible({ timeout: 5_000 });
    await smallOption.click();

    // Cards should shrink (small = h-40 = 160px)
    await expect(firstCard).toBeVisible({ timeout: 5_000 });
    const smallHeight = await firstCard.evaluate((el) => (el as HTMLElement).offsetHeight);
    expect(smallHeight).toBeLessThan(initialHeight);
  });

  test("card size persists after switching views and back", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToGalleryView(page);

    // Set card size to small
    const cardSizeBtn = page.locator('[data-testid="gallery-card-size"]');
    await expect(cardSizeBtn).toBeVisible({ timeout: 5_000 });
    await cardSizeBtn.click();
    const smallOption = page.locator('[data-slot="dropdown-menu-radio-item"]', {
      hasText: "Small",
    });
    await expect(smallOption).toBeVisible({ timeout: 5_000 });
    await smallOption.click();

    // Wait for the card to reflect the small size
    const firstCard = page.locator("a").filter({ hasText: "Alpha Card" });
    await expect(firstCard).toBeVisible({ timeout: 5_000 });
    const smallHeight = await firstCard.evaluate((el) => (el as HTMLElement).offsetHeight);

    // Switch to table view
    const tableTab = page.getByRole("button", { name: /Table view/i });
    await tableTab.click();
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // Switch back to gallery view
    await switchToGalleryView(page);

    // Card size should still be small
    const cardAfterSwitch = page.locator("a").filter({ hasText: "Alpha Card" });
    await expect(cardAfterSwitch).toBeVisible({ timeout: 5_000 });
    const heightAfterSwitch = await cardAfterSwitch.evaluate(
      (el) => (el as HTMLElement).offsetHeight,
    );
    expect(heightAfterSwitch).toBe(smallHeight);
  });

  test("card size persists after page reload", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToGalleryView(page);

    // Set card size to large
    const cardSizeBtn = page.locator('[data-testid="gallery-card-size"]');
    await expect(cardSizeBtn).toBeVisible({ timeout: 5_000 });
    await cardSizeBtn.click();
    const largeOption = page.locator('[data-slot="dropdown-menu-radio-item"]', {
      hasText: "Large",
    });
    await expect(largeOption).toBeVisible({ timeout: 5_000 });
    await largeOption.click();

    // Wait for the card to reflect the large size
    const firstCard = page.locator("a").filter({ hasText: "Alpha Card" });
    await expect(firstCard).toBeVisible({ timeout: 5_000 });
    const largeHeight = await firstCard.evaluate((el) => (el as HTMLElement).offsetHeight);

    // Reload the page
    await page.reload();
    await expect(
      page.getByRole("button", { name: /Table view/i }),
    ).toBeVisible({ timeout: 15_000 });
    await switchToGalleryView(page);

    // Card size should still be large
    const cardAfterReload = page.locator("a").filter({ hasText: "Alpha Card" });
    await expect(cardAfterReload).toBeVisible({ timeout: 5_000 });
    const heightAfterReload = await cardAfterReload.evaluate(
      (el) => (el as HTMLElement).offsetHeight,
    );
    expect(heightAfterReload).toBe(largeHeight);
  });

  test("cover dropdown appears in gallery toolbar", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToGalleryView(page);

    // Cover dropdown should be visible
    const coverBtn = page.locator('[data-testid="gallery-cover-property"]');
    await expect(coverBtn).toBeVisible({ timeout: 5_000 });
    await expect(coverBtn).toContainText("Cover: None");

    // Open the dropdown — should show "None" option (no files properties exist)
    await coverBtn.click();
    const noneOption = page.locator('[data-slot="dropdown-menu-item"]', {
      hasText: "None",
    });
    await expect(noneOption).toBeVisible({ timeout: 5_000 });
  });
});
