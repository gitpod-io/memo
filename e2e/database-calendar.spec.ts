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

// Use a fixed month (current month) so items appear on the default calendar view
const NOW = new Date();
const YEAR = NOW.getFullYear();
const MONTH = NOW.getMonth(); // 0-indexed

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Build an ISO date string for a day in the current month. */
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

// Track IDs for cleanup
let databasePageId: string;
let workspaceSlug: string;
let datePropertyId: string;
const rowPageIds: string[] = [];

// Row data: items placed on specific days of the current month
const ROW_DATA = [
  { title: "Standup", day: 3 },
  { title: "Sprint Review", day: 10 },
  { title: "Retro", day: 10 }, // same day as Sprint Review
  { title: "Planning", day: 17 },
];

// ---------------------------------------------------------------------------
// Setup: create a database with a date property, rows, and calendar view
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
      title: "Calendar Test DB",
      is_database: true,
      position: 9980,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create a date property
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

  // Create a calendar view configured with the date property
  const { data: cView, error: cvErr } = await admin
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

  if (cvErr || !cView)
    throw new Error(`Failed to create calendar view: ${cvErr?.message}`);

  // Create rows with date values in the current month
  for (const row of ROW_DATA) {
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

  // Delete all rows (including any created during tests)
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

/** Navigate to the database page and wait for view tabs to load. */
async function navigateToDatabase(page: import("@playwright/test").Page) {
  await page.goto(`/${workspaceSlug}/${databasePageId}`);
  await expect(
    page.getByRole("button", { name: /Table view/i }),
  ).toBeVisible({ timeout: 15_000 });
}

/** Click the Calendar view tab and wait for the calendar grid to render. */
async function switchToCalendarView(page: import("@playwright/test").Page) {
  const calendarTab = page.getByRole("button", { name: /Calendar view/i });
  await calendarTab.click();

  // Wait for the month/year header to appear (e.g. "April 2026")
  await expect(
    page.locator("h2", { hasText: `${FULL_MONTHS[MONTH]} ${YEAR}` }),
  ).toBeVisible({ timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Tests — run serially to avoid data race conditions
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("Database calendar view", () => {
  test("switch to calendar view via view tabs", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Table view should be active initially
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // Switch to calendar view
    await switchToCalendarView(page);

    // The calendar header should show the current month and year
    await expect(
      page.locator("h2", { hasText: `${FULL_MONTHS[MONTH]} ${YEAR}` }),
    ).toBeVisible();

    // Day-of-week headers should be visible
    for (const day of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      await expect(page.locator("div", { hasText: day }).first()).toBeVisible();
    }
  });

  test("items appear on correct date cells", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToCalendarView(page);

    // "Standup" should appear on day 3
    const standupLink = page.locator("a", { hasText: "Standup" });
    await expect(standupLink).toBeVisible({ timeout: 10_000 });

    // "Sprint Review" and "Retro" should both appear (day 10)
    const sprintReviewLink = page.locator("a", { hasText: "Sprint Review" });
    await expect(sprintReviewLink).toBeVisible({ timeout: 5_000 });

    const retroLink = page.locator("a", { hasText: "Retro" });
    await expect(retroLink).toBeVisible({ timeout: 5_000 });

    // "Planning" should appear on day 17
    const planningLink = page.locator("a", { hasText: "Planning" });
    await expect(planningLink).toBeVisible({ timeout: 5_000 });

    // Verify items are in the correct cells by checking the cell that
    // contains the day number also contains the item link.
    // Each calendar cell is a div with a <span> for the day number and
    // item links inside it.

    // Find the cell containing day "3" (current month) with "Standup"
    const day3Cell = page.locator("div").filter({
      has: page.locator("span", { hasText: /^3$/ }),
    }).filter({
      has: page.locator("a", { hasText: "Standup" }),
    });
    await expect(day3Cell.first()).toBeVisible({ timeout: 5_000 });

    // Find the cell containing day "10" with both "Sprint Review" and "Retro"
    const day10Cell = page.locator("div").filter({
      has: page.locator("span", { hasText: /^10$/ }),
    }).filter({
      has: page.locator("a", { hasText: "Sprint Review" }),
    });
    await expect(day10Cell.first()).toBeVisible({ timeout: 5_000 });

    // Day 10 cell should also contain "Retro"
    const day10WithRetro = page.locator("div").filter({
      has: page.locator("span", { hasText: /^10$/ }),
    }).filter({
      has: page.locator("a", { hasText: "Retro" }),
    });
    await expect(day10WithRetro.first()).toBeVisible({ timeout: 5_000 });
  });

  test("navigate to previous and next month", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToCalendarView(page);

    // Current month header should be visible
    await expect(
      page.locator("h2", { hasText: `${FULL_MONTHS[MONTH]} ${YEAR}` }),
    ).toBeVisible();

    // All four items should be visible in the current month
    await expect(
      page.locator("a", { hasText: "Standup" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator("a", { hasText: "Planning" }),
    ).toBeVisible({ timeout: 5_000 });

    // Click "Previous month" button twice to go 2 months back.
    // Going 2 months back ensures items on early days (day 3) don't
    // appear as overflow cells from the adjacent month.
    const prevBtn = page.getByRole("button", { name: "Previous month" });
    await prevBtn.click();

    // Wait for the first month change before clicking again
    let oneBackMonth = MONTH - 1;
    let oneBackYear = YEAR;
    if (oneBackMonth < 0) {
      oneBackMonth += 12;
      oneBackYear -= 1;
    }
    await expect(
      page.locator("h2", {
        hasText: `${FULL_MONTHS[oneBackMonth]} ${oneBackYear}`,
      }),
    ).toBeVisible({ timeout: 5_000 });

    await prevBtn.click();

    // Compute expected month (2 months back)
    let twoBackMonth = MONTH - 2;
    let twoBackYear = YEAR;
    if (twoBackMonth < 0) {
      twoBackMonth += 12;
      twoBackYear -= 1;
    }
    await expect(
      page.locator("h2", {
        hasText: `${FULL_MONTHS[twoBackMonth]} ${twoBackYear}`,
      }),
    ).toBeVisible({ timeout: 5_000 });

    // Items from the current month should not be visible 2 months back
    await expect(
      page.locator("a", { hasText: "Standup" }),
    ).toBeHidden({ timeout: 5_000 });
    await expect(
      page.locator("a", { hasText: "Planning" }),
    ).toBeHidden({ timeout: 5_000 });

    // Navigate forward to return to the current month
    const nextBtn = page.getByRole("button", { name: "Next month" });
    await nextBtn.click();
    await expect(
      page.locator("h2", {
        hasText: `${FULL_MONTHS[oneBackMonth]} ${oneBackYear}`,
      }),
    ).toBeVisible({ timeout: 5_000 });
    await nextBtn.click();

    // Should be back to the current month — items should reappear
    await expect(
      page.locator("h2", { hasText: `${FULL_MONTHS[MONTH]} ${YEAR}` }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator("a", { hasText: "Standup" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator("a", { hasText: "Planning" }),
    ).toBeVisible({ timeout: 5_000 });

    // Navigate forward 2 months past the current month
    let oneAheadMonth = MONTH + 1;
    let oneAheadYear = YEAR;
    if (oneAheadMonth > 11) {
      oneAheadMonth -= 12;
      oneAheadYear += 1;
    }
    await nextBtn.click();
    await expect(
      page.locator("h2", {
        hasText: `${FULL_MONTHS[oneAheadMonth]} ${oneAheadYear}`,
      }),
    ).toBeVisible({ timeout: 5_000 });
    await nextBtn.click();

    let twoAheadMonth = MONTH + 2;
    let twoAheadYear = YEAR;
    if (twoAheadMonth > 11) {
      twoAheadMonth -= 12;
      twoAheadYear += 1;
    }
    await expect(
      page.locator("h2", {
        hasText: `${FULL_MONTHS[twoAheadMonth]} ${twoAheadYear}`,
      }),
    ).toBeVisible({ timeout: 5_000 });

    // Items should not be visible 2 months ahead
    await expect(
      page.locator("a", { hasText: "Standup" }),
    ).toBeHidden({ timeout: 5_000 });
    await expect(
      page.locator("a", { hasText: "Planning" }),
    ).toBeHidden({ timeout: 5_000 });
  });

  test("create a new row from a date cell", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToCalendarView(page);

    // Pick a day that has no items (day 20).
    // The cell contains a <span> with the day number and a <div> for items.
    // Clicking anywhere on the cell (including child elements) should trigger
    // onAddRow — interactive children (links, buttons) call stopPropagation.

    // Count existing "Untitled" links before adding
    const linksBefore = await page.locator("a").filter({
      hasText: "Untitled",
    }).count();

    // Find the cell for day 20 via its gridcell role and day number
    const day20Span = page.locator("span").filter({ hasText: /^20$/ }).first();
    await expect(day20Span).toBeVisible({ timeout: 5_000 });

    // Click the cell — the click may land on a child element (span, div),
    // which is fine since the handler no longer requires e.target === e.currentTarget.
    const day20Cell = day20Span.locator("..");
    await day20Cell.click({ position: { x: 40, y: 60 } });

    // Wait for the async row creation to complete and the new "Untitled"
    // link to appear in the DOM. The row is created via Supabase then
    // optimistically added to state, so we need to poll.
    const untitledLinks = page.locator("a").filter({ hasText: "Untitled" });
    await expect(untitledLinks).toHaveCount(linksBefore + 1, {
      timeout: 10_000,
    });
  });
});
