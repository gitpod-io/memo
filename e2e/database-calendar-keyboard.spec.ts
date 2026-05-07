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

const NOW = new Date();
const YEAR = NOW.getFullYear();
const MONTH = NOW.getMonth(); // 0-indexed

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateInCurrentMonth(day: number): string {
  return `${YEAR}-${pad(MONTH + 1)}-${pad(day)}`;
}

const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

let databasePageId: string;
let workspaceSlug: string;
let datePropertyId: string;
const rowPageIds: string[] = [];

// Place items on days that are guaranteed to be in the current month grid.
// Day 8 has 2 items (for item-level navigation testing).
const ROW_DATA = [
  { title: "Cal KB Item A", day: 8 },
  { title: "Cal KB Item B", day: 8 },
  { title: "Cal KB Item C", day: 15 },
];

// ---------------------------------------------------------------------------
// Setup: database with date property, calendar view, and rows
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
      title: "Calendar Keyboard Test DB",
      is_database: true,
      position: 9960,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create date property
  const { data: dateProp, error: propErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Due Date",
      type: "date",
      config: {},
      position: 0,
    })
    .select()
    .single();

  if (propErr || !dateProp)
    throw new Error(`Failed to create date property: ${propErr?.message}`);
  datePropertyId = dateProp.id;

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

  // Create calendar view
  const { error: cvErr } = await admin
    .from("database_views")
    .insert({
      database_id: databasePageId,
      name: "Calendar view",
      type: "calendar",
      config: { date_property: datePropertyId },
      position: 1,
    })
    .select()
    .single();

  if (cvErr)
    throw new Error(`Failed to create calendar view: ${cvErr?.message}`);

  // Create rows with date values
  for (let i = 0; i < ROW_DATA.length; i++) {
    const row = ROW_DATA[i];
    const { data: rowPage, error: rowErr } = await admin
      .from("pages")
      .insert({
        workspace_id: ws.id,
        parent_id: databasePageId,
        title: row.title,
        is_database: false,
        position: i,
        created_by: testUserId,
      })
      .select()
      .single();

    if (rowErr || !rowPage)
      throw new Error(`Failed to create row: ${rowErr?.message}`);
    rowPageIds.push(rowPage.id);

    const { error: valErr } = await admin.from("row_values").insert({
      row_id: rowPage.id,
      property_id: datePropertyId,
      value: { date: dateInCurrentMonth(row.day) },
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

async function switchToCalendarView(page: import("@playwright/test").Page) {
  const calendarTab = page.getByRole("button", { name: /Calendar view/i });
  await calendarTab.click();

  await expect(
    page.locator("h2", { hasText: `${FULL_MONTHS[MONTH]} ${YEAR}` }),
  ).toBeVisible({ timeout: 15_000 });
}

function getCalendarCell(page: import("@playwright/test").Page, index: number) {
  return page.locator(`[data-calendar-index="${index}"]`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("Calendar view keyboard navigation", () => {
  test("ArrowRight and ArrowLeft navigate between day cells", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToCalendarView(page);

    // Focus the first cell (index 0)
    const firstCell = getCalendarCell(page, 0);
    await firstCell.focus();
    await expect(firstCell).toBeFocused({ timeout: 3_000 });

    // Press ArrowRight — should move to index 1
    await page.keyboard.press("ArrowRight");
    const secondCell = getCalendarCell(page, 1);
    await expect(secondCell).toBeFocused({ timeout: 3_000 });

    // Press ArrowLeft — should move back to index 0
    await page.keyboard.press("ArrowLeft");
    await expect(firstCell).toBeFocused({ timeout: 3_000 });
  });

  test("ArrowDown and ArrowUp navigate between weeks", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToCalendarView(page);

    // Focus cell at index 2 (first row)
    const cell2 = getCalendarCell(page, 2);
    await cell2.focus();
    await expect(cell2).toBeFocused({ timeout: 3_000 });

    // ArrowDown should jump to index 9 (same column, next week)
    await page.keyboard.press("ArrowDown");
    const cell9 = getCalendarCell(page, 9);
    await expect(cell9).toBeFocused({ timeout: 3_000 });

    // ArrowUp should return to index 2
    await page.keyboard.press("ArrowUp");
    await expect(cell2).toBeFocused({ timeout: 3_000 });
  });

  test("Home and End navigate within the week row", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToCalendarView(page);

    // Focus cell at index 3 (middle of first row)
    const cell3 = getCalendarCell(page, 3);
    await cell3.focus();
    await expect(cell3).toBeFocused({ timeout: 3_000 });

    // Home should move to index 0 (start of week)
    await page.keyboard.press("Home");
    const cell0 = getCalendarCell(page, 0);
    await expect(cell0).toBeFocused({ timeout: 3_000 });

    // End should move to index 6 (end of week)
    await page.keyboard.press("End");
    const cell6 = getCalendarCell(page, 6);
    await expect(cell6).toBeFocused({ timeout: 3_000 });
  });

  test("Enter on a cell with items focuses the first item, Enter on item navigates to page", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToCalendarView(page);

    // Find the cell that contains "Cal KB Item A" by looking for the
    // data-calendar-index attribute on the cell containing that text.
    const itemALink = page.locator("a", { hasText: "Cal KB Item A" });
    await expect(itemALink).toBeVisible({ timeout: 10_000 });

    // Get the parent cell's data-calendar-index
    const cellWithItems = itemALink.locator("xpath=ancestor::div[@data-calendar-index]");
    const cellIndex = await cellWithItems.getAttribute("data-calendar-index");

    // Focus the cell
    const cell = getCalendarCell(page, Number(cellIndex));
    await cell.focus();
    await expect(cell).toBeFocused({ timeout: 3_000 });

    // Press Enter — should focus the first item (data-calendar-item="0")
    await page.keyboard.press("Enter");
    const firstItem = cell.locator('[data-calendar-item="0"]');
    await expect(firstItem).toBeFocused({ timeout: 3_000 });

    // Press Enter on the focused item — should navigate to the row page
    await page.keyboard.press("Enter");
    await page.waitForURL(
      (url) => url.pathname.includes(rowPageIds[0]),
      { timeout: 15_000 },
    );
  });

  test("Escape returns focus from item to cell", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToCalendarView(page);

    // Find the cell with items
    const itemALink = page.locator("a", { hasText: "Cal KB Item A" });
    await expect(itemALink).toBeVisible({ timeout: 10_000 });

    const cellWithItems = itemALink.locator("xpath=ancestor::div[@data-calendar-index]");
    const cellIndex = await cellWithItems.getAttribute("data-calendar-index");

    const cell = getCalendarCell(page, Number(cellIndex));
    await cell.focus();
    await expect(cell).toBeFocused({ timeout: 3_000 });

    // Enter to focus first item
    await page.keyboard.press("Enter");
    const firstItem = cell.locator('[data-calendar-item="0"]');
    await expect(firstItem).toBeFocused({ timeout: 3_000 });

    // Escape should return focus to the cell
    await page.keyboard.press("Escape");
    await expect(cell).toBeFocused({ timeout: 3_000 });
  });

  test("Escape from a cell clears focus entirely", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToCalendarView(page);

    const cell0 = getCalendarCell(page, 0);
    await cell0.focus();
    await expect(cell0).toBeFocused({ timeout: 3_000 });

    // Escape should clear focus
    await page.keyboard.press("Escape");
    await expect(cell0).not.toBeFocused({ timeout: 3_000 });
  });

  test("focused cell has a visible focus ring", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToCalendarView(page);

    const cell0 = getCalendarCell(page, 0);
    await cell0.focus();
    await expect(cell0).toBeFocused({ timeout: 3_000 });

    // The focused cell should have the ring-2 class applied
    await expect(cell0).toHaveClass(/ring-2/, { timeout: 3_000 });
  });
});
