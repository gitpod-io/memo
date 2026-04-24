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
  { id: crypto.randomUUID(), name: "To Do", color: "blue" },
  { id: crypto.randomUUID(), name: "In Progress", color: "yellow" },
  { id: crypto.randomUUID(), name: "Done", color: "green" },
];

let databasePageId: string;
let workspaceSlug: string;
let selectPropertyId: string;
const rowPageIds: string[] = [];

// ---------------------------------------------------------------------------
// Setup: database with select property, rows across columns, and board view
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
      title: "Board Keyboard Test DB",
      is_database: true,
      position: 9980,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create select property
  const { data: selectProp, error: propErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Status",
      type: "select",
      config: { options: SELECT_OPTIONS },
      position: 0,
    })
    .select()
    .single();

  if (propErr || !selectProp)
    throw new Error(`Failed to create property: ${propErr?.message}`);
  selectPropertyId = selectProp.id;

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

  // Create board view
  const { error: bvErr } = await admin
    .from("database_views")
    .insert({
      database_id: databasePageId,
      name: "Board view",
      type: "board",
      config: { group_by: selectPropertyId },
      position: 1,
    })
    .select()
    .single();

  if (bvErr) throw new Error(`Failed to create board view: ${bvErr?.message}`);

  // Create rows: 2 in "To Do", 1 in "In Progress", 1 in "Done"
  const rowData = [
    { title: "Card A", optionId: SELECT_OPTIONS[0].id },
    { title: "Card B", optionId: SELECT_OPTIONS[0].id },
    { title: "Card C", optionId: SELECT_OPTIONS[1].id },
    { title: "Card D", optionId: SELECT_OPTIONS[2].id },
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

    const { error: valErr } = await admin.from("row_values").insert({
      row_id: rowPage.id,
      property_id: selectPropertyId,
      value: { option_id: row.optionId },
    });

    if (valErr)
      throw new Error(`Failed to set row value: ${valErr.message}`);
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

async function switchToBoardView(page: import("@playwright/test").Page) {
  const boardTab = page.getByRole("button", { name: /Board view/i });
  await boardTab.click();

  await expect(
    page.locator("a").filter({ hasText: "Card A" }),
  ).toBeVisible({ timeout: 15_000 });
}

function getCard(page: import("@playwright/test").Page, col: number, row: number) {
  return page.locator(`[data-board-col="${col}"][data-board-row="${row}"]`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("Board view keyboard navigation", () => {
  test("arrow keys navigate between cards within a column", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToBoardView(page);

    // Focus the first card in the "To Do" column (col 0, row 0)
    const firstCard = getCard(page, 0, 0);
    await firstCard.focus();
    await expect(firstCard).toBeFocused({ timeout: 3_000 });

    // Press ArrowDown — should move to second card in same column (col 0, row 1)
    await page.keyboard.press("ArrowDown");
    const secondCard = getCard(page, 0, 1);
    await expect(secondCard).toBeFocused({ timeout: 3_000 });

    // Press ArrowUp — should move back to first card (col 0, row 0)
    await page.keyboard.press("ArrowUp");
    await expect(firstCard).toBeFocused({ timeout: 3_000 });
  });

  test("arrow keys navigate between columns", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToBoardView(page);

    // Focus the first card in "To Do" column (col 0, row 0)
    const firstCard = getCard(page, 0, 0);
    await firstCard.focus();
    await expect(firstCard).toBeFocused({ timeout: 3_000 });

    // Press ArrowRight — should move to "In Progress" column (col 1, row 0)
    await page.keyboard.press("ArrowRight");
    const inProgressCard = getCard(page, 1, 0);
    await expect(inProgressCard).toBeFocused({ timeout: 3_000 });

    // Press ArrowRight — should move to "Done" column (col 2, row 0)
    await page.keyboard.press("ArrowRight");
    const doneCard = getCard(page, 2, 0);
    await expect(doneCard).toBeFocused({ timeout: 3_000 });

    // Press ArrowLeft — should move back to "In Progress" (col 1, row 0)
    await page.keyboard.press("ArrowLeft");
    await expect(inProgressCard).toBeFocused({ timeout: 3_000 });
  });

  test("Enter opens the focused card page", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToBoardView(page);

    // Focus the first card in "To Do" column
    const firstCard = getCard(page, 0, 0);
    await firstCard.focus();
    await expect(firstCard).toBeFocused({ timeout: 3_000 });

    // Press Enter — should navigate to the row page
    await page.keyboard.press("Enter");

    // Should navigate to a row page URL
    await page.waitForURL(
      (url) => url.pathname.includes(rowPageIds[0]),
      { timeout: 15_000 },
    );
  });

  test("Escape clears card focus", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToBoardView(page);

    // Focus a card
    const firstCard = getCard(page, 0, 0);
    await firstCard.focus();
    await expect(firstCard).toBeFocused({ timeout: 3_000 });

    // Press Escape — should clear focus
    await page.keyboard.press("Escape");
    await expect(firstCard).not.toBeFocused({ timeout: 3_000 });
  });

  test("navigation stops at column boundaries", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToBoardView(page);

    // Focus the first card in "To Do" (col 0, row 0)
    const firstCard = getCard(page, 0, 0);
    await firstCard.focus();
    await expect(firstCard).toBeFocused({ timeout: 3_000 });

    // Press ArrowUp at top — should stay on same card
    await page.keyboard.press("ArrowUp");
    await expect(firstCard).toBeFocused({ timeout: 3_000 });

    // Navigate to last card in "To Do" (col 0, row 1)
    await page.keyboard.press("ArrowDown");
    const lastCard = getCard(page, 0, 1);
    await expect(lastCard).toBeFocused({ timeout: 3_000 });

    // Press ArrowDown at bottom — should stay on same card
    await page.keyboard.press("ArrowDown");
    await expect(lastCard).toBeFocused({ timeout: 3_000 });
  });

  test("ArrowLeft at first column stays on same card", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToBoardView(page);

    // Focus the first card in "To Do" (col 0, row 0)
    const firstCard = getCard(page, 0, 0);
    await firstCard.focus();
    await expect(firstCard).toBeFocused({ timeout: 3_000 });

    // Press ArrowLeft at leftmost column — should stay
    await page.keyboard.press("ArrowLeft");
    await expect(firstCard).toBeFocused({ timeout: 3_000 });
  });
});
