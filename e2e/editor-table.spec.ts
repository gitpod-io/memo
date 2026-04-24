import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage } from "./fixtures/editor-helpers";
import type { Page, Locator } from "@playwright/test";

test.setTimeout(45_000);

/**
 * Insert a table via the /table slash command and wait for it to render.
 * After insertion the cursor is in a paragraph below the table.
 */
async function insertTable(page: Page): Promise<Locator> {
  const editor = page.locator('[contenteditable="true"]');

  await editor.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");

  const options = page.locator('[role="option"]');
  await expect(options.first()).toBeVisible({ timeout: 3_000 });

  await page.keyboard.type("table");
  const tableOption = options.filter({ hasText: "Table" });
  await expect(tableOption).toBeVisible({ timeout: 3_000 });
  await tableOption.click();

  const table = editor.locator("table");
  await expect(table).toBeVisible({ timeout: 5_000 });
  await expect(table.locator("th").first()).toBeVisible({ timeout: 3_000 });
  return table;
}

/**
 * Place the cursor inside the first table header cell by clicking the <p>
 * element inside it at its center. Falls back to clicking the <th> directly.
 */
async function focusFirstCell(page: Page): Promise<void> {
  const p = page.locator("table th p").first();
  await expect(p).toBeVisible({ timeout: 3_000 });
  const box = await p.boundingBox();
  if (!box) throw new Error("Could not get bounding box");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  const inCell = await page.evaluate(() => {
    const editorEl = document.querySelector('[contenteditable="true"]');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ed = (editorEl as any)?.__lexicalEditor;
    if (!ed) return false;
    const state = ed.getEditorState();
    const sel = state._selection;
    if (!sel?.anchor) return false;
    let current = state._nodeMap.get(sel.anchor.key);
    while (current) {
      if (current.__type === "tablecell") return true;
      current = current.__parent
        ? state._nodeMap.get(current.__parent)
        : null;
    }
    return false;
  });

  if (!inCell) {
    await page.locator("table th").first().click();
  }
}

/**
 * Wait for a successful Supabase PATCH to /rest/v1/pages (content auto-save).
 */
function waitForContentSave(page: Page) {
  return page.waitForResponse(
    (resp) =>
      resp.url().includes("/rest/v1/pages") &&
      resp.request().method() === "PATCH" &&
      resp.status() >= 200 &&
      resp.status() < 300,
    { timeout: 10_000 }
  );
}

test.describe("Editor table blocks", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await navigateToEditorPage(page);
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });
  });

  test("user can insert a table via the /table slash command", async ({
    authenticatedPage: page,
  }) => {
    const table = await insertTable(page);

    // Default table: 3 columns × 3 rows (1 header + 2 body)
    await expect(table.locator("th")).toHaveCount(3);
    await expect(table.locator("td")).toHaveCount(6);
    await expect(table.locator("tr")).toHaveCount(3);
  });

  test("user can type into a table cell", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    const table = await insertTable(page);

    // Place cursor inside the first header cell
    await focusFirstCell(page);
    await page.keyboard.type("Hello Table");

    // Verify text landed in the correct cell
    await expect(table.locator("th").first()).toContainText("Hello Table", {
      timeout: 3_000,
    });

    // Table structure should be unchanged
    await expect(editor.locator("table th")).toHaveCount(3);
    await expect(editor.locator("table td")).toHaveCount(6);
  });

  test("table structure persists after page reload", async ({
    authenticatedPage: page,
  }) => {
    await insertTable(page);

    // Wait for auto-save to persist the table
    const saveResponse = waitForContentSave(page);
    // Type outside the table (in the paragraph below) to trigger a save
    await page.keyboard.type("trigger-save");
    await saveResponse;

    // Reload the page
    await page.reload({ waitUntil: "domcontentloaded" });

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // The table structure should be preserved
    const reloadedTable = editor.locator("table");
    await expect(reloadedTable).toBeVisible({ timeout: 10_000 });
    await expect(reloadedTable.locator("th")).toHaveCount(3);
    await expect(reloadedTable.locator("td")).toHaveCount(6);
    await expect(reloadedTable.locator("tr")).toHaveCount(3);
  });

  // --- Skipped tests: blocked by pre-existing bugs ---
  // These are tracked as separate bug issues.

  test("user can navigate between cells with Tab", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    const table = await insertTable(page);

    // Focus the first header cell and type text
    await focusFirstCell(page);
    await page.keyboard.type("A1");
    await expect(table.locator("th").first()).toContainText("A1", {
      timeout: 3_000,
    });

    // The table must still exist after typing
    await expect(editor.locator("table")).toBeVisible();

    // Press Tab — cursor should move to the next cell
    await page.keyboard.press("Tab");

    // The table must still be in the DOM after pressing Tab
    await expect(editor.locator("table")).toBeVisible({ timeout: 3_000 });

    // Type in the second cell to prove the cursor moved
    await page.keyboard.type("B1");
    await expect(table.locator("th").nth(1)).toContainText("B1", {
      timeout: 3_000,
    });

    // Press Tab again to move to the third header cell
    await page.keyboard.press("Tab");
    await page.keyboard.type("C1");
    await expect(table.locator("th").nth(2)).toContainText("C1", {
      timeout: 3_000,
    });

    // Press Tab once more to wrap to the first body row
    await page.keyboard.press("Tab");
    await page.keyboard.type("A2");
    await expect(table.locator("td").first()).toContainText("A2", {
      timeout: 3_000,
    });

    // Shift+Tab should move back to the previous cell (third header)
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.type("-end");
    await expect(table.locator("th").nth(2)).toContainText("C1-end", {
      timeout: 3_000,
    });

    // Table structure should be unchanged throughout
    await expect(table.locator("th")).toHaveCount(3);
    await expect(table.locator("td")).toHaveCount(6);
    await expect(table.locator("tr")).toHaveCount(3);
  });

  test("table cell content persists after reload", async ({
    authenticatedPage: page,
  }) => {
    await insertTable(page);

    // Type text into the first header cell
    await focusFirstCell(page);
    await page.keyboard.type("Hello Table");

    // Verify text is in the cell before saving
    const editor = page.locator('[contenteditable="true"]');
    const table = editor.locator("table");
    await expect(table.locator("th").first()).toContainText("Hello Table", {
      timeout: 3_000,
    });

    // Wait for auto-save to persist the cell content. The save debounce
    // fires after the last keystroke, so we wait for the PATCH response.
    const saveResponse = waitForContentSave(page);
    await saveResponse;

    // Wait for any follow-up saves to settle (the fix in #402 re-schedules
    // saves when new changes arrive while a save is in-flight). We wait for
    // network idle which indicates no pending requests.
    await page.waitForLoadState("networkidle");

    // Reload the page
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(editor).toBeVisible({ timeout: 10_000 });

    // The table structure AND cell content should be preserved
    const reloadedTable = editor.locator("table");
    await expect(reloadedTable).toBeVisible({ timeout: 10_000 });
    await expect(reloadedTable.locator("th")).toHaveCount(3);
    await expect(reloadedTable.locator("th").first()).toContainText(
      "Hello Table",
      { timeout: 5_000 },
    );
  });

  test("user can add a row via the table action menu", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    const table = await insertTable(page);

    // Default: 3 rows (1 header + 2 body)
    await expect(table.locator("tr")).toHaveCount(3);

    // Focus the first header cell to activate the trigger
    await focusFirstCell(page);

    const trigger = page.locator('button[aria-label="Table cell actions"]');
    await expect(trigger).toBeVisible({ timeout: 5_000 });
    await trigger.click();

    const insertBelow = page.getByText("Insert row below");
    await expect(insertBelow).toBeVisible({ timeout: 3_000 });
    await insertBelow.click();

    // Now 4 rows
    await expect(table.locator("tr")).toHaveCount(4, { timeout: 3_000 });
    // Column count unchanged
    await expect(table.locator("th")).toHaveCount(3);
  });

  test("user can add a column via the table action menu", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    const table = await insertTable(page);

    // Default: 3 columns
    await expect(table.locator("th")).toHaveCount(3);

    await focusFirstCell(page);

    const trigger = page.locator('button[aria-label="Table cell actions"]');
    await expect(trigger).toBeVisible({ timeout: 5_000 });
    await trigger.click();

    const insertRight = page.getByText("Insert column right");
    await expect(insertRight).toBeVisible({ timeout: 3_000 });
    await insertRight.click();

    // Now 4 columns in the header row
    await expect(table.locator("th")).toHaveCount(4, { timeout: 3_000 });
    // Body rows also have 4 cells each (2 body rows × 4 = 8)
    await expect(table.locator("td")).toHaveCount(8, { timeout: 3_000 });
    // Row count unchanged
    await expect(table.locator("tr")).toHaveCount(3);
  });

  test("user can delete a row and a column via the table action menu", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    const table = await insertTable(page);

    // Default: 3 rows, 3 columns
    await expect(table.locator("tr")).toHaveCount(3);
    await expect(table.locator("th")).toHaveCount(3);

    // Click into a body cell (first td) to delete a body row
    const firstTd = table.locator("td").first();
    await expect(firstTd).toBeVisible({ timeout: 3_000 });
    await firstTd.click();

    const trigger = page.locator('button[aria-label="Table cell actions"]');
    await expect(trigger).toBeVisible({ timeout: 5_000 });
    await trigger.click();

    const deleteRow = page.getByText("Delete row");
    await expect(deleteRow).toBeVisible({ timeout: 3_000 });
    await deleteRow.click();

    // Now 2 rows (1 header + 1 body)
    await expect(table.locator("tr")).toHaveCount(2, { timeout: 3_000 });

    // Focus a cell again to delete a column
    await focusFirstCell(page);

    await expect(trigger).toBeVisible({ timeout: 5_000 });
    await trigger.click();

    const deleteCol = page.getByText("Delete column");
    await expect(deleteCol).toBeVisible({ timeout: 3_000 });
    await deleteCol.click();

    // Now 2 columns
    await expect(table.locator("th")).toHaveCount(2, { timeout: 3_000 });
    // 1 body row × 2 columns = 2 td cells
    await expect(table.locator("td")).toHaveCount(2, { timeout: 3_000 });
  });
});
