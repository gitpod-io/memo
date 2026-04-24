import { test, expect } from "./fixtures/auth";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Admin client for cleanup
// ---------------------------------------------------------------------------

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const createdDatabaseIds: string[] = [];

test.afterAll(async () => {
  if (createdDatabaseIds.length === 0) return;
  const admin = getAdminClient();
  for (const id of createdDatabaseIds) {
    await admin.from("pages").delete().eq("id", id);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForSidebarTree(page: import("@playwright/test").Page) {
  const sidebar = page.getByRole("complementary");
  const treeLoaded = sidebar
    .locator('[role="treeitem"], :text("No pages yet")')
    .first();
  await expect(treeLoaded).toBeVisible({ timeout: 15_000 });
  return sidebar;
}

async function createDatabaseFromSidebar(
  page: import("@playwright/test").Page,
): Promise<string> {
  const sidebar = await waitForSidebarTree(page);

  const newDbBtn = sidebar.getByRole("button", { name: /new database/i });
  await expect(newDbBtn).toBeVisible({ timeout: 5_000 });
  await newDbBtn.click();

  await page.waitForURL(
    (url) => url.pathname.split("/").filter(Boolean).length >= 2,
    { timeout: 15_000 },
  );

  const dbLoaded = page
    .locator('[role="grid"], :text("No rows yet")')
    .first();
  await expect(dbLoaded).toBeVisible({ timeout: 15_000 });

  const pathParts = new URL(page.url()).pathname.split("/").filter(Boolean);
  const pageId = pathParts[pathParts.length - 1];
  createdDatabaseIds.push(pageId);
  return pageId;
}

async function addRow(page: import("@playwright/test").Page) {
  const addRowBtn = page.locator("button", { hasText: "+ New" });
  await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
  await addRowBtn.click();
  await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 10_000 });
}

async function addColumnOfType(
  page: import("@playwright/test").Page,
  typeName: string,
) {
  const addColumnBtn = page.locator('button[aria-label="Add column"]');
  await expect(addColumnBtn).toBeVisible({ timeout: 5_000 });
  await addColumnBtn.click();

  const menuItem = page.getByRole("menuitem", { name: typeName, exact: true });
  await expect(menuItem).toBeVisible({ timeout: 5_000 });
  await menuItem.click();

  // Wait for the menu to close (column added)
  await expect(menuItem).not.toBeVisible({ timeout: 5_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Type-specific database filter operators", () => {
  test("checkbox filter shows is_checked / is_not_checked operators without value input", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRow(page);
    await addColumnOfType(page, "Checkbox");

    // Open filter flow
    const addFilterBtn = page.locator("button", { hasText: "Add filter" });
    await expect(addFilterBtn).toBeVisible({ timeout: 5_000 });
    await addFilterBtn.click();

    // Pick the Checkbox column
    const filterDropdown = page.locator(".z-50").first();
    await expect(filterDropdown).toBeVisible({ timeout: 5_000 });
    const checkboxOption = filterDropdown.locator("button", {
      hasText: "Checkbox",
    });
    await expect(checkboxOption).toBeVisible({ timeout: 5_000 });
    await checkboxOption.click();

    // Operator picker should show "is checked" and "is not checked"
    const operatorDropdown = page.locator(".z-50").first();
    await expect(operatorDropdown).toBeVisible({ timeout: 5_000 });

    const isCheckedOp = operatorDropdown.locator("button", {
      hasText: "is checked",
    });
    const isNotCheckedOp = operatorDropdown.locator("button", {
      hasText: "is not checked",
    });
    await expect(isCheckedOp).toBeVisible({ timeout: 5_000 });
    await expect(isNotCheckedOp).toBeVisible({ timeout: 5_000 });

    // Click "is checked" — should add filter immediately (no value step)
    await isCheckedOp.click();

    // Filter badge should appear with "is checked" label
    const badge = page.locator('[data-slot="badge"]', {
      hasText: "is checked",
    });
    await expect(badge).toBeVisible({ timeout: 5_000 });
  });

  test("number filter shows numeric operators and number input", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRow(page);
    await addColumnOfType(page, "Number");

    // Open filter flow
    const addFilterBtn = page.locator("button", { hasText: "Add filter" });
    await expect(addFilterBtn).toBeVisible({ timeout: 5_000 });
    await addFilterBtn.click();

    // Pick the Number column
    const filterDropdown = page.locator(".z-50").first();
    await expect(filterDropdown).toBeVisible({ timeout: 5_000 });
    const numberOption = filterDropdown.locator("button", {
      hasText: "Number",
    });
    await expect(numberOption).toBeVisible({ timeout: 5_000 });
    await numberOption.click();

    // Operator picker should show numeric operators
    const operatorDropdown = page.locator(".z-50").first();
    await expect(operatorDropdown).toBeVisible({ timeout: 5_000 });

    // Verify numeric operators are present
    await expect(
      operatorDropdown.locator("button", { hasText: /^is$/ }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      operatorDropdown.locator("button", { hasText: ">" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      operatorDropdown.locator("button", { hasText: "<" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      operatorDropdown.locator("button", { hasText: "≥" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      operatorDropdown.locator("button", { hasText: "≤" }),
    ).toBeVisible({ timeout: 5_000 });

    // Pick ">" operator
    await operatorDropdown.locator("button", { hasText: ">" }).click();

    // Value input should be a number input
    const numberInput = page.locator('input[placeholder="Enter number…"]');
    await expect(numberInput).toBeVisible({ timeout: 5_000 });
    await expect(numberInput).toHaveAttribute("type", "number");

    // Fill and apply
    await numberInput.fill("10");
    const applyBtn = page.locator(".z-50 button", { hasText: "Apply" });
    await applyBtn.click();

    // Filter badge should appear
    const badge = page.locator('[data-slot="badge"]', { hasText: ">" });
    await expect(badge).toBeVisible({ timeout: 5_000 });
  });

  test("date filter shows date operators and date input", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRow(page);
    await addColumnOfType(page, "Date");

    // Open filter flow
    const addFilterBtn = page.locator("button", { hasText: "Add filter" });
    await expect(addFilterBtn).toBeVisible({ timeout: 5_000 });
    await addFilterBtn.click();

    // Pick the Date column
    const filterDropdown = page.locator(".z-50").first();
    await expect(filterDropdown).toBeVisible({ timeout: 5_000 });
    const dateOption = filterDropdown.locator("button", { hasText: "Date" });
    await expect(dateOption).toBeVisible({ timeout: 5_000 });
    await dateOption.click();

    // Operator picker should show date operators
    const operatorDropdown = page.locator(".z-50").first();
    await expect(operatorDropdown).toBeVisible({ timeout: 5_000 });

    await expect(
      operatorDropdown.locator("button", { hasText: "before" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      operatorDropdown.locator("button", { hasText: "after" }),
    ).toBeVisible({ timeout: 5_000 });

    // Pick "before" operator
    await operatorDropdown.locator("button", { hasText: "before" }).click();

    // Custom DatePicker calendar should appear (not a native date input)
    const calendarPicker = page.locator(".z-50").first();
    await expect(calendarPicker).toBeVisible({ timeout: 5_000 });

    // Should show month navigation and a "Today" button
    const prevMonthBtn = calendarPicker.getByRole("button", { name: "Previous month" });
    const nextMonthBtn = calendarPicker.getByRole("button", { name: "Next month" });
    const todayBtn = calendarPicker.locator("button", { hasText: "Today" });
    await expect(prevMonthBtn).toBeVisible({ timeout: 5_000 });
    await expect(nextMonthBtn).toBeVisible({ timeout: 5_000 });
    await expect(todayBtn).toBeVisible({ timeout: 5_000 });

    // Native date input should NOT be present
    await expect(page.locator('input[type="date"]')).toBeHidden();

    // Click "Today" to select today's date and apply the filter
    await todayBtn.click();

    // Filter badge should appear
    const badge = page.locator('[data-slot="badge"]', { hasText: "before" });
    await expect(badge).toBeVisible({ timeout: 5_000 });
  });

  test("select filter shows option dropdown instead of text input", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);
    await addRow(page);
    await addColumnOfType(page, "Select");

    // Open filter flow
    const addFilterBtn = page.locator("button", { hasText: "Add filter" });
    await expect(addFilterBtn).toBeVisible({ timeout: 5_000 });
    await addFilterBtn.click();

    // Pick the Select column
    const filterDropdown = page.locator(".z-50").first();
    await expect(filterDropdown).toBeVisible({ timeout: 5_000 });
    const selectOption = filterDropdown.locator("button", {
      hasText: "Select",
    });
    await expect(selectOption).toBeVisible({ timeout: 5_000 });
    await selectOption.click();

    // Operator picker should show select operators (is, is empty, is not empty)
    const operatorDropdown = page.locator(".z-50").first();
    await expect(operatorDropdown).toBeVisible({ timeout: 5_000 });

    await expect(
      operatorDropdown.locator("button", { hasText: /^is$/ }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      operatorDropdown.locator("button", { hasText: "is empty" }),
    ).toBeVisible({ timeout: 5_000 });

    // "contains" should NOT be present for select type
    await expect(
      operatorDropdown.locator("button", { hasText: /^contains$/ }),
    ).toBeHidden();

    // Pick "is" operator
    await operatorDropdown.locator("button", { hasText: /^is$/ }).click();

    // Value editor should show a search input for options (not a plain text input)
    const searchInput = page.locator('input[placeholder="Search options…"]');
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Should show "No options" since no options have been created yet
    await expect(
      page.locator("text=No options"),
    ).toBeVisible({ timeout: 5_000 });
  });
});
