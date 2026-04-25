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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Filter bar ARIA and keyboard navigation", () => {
  test("filter bar has toolbar role and aria-label", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    const filterBar = page.getByTestId("db-filter-bar");
    await expect(filterBar).toBeVisible({ timeout: 5_000 });
    await expect(filterBar).toHaveRole("toolbar");
    await expect(filterBar).toHaveAttribute("aria-label", "Database filters");
  });

  test("Add filter button has aria-expanded reflecting dropdown state", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    const addFilterBtn = page.getByTestId("db-filter-add");
    await expect(addFilterBtn).toBeVisible({ timeout: 5_000 });

    // Initially collapsed
    await expect(addFilterBtn).toHaveAttribute("aria-expanded", "false");
    await expect(addFilterBtn).toHaveAttribute("aria-haspopup", "true");

    // Click to open
    await addFilterBtn.click();
    await expect(addFilterBtn).toHaveAttribute("aria-expanded", "true");

    // Property picker should be visible with listbox role
    const propertyPicker = page.getByTestId("db-filter-property-picker");
    await expect(propertyPicker).toBeVisible({ timeout: 5_000 });
    await expect(propertyPicker).toHaveRole("listbox");
  });

  test("Escape key closes filter dropdown and returns focus to Add filter button", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    const addFilterBtn = page.getByTestId("db-filter-add");
    await expect(addFilterBtn).toBeVisible({ timeout: 5_000 });
    await addFilterBtn.click();

    // Property picker should be visible
    const propertyPicker = page.getByTestId("db-filter-property-picker");
    await expect(propertyPicker).toBeVisible({ timeout: 5_000 });

    // Press Escape
    await page.keyboard.press("Escape");

    // Dropdown should close
    await expect(propertyPicker).not.toBeVisible({ timeout: 5_000 });
    await expect(addFilterBtn).toHaveAttribute("aria-expanded", "false");

    // Focus should return to the Add filter button
    await expect(addFilterBtn).toBeFocused();
  });

  test("Escape key closes operator picker step", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    const addFilterBtn = page.getByTestId("db-filter-add");
    await expect(addFilterBtn).toBeVisible({ timeout: 5_000 });
    await addFilterBtn.click();

    // Pick a property to advance to operator step
    const propertyPicker = page.getByTestId("db-filter-property-picker");
    await expect(propertyPicker).toBeVisible({ timeout: 5_000 });
    const firstProperty = propertyPicker.locator("button").first();
    await firstProperty.click();

    // Operator picker should be visible
    const operatorPicker = page.getByTestId("db-filter-operator-picker");
    await expect(operatorPicker).toBeVisible({ timeout: 5_000 });
    await expect(operatorPicker).toHaveRole("listbox");

    // Press Escape
    await page.keyboard.press("Escape");

    // Dropdown should close
    await expect(operatorPicker).not.toBeVisible({ timeout: 5_000 });
    await expect(addFilterBtn).toHaveAttribute("aria-expanded", "false");
    await expect(addFilterBtn).toBeFocused();
  });

  test("completing a filter returns focus to Add filter button", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a row so we have something to filter
    const addRowBtn = page.getByTestId("db-table-add-row");
    await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
    await addRowBtn.click();
    await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 10_000 });

    const addFilterBtn = page.getByTestId("db-filter-add");
    await expect(addFilterBtn).toBeVisible({ timeout: 5_000 });
    await addFilterBtn.click();

    // Pick the first property
    const propertyPicker = page.getByTestId("db-filter-property-picker");
    await expect(propertyPicker).toBeVisible({ timeout: 5_000 });
    const firstOption = propertyPicker.locator('[role="option"]').first();
    const propName = await firstOption.innerText();
    await firstOption.click();

    // Pick the first operator
    const operatorPicker = page.getByTestId("db-filter-operator-picker");
    await expect(operatorPicker).toBeVisible({ timeout: 5_000 });
    const firstOp = operatorPicker.locator('[role="option"]').first();
    const opLabel = await firstOp.innerText();
    await firstOp.click();

    // Enter a value and submit
    const valueInput = page.getByTestId("db-filter-value-input");
    await expect(valueInput).toBeVisible({ timeout: 5_000 });
    await valueInput.fill("test");
    await valueInput.press("Enter");

    // Filter pill should appear with descriptive aria-label
    const pill = page.getByTestId("db-filter-pill-0");
    await expect(pill).toBeVisible({ timeout: 5_000 });
    await expect(pill).toHaveAttribute(
      "aria-label",
      `${propName} ${opLabel} test`,
    );

    // Focus should return to Add filter button
    await expect(addFilterBtn).toBeFocused();
    await expect(addFilterBtn).toHaveAttribute("aria-expanded", "false");
  });

  test("Tab key moves between filter pills and Add filter button", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Add a row
    const addRowBtn = page.getByTestId("db-table-add-row");
    await expect(addRowBtn).toBeVisible({ timeout: 10_000 });
    await addRowBtn.click();
    await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 10_000 });

    // Create a filter via the UI using the first property
    const addFilterBtn = page.getByTestId("db-filter-add");
    await expect(addFilterBtn).toBeVisible({ timeout: 5_000 });
    await addFilterBtn.click();

    const propertyPicker = page.getByTestId("db-filter-property-picker");
    await expect(propertyPicker).toBeVisible({ timeout: 5_000 });
    const firstOption = propertyPicker.locator('[role="option"]').first();
    const propName = await firstOption.innerText();
    await firstOption.click();

    const operatorPicker = page.getByTestId("db-filter-operator-picker");
    await expect(operatorPicker).toBeVisible({ timeout: 5_000 });
    const firstOp = operatorPicker.locator('[role="option"]').first();
    await firstOp.click();

    const valueInput = page.getByTestId("db-filter-value-input");
    await expect(valueInput).toBeVisible({ timeout: 5_000 });
    await valueInput.fill("hello");
    await valueInput.press("Enter");

    // Filter pill should be visible
    const pill = page.getByTestId("db-filter-pill-0");
    await expect(pill).toBeVisible({ timeout: 5_000 });

    // Focus should be on Add filter button after completing the filter
    await expect(addFilterBtn).toBeFocused();

    // The remove button inside the pill should be reachable via Shift+Tab
    await page.keyboard.press("Shift+Tab");
    const removeBtn = pill.locator(`button[aria-label="Remove ${propName} filter"]`);
    await expect(removeBtn).toBeFocused();
  });
});
