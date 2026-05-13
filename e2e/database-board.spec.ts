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

// Track IDs for cleanup
let databasePageId: string;
let workspaceSlug: string;
let selectPropertyId: string;
let boardViewId: string;
const rowPageIds: string[] = [];

// ---------------------------------------------------------------------------
// Setup: create a database with select property, rows, and board view
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
      title: "Board Test DB",
      is_database: true,
      position: 9990,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create a select property (Status)
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

  // Create a board view grouped by the Status property
  const { data: bView, error: bvErr } = await admin
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

  if (bvErr || !bView)
    throw new Error(`Failed to create board view: ${bvErr?.message}`);
  boardViewId = bView.id;

  // Create rows with different Status values
  const rowData = [
    { title: "Task Alpha", optionId: SELECT_OPTIONS[0].id }, // To Do
    { title: "Task Beta", optionId: SELECT_OPTIONS[1].id }, // In Progress
    { title: "Task Gamma", optionId: SELECT_OPTIONS[2].id }, // Done
    { title: "Task Delta", optionId: SELECT_OPTIONS[0].id }, // To Do
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

  // Delete any rows added during tests (includes rows from "+ New" button)
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

/** Click the Board view tab and wait for board columns to render. */
async function switchToBoardView(page: import("@playwright/test").Page) {
  const boardTab = page.getByRole("button", { name: /Board view/i });
  await boardTab.click();

  // Wait for board columns to render — look for the card links.
  // Board columns contain <a> card links with task titles.
  await expect(
    page.locator("a").filter({ hasText: "Task Alpha" }),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * Locate a board column by its header label.
 * Each column has a data-column-label attribute set to the option name.
 */
function getBoardColumn(
  page: import("@playwright/test").Page,
  headerText: string,
) {
  return page.locator(`[data-column-label="${headerText}"]`);
}

// ---------------------------------------------------------------------------
// Tests — run serially to avoid data race conditions
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("Database board view", () => {
  test("switch from table view to board view via view tabs", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Table view should be active initially — grid is visible
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 10_000,
    });

    // Switch to board view
    await switchToBoardView(page);

    // Board cards should be visible
    await expect(
      page.locator("a").filter({ hasText: "Task Alpha" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator("a").filter({ hasText: "Task Beta" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator("a").filter({ hasText: "Task Gamma" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator("a").filter({ hasText: "Task Delta" }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("board columns are grouped by the select property", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToBoardView(page);

    // Verify column headers exist for each select option.
    // The header span contains the option name (e.g. "To Do") rendered
    // uppercase via CSS, followed by a count span.
    for (const option of SELECT_OPTIONS) {
      await expect(
        page.locator("span", { hasText: new RegExp(option.name, "i") }).first(),
      ).toBeVisible({ timeout: 5_000 });
    }

    // "To Do" column should contain "Task Alpha" and "Task Delta"
    // Use locator("a") to match card links (not sidebar buttons)
    const toDoColumn = getBoardColumn(page, "To Do");
    await expect(
      toDoColumn.locator("a").filter({ hasText: "Task Alpha" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      toDoColumn.locator("a").filter({ hasText: "Task Delta" }),
    ).toBeVisible({ timeout: 5_000 });

    // "In Progress" column should contain "Task Beta"
    const inProgressColumn = getBoardColumn(page, "In Progress");
    await expect(
      inProgressColumn.locator("a").filter({ hasText: "Task Beta" }),
    ).toBeVisible({ timeout: 5_000 });

    // "Done" column should contain "Task Gamma"
    const doneColumn = getBoardColumn(page, "Done");
    await expect(
      doneColumn.locator("a").filter({ hasText: "Task Gamma" }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("drag a card from one column to another", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToBoardView(page);

    // Find "Task Beta" card (in "In Progress" column)
    const betaCard = page.locator("a").filter({ hasText: "Task Beta" });
    await expect(betaCard).toBeVisible({ timeout: 5_000 });

    // Find the "Done" column
    const doneColumn = getBoardColumn(page, "Done");
    await expect(doneColumn).toBeVisible({ timeout: 5_000 });

    // Dispatch HTML5 drag events with proper timing.
    // React's board view stores drag state in useState during dragstart,
    // then reads it during drop. We dispatch events with delays to allow
    // React to process state updates between events.
    const cardHandle = await betaCard.elementHandle();
    const colHandle = await doneColumn.elementHandle();

    if (!cardHandle || !colHandle) {
      test.skip(true, "Could not get element handles for drag");
      return;
    }

    // Helper: yield to React's render cycle by waiting two animation frames.
    // React flushes synchronous state updates before the next paint, so two
    // rAF callbacks guarantee the update is committed to the DOM.
    const waitForReactRender = () =>
      page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );

    // Step 1: dragstart on the card — sets React dragState
    await page.evaluate((el) => {
      const dt = new DataTransfer();
      dt.effectAllowed = "move";
      dt.setData("text/plain", "");
      el.dispatchEvent(
        new DragEvent("dragstart", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        }),
      );
    }, cardHandle);

    // Allow React to process the dragstart and update state
    await waitForReactRender();

    // Step 2: dragover on the Done column — sets drop target
    await page.evaluate((el) => {
      const dt = new DataTransfer();
      dt.dropEffect = "move";
      el.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        }),
      );
    }, colHandle);

    await waitForReactRender();

    // Step 3: drop on the Done column — triggers the card move
    await page.evaluate((el) => {
      const dt = new DataTransfer();
      el.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        }),
      );
    }, colHandle);

    await waitForReactRender();

    // Step 4: dragend on the card — cleanup
    await page.evaluate((el) => {
      const dt = new DataTransfer();
      el.dispatchEvent(
        new DragEvent("dragend", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        }),
      );
    }, cardHandle);

    // Verify "Task Beta" is now in the "Done" column
    const updatedDoneColumn = getBoardColumn(page, "Done");
    await expect(
      updatedDoneColumn.locator("a").filter({ hasText: "Task Beta" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("create a new row from within a board column", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);
    await switchToBoardView(page);

    // Find the "In Progress" column
    const inProgressColumn = getBoardColumn(page, "In Progress");
    await expect(inProgressColumn).toBeVisible({ timeout: 5_000 });

    // Get the initial card count
    const countBefore = await inProgressColumn.locator("a").count();

    // Click the "+ New" button inside the column
    const addButton = inProgressColumn.locator("button", {
      hasText: "+ New",
    });
    await expect(addButton).toBeVisible({ timeout: 5_000 });
    await addButton.click();

    // Wait for the new card to appear
    await expect(
      inProgressColumn.locator("a"),
    ).toHaveCount(countBefore + 1, { timeout: 10_000 });

    // The new card should show "Untitled"
    await expect(inProgressColumn.getByText("Untitled")).toBeVisible({
      timeout: 5_000,
    });
  });
});
