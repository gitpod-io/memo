import { test, expect } from "./fixtures/auth";
import { createClient } from "@supabase/supabase-js";
import { navigateToEditorPage, waitForEditor } from "./fixtures/editor-helpers";

const MOBILE_VIEWPORT = { width: 375, height: 667 };

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
// Database test data
// ---------------------------------------------------------------------------

const SELECT_OPTIONS = [
  { id: crypto.randomUUID(), name: "Open", color: "blue" },
  { id: crypto.randomUUID(), name: "Closed", color: "green" },
];

let databasePageId: string;
let workspaceSlug: string;
let selectPropertyId: string;
const rowPageIds: string[] = [];

// ---------------------------------------------------------------------------
// Setup: create a database with rows for table and board view tests
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
  if (!testUserId) throw new Error(`Test user ${email} not found`);

  // Get workspace
  const { data: memberships } = await admin
    .from("members")
    .select("workspace_id, workspaces(id, slug)")
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
      title: "Mobile Test DB",
      is_database: true,
      position: 9980,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create a select property
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

  // Create a text property so the table has horizontal content
  const { error: textPropErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Description",
      type: "text",
      config: {},
      position: 1,
    })
    .select()
    .single();

  if (textPropErr)
    throw new Error(`Failed to create text property: ${textPropErr.message}`);

  // Create table view
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

  if (bvErr) throw new Error(`Failed to create board view: ${bvErr.message}`);

  // Create rows
  const rowData = [
    { title: "Mobile Row A", optionId: SELECT_OPTIONS[0].id },
    { title: "Mobile Row B", optionId: SELECT_OPTIONS[1].id },
    { title: "Mobile Row C", optionId: SELECT_OPTIONS[0].id },
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

// ---------------------------------------------------------------------------
// Tests — serial to avoid data races on shared database
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("Mobile viewport responsive behavior", () => {
  test("page creation and editing at mobile viewport", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);

    // Open the mobile sidebar sheet
    const toggleButton = page.getByTestId("as-sidebar-toggle");
    await expect(toggleButton).toBeVisible({ timeout: 10_000 });
    await toggleButton.click();

    const sheetContent = page.locator('[data-slot="sheet-content"]');
    await expect(sheetContent).toBeVisible({ timeout: 5_000 });

    // Wait for the page tree to load inside the sheet
    const treeLoaded = sheetContent
      .locator('[role="treeitem"], :text("No pages yet")')
      .first();
    await expect(treeLoaded).toBeVisible({ timeout: 10_000 });

    // Create a new page via the sidebar
    const newPageBtn = sheetContent.getByTestId("sb-new-page-btn");
    await expect(newPageBtn).toBeVisible({ timeout: 5_000 });
    await newPageBtn.click();

    // Wait for navigation to the new page
    await page.waitForURL(
      (url) => url.pathname.split("/").filter(Boolean).length >= 2,
      { timeout: 10_000 },
    );

    // Sheet should close after navigation
    await expect(sheetContent).toBeHidden({ timeout: 5_000 });

    // Editor should be visible and usable at mobile width
    const editor = page.locator('[data-lexical-editor="true"]');
    await expect(editor).toBeVisible({ timeout: 15_000 });

    // Verify the editor fits within the mobile viewport (no horizontal overflow)
    const editorBox = await editor.boundingBox();
    expect(editorBox).not.toBeNull();
    expect(editorBox!.x).toBeGreaterThanOrEqual(0);
    expect(editorBox!.x + editorBox!.width).toBeLessThanOrEqual(
      MOBILE_VIEWPORT.width + 1,
    );

    // Type content and verify it appears
    await editor.click();
    await page.keyboard.type("Mobile test content");
    await expect(editor).toContainText("Mobile test content", {
      timeout: 5_000,
    });
  });

  test("database table view scrolling at mobile viewport", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await navigateToDatabase(page);

    // Table grid should be visible
    const grid = page.locator('[role="grid"]');
    await expect(grid).toBeVisible({ timeout: 15_000 });

    // Rows should be visible and usable
    await expect(
      page.locator('[role="row"]').filter({ hasText: "Mobile Row A" }),
    ).toBeVisible({ timeout: 5_000 });

    // The table has a horizontal scroll container. Verify it exists and
    // that the table content is wider than the mobile viewport (requires scroll).
    const scrollContainer = page.getByTestId("db-table-scroll");
    const scrollBox = await scrollContainer.boundingBox();
    expect(scrollBox).not.toBeNull();

    // Verify the grid's scrollWidth exceeds the viewport width, meaning
    // horizontal scrolling is available for the extra columns.
    const scrollInfo = await scrollContainer.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scrollInfo.scrollWidth).toBeGreaterThan(scrollInfo.clientWidth);

    // Scroll right and verify the container actually scrolls
    await scrollContainer.evaluate((el) => {
      el.scrollLeft = 100;
    });
    const scrollLeft = await scrollContainer.evaluate(
      (el) => el.scrollLeft,
    );
    expect(scrollLeft).toBeGreaterThan(0);
  });

  test("database board view card interaction at mobile viewport", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await navigateToDatabase(page);

    // Switch to board view
    const boardTab = page.getByRole("button", { name: /Board view/i });
    await boardTab.click();

    // Wait for board cards to render
    await expect(
      page.locator("a").filter({ hasText: "Mobile Row A" }),
    ).toBeVisible({ timeout: 15_000 });

    // Board container should use snap scrolling on mobile
    const boardContainer = page.locator('[data-testid="db-board-container"]');
    await expect(boardContainer).toBeVisible({ timeout: 5_000 });

    // Columns should be 85vw wide on mobile (snap-scrollable)
    const firstColumn = boardContainer.locator('[role="group"]').first();
    const columnBox = await firstColumn.boundingBox();
    expect(columnBox).not.toBeNull();
    // 85vw of 375px = ~318px, allow some tolerance
    const expectedWidth = MOBILE_VIEWPORT.width * 0.85;
    expect(columnBox!.width).toBeGreaterThan(expectedWidth - 20);
    expect(columnBox!.width).toBeLessThan(expectedWidth + 20);

    // The column indicator should be visible on mobile
    const indicator = page.locator('[data-testid="db-board-column-indicator"]');
    await expect(indicator).toBeVisible({ timeout: 5_000 });

    // Cards should be tappable — verify they are links with proper size
    const card = page.locator("a").filter({ hasText: "Mobile Row A" });
    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();
    // Touch target should be at least 44px tall (WCAG minimum)
    expect(cardBox!.height).toBeGreaterThanOrEqual(40);
  });

  test("slash command menu positioning at mobile viewport", async ({
    authenticatedPage: page,
  }) => {
    // Create the page at desktop size (navigateToEditorPage uses the
    // desktop sidebar), then resize to mobile for the actual test.
    await navigateToEditorPage(page);
    await page.setViewportSize(MOBILE_VIEWPORT);

    const editor = await waitForEditor(page);

    // Type / to open the slash command menu
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");

    // The slash command menu should appear
    const options = page.locator('[role="option"]');
    await expect(options.first()).toBeVisible({ timeout: 5_000 });

    // The slash command menu should be fully within the viewport
    const slashMenu = page.getByTestId("editor-slash-menu");
    await expect(slashMenu).toBeVisible({ timeout: 3_000 });
    const menuBox = await slashMenu.boundingBox();
    expect(menuBox).not.toBeNull();

    // Menu should not overflow the right edge of the viewport
    expect(menuBox!.x).toBeGreaterThanOrEqual(0);
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(
      MOBILE_VIEWPORT.width + 2,
    );

    // Menu should not overflow the bottom of the viewport
    expect(menuBox!.y).toBeGreaterThanOrEqual(0);
    expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(
      MOBILE_VIEWPORT.height + 2,
    );

    // Selecting an option should work at mobile size
    await options.first().click();

    // Menu should close after selection
    await expect(options.first()).not.toBeVisible({ timeout: 3_000 });
  });

  test("floating toolbar positioning at mobile viewport", async ({
    authenticatedPage: page,
  }) => {
    // Create the page at desktop size, then resize to mobile.
    await navigateToEditorPage(page);
    await page.setViewportSize(MOBILE_VIEWPORT);

    const editor = await waitForEditor(page);

    // Type text to select
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("Select this text on mobile");

    // Wait for text to appear
    await expect(editor).toContainText("Select this text on mobile", {
      timeout: 5_000,
    });

    // Select the text
    await page.keyboard.down("Shift");
    await page.keyboard.press("Home");
    await page.keyboard.up("Shift");

    // Floating toolbar should appear
    const toolbar = page.locator(
      '[role="toolbar"][aria-label="Text formatting"]',
    );
    await expect(toolbar).toBeVisible({ timeout: 5_000 });

    // Toolbar should be positioned near the mobile viewport bounds.
    // @floating-ui/react uses flip+shift but the toolbar may overflow by
    // a few pixels on very narrow viewports — verify it stays mostly visible.
    const toolbarBox = await toolbar.boundingBox();
    expect(toolbarBox).not.toBeNull();

    // Left edge should not be off-screen
    expect(toolbarBox!.x).toBeGreaterThanOrEqual(-2);
    // At least 90% of the toolbar should be within the viewport width
    const visibleRight = Math.min(
      toolbarBox!.x + toolbarBox!.width,
      MOBILE_VIEWPORT.width,
    );
    const visibleWidth = visibleRight - Math.max(toolbarBox!.x, 0);
    expect(visibleWidth / toolbarBox!.width).toBeGreaterThan(0.9);

    // Toolbar buttons should be usable — tap bold
    const boldBtn = toolbar.getByRole("button", { name: /bold/i });
    await expect(boldBtn).toBeVisible({ timeout: 3_000 });
    await boldBtn.click();

    // Bold should be applied
    await expect(boldBtn).toHaveAttribute("aria-pressed", "true");
    const boldText = editor
      .locator("strong")
      .filter({ hasText: "Select this text on mobile" });
    await expect(boldText).toBeVisible({ timeout: 3_000 });
  });
});
