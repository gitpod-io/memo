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

const SELECT_OPTIONS_STATUS = [
  { id: crypto.randomUUID(), name: "To Do", color: "blue" },
  { id: crypto.randomUUID(), name: "In Progress", color: "yellow" },
  { id: crypto.randomUUID(), name: "Done", color: "green" },
];

const SELECT_OPTIONS_PRIORITY = [
  { id: crypto.randomUUID(), name: "High", color: "red" },
  { id: crypto.randomUUID(), name: "Medium", color: "orange" },
  { id: crypto.randomUUID(), name: "Low", color: "gray" },
];

const NOW = new Date();
const YEAR = NOW.getFullYear();
const MONTH = NOW.getMonth();

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateInCurrentMonth(day: number): string {
  return `${YEAR}-${pad(MONTH + 1)}-${pad(day)}`;
}

// Track IDs for cleanup
let databasePageId: string;
let workspaceSlug: string;
let statusPropertyId: string;
let priorityPropertyId: string;
let dueDatePropertyId: string;
let createdDatePropertyId: string;
const rowPageIds: string[] = [];

// ---------------------------------------------------------------------------
// Setup: database with two select properties and two date properties
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
      title: "View Config Test DB",
      is_database: true,
      position: 9970,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create Status select property (position 0 — first select)
  const { data: statusProp, error: statusErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Status",
      type: "select",
      config: { options: SELECT_OPTIONS_STATUS },
      position: 0,
    })
    .select()
    .single();

  if (statusErr || !statusProp)
    throw new Error(`Failed to create Status property: ${statusErr?.message}`);
  statusPropertyId = statusProp.id;

  // Create Priority select property (position 1 — second select)
  const { data: priorityProp, error: priorityErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Priority",
      type: "select",
      config: { options: SELECT_OPTIONS_PRIORITY },
      position: 1,
    })
    .select()
    .single();

  if (priorityErr || !priorityProp)
    throw new Error(
      `Failed to create Priority property: ${priorityErr?.message}`,
    );
  priorityPropertyId = priorityProp.id;

  // Create Due Date property (position 2 — first date)
  const { data: dueProp, error: dueErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Due Date",
      type: "date",
      config: {},
      position: 2,
    })
    .select()
    .single();

  if (dueErr || !dueProp)
    throw new Error(
      `Failed to create Due Date property: ${dueErr?.message}`,
    );
  dueDatePropertyId = dueProp.id;

  // Create Created Date property (position 3 — second date)
  const { data: createdProp, error: createdErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Created Date",
      type: "date",
      config: {},
      position: 3,
    })
    .select()
    .single();

  if (createdErr || !createdProp)
    throw new Error(
      `Failed to create Created Date property: ${createdErr?.message}`,
    );
  createdDatePropertyId = createdProp.id;

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

  // Create rows with values for both select and date properties
  const rowData = [
    {
      title: "Task Alpha",
      statusOptionId: SELECT_OPTIONS_STATUS[0].id,
      priorityOptionId: SELECT_OPTIONS_PRIORITY[0].id,
      dueDay: 5,
      createdDay: 1,
    },
    {
      title: "Task Beta",
      statusOptionId: SELECT_OPTIONS_STATUS[1].id,
      priorityOptionId: SELECT_OPTIONS_PRIORITY[1].id,
      dueDay: 12,
      createdDay: 2,
    },
    {
      title: "Task Gamma",
      statusOptionId: SELECT_OPTIONS_STATUS[2].id,
      priorityOptionId: SELECT_OPTIONS_PRIORITY[2].id,
      dueDay: 20,
      createdDay: 3,
    },
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

    // Set Status value
    await admin.from("row_values").insert({
      row_id: rowPage.id,
      property_id: statusPropertyId,
      value: { option_id: row.statusOptionId },
    });

    // Set Priority value
    await admin.from("row_values").insert({
      row_id: rowPage.id,
      property_id: priorityPropertyId,
      value: { option_id: row.priorityOptionId },
    });

    // Set Due Date value
    await admin.from("row_values").insert({
      row_id: rowPage.id,
      property_id: dueDatePropertyId,
      value: { date: dateInCurrentMonth(row.dueDay) },
    });

    // Set Created Date value
    await admin.from("row_values").insert({
      row_id: rowPage.id,
      property_id: createdDatePropertyId,
      value: { date: dateInCurrentMonth(row.createdDay) },
    });
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
// Tests — run serially to avoid data race conditions
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("Board and calendar view configuration", () => {
  test("creating a board view auto-selects the first select property as group_by", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Add a board view via the view tabs
    const addViewBtn = page.locator('button[aria-label="Add view"]');
    await expect(addViewBtn).toBeVisible({ timeout: 5_000 });
    await addViewBtn.click();

    const boardOption = page.locator('[role="menuitem"]', {
      hasText: "Board view",
    });
    await expect(boardOption).toBeVisible({ timeout: 5_000 });
    await boardOption.click();

    // Wait for the board view to render — it should auto-select "Status"
    // as group_by and show board columns (not the placeholder message)
    await expect(
      page.locator("a").filter({ hasText: "Task Alpha" }),
    ).toBeVisible({ timeout: 15_000 });

    // The "Group by" toolbar button should show "Status"
    const groupByBtn = page.locator(
      '[data-testid="view-config-group-by"]',
    );
    await expect(groupByBtn).toBeVisible({ timeout: 5_000 });
    await expect(groupByBtn).toContainText("Status");

    // Board columns should be visible for each Status option
    for (const option of SELECT_OPTIONS_STATUS) {
      await expect(
        page
          .locator("span", { hasText: new RegExp(option.name, "i") })
          .first(),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test("board view Group By dropdown changes the grouping property", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Switch to the Board view tab
    const boardTab = page.getByRole("button", { name: /Board view/i });
    await expect(boardTab).toBeVisible({ timeout: 10_000 });
    await boardTab.click();

    // Wait for board to render with Status grouping
    await expect(
      page.locator("a").filter({ hasText: "Task Alpha" }),
    ).toBeVisible({ timeout: 15_000 });

    // Click the "Group by" dropdown
    const groupByBtn = page.locator(
      '[data-testid="view-config-group-by"]',
    );
    await expect(groupByBtn).toBeVisible({ timeout: 5_000 });
    await groupByBtn.click();

    // Select "Priority" from the dropdown
    const priorityOption = page.locator('[role="menuitem"]', {
      hasText: "Priority",
    });
    await expect(priorityOption).toBeVisible({ timeout: 5_000 });
    await priorityOption.click();

    // Wait for the board to re-render with Priority columns
    await page.waitForTimeout(2_000);

    // The Group by button should now show "Priority"
    await expect(groupByBtn).toContainText("Priority");

    // Priority columns should be visible
    for (const option of SELECT_OPTIONS_PRIORITY) {
      await expect(
        page
          .locator("span", { hasText: new RegExp(option.name, "i") })
          .first(),
      ).toBeVisible({ timeout: 5_000 });
    }

    // Reload and verify persistence
    await page.reload();
    await expect(boardTab).toBeVisible({ timeout: 15_000 });
    await boardTab.click();

    await expect(
      page.locator("a").filter({ hasText: "Task Alpha" }),
    ).toBeVisible({ timeout: 15_000 });

    const groupByBtnAfterReload = page.locator(
      '[data-testid="view-config-group-by"]',
    );
    await expect(groupByBtnAfterReload).toContainText("Priority");
  });

  test("creating a calendar view auto-selects the first date property as date_property", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Add a calendar view via the view tabs
    const addViewBtn = page.locator('button[aria-label="Add view"]');
    await expect(addViewBtn).toBeVisible({ timeout: 5_000 });
    await addViewBtn.click();

    const calendarOption = page.locator('[role="menuitem"]', {
      hasText: "Calendar view",
    });
    await expect(calendarOption).toBeVisible({ timeout: 5_000 });
    await calendarOption.click();

    // Wait for the calendar to render — it should auto-select "Due Date"
    // and show the month/year header (not the placeholder message)
    const FULL_MONTHS = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    await expect(
      page.locator("h2", {
        hasText: `${FULL_MONTHS[MONTH]} ${YEAR}`,
      }),
    ).toBeVisible({ timeout: 15_000 });

    // The "Date property" toolbar button should show "Due Date"
    const datePropBtn = page.locator(
      '[data-testid="view-config-date-property"]',
    );
    await expect(datePropBtn).toBeVisible({ timeout: 5_000 });
    await expect(datePropBtn).toContainText("Due Date");

    // Items should be visible on the calendar
    await expect(
      page.locator("a", { hasText: "Task Alpha" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("calendar view Date Property dropdown changes the date property", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Switch to the Calendar view tab
    const calendarTab = page.getByRole("button", {
      name: /Calendar view/i,
    });
    await expect(calendarTab).toBeVisible({ timeout: 10_000 });
    await calendarTab.click();

    const FULL_MONTHS = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];

    // Wait for calendar to render
    await expect(
      page.locator("h2", {
        hasText: `${FULL_MONTHS[MONTH]} ${YEAR}`,
      }),
    ).toBeVisible({ timeout: 15_000 });

    // Click the "Date property" dropdown
    const datePropBtn = page.locator(
      '[data-testid="view-config-date-property"]',
    );
    await expect(datePropBtn).toBeVisible({ timeout: 5_000 });
    await datePropBtn.click();

    // Select "Created Date" from the dropdown
    const createdDateOption = page.locator('[role="menuitem"]', {
      hasText: "Created Date",
    });
    await expect(createdDateOption).toBeVisible({ timeout: 5_000 });
    await createdDateOption.click();

    // Wait for the calendar to re-render
    await page.waitForTimeout(2_000);

    // The Date property button should now show "Created Date"
    await expect(datePropBtn).toContainText("Created Date");

    // Items should still be visible (they have Created Date values too)
    await expect(
      page.locator("a", { hasText: "Task Alpha" }),
    ).toBeVisible({ timeout: 10_000 });

    // Reload and verify persistence
    await page.reload();
    await expect(calendarTab).toBeVisible({ timeout: 15_000 });
    await calendarTab.click();

    await expect(
      page.locator("h2", {
        hasText: `${FULL_MONTHS[MONTH]} ${YEAR}`,
      }),
    ).toBeVisible({ timeout: 15_000 });

    const datePropBtnAfterReload = page.locator(
      '[data-testid="view-config-date-property"]',
    );
    await expect(datePropBtnAfterReload).toContainText("Created Date");
  });
});
