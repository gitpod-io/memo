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
  await page.waitForTimeout(200);
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
  await page.waitForTimeout(500);

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
    await page.waitForTimeout(500);
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

  test("Tab navigates to the next cell without deleting the table", async ({
    authenticatedPage: page,
  }) => {
    const table = await insertTable(page);

    // Place cursor inside the first header cell
    await focusFirstCell(page);
    await page.keyboard.type("Header 1");
    await expect(table.locator("th").first()).toContainText("Header 1");

    // Press Tab to move to the next cell
    await page.keyboard.press("Tab");
    await page.waitForTimeout(500);

    // The table must still exist (regression for #401)
    await expect(table).toBeVisible();

    // Type in the second cell to verify the cursor moved
    await page.keyboard.type("Header 2");
    const secondHeaderCell = table.locator("th").nth(1);
    await expect(secondHeaderCell).toContainText("Header 2");
  });

  test("Shift+Tab navigates to the previous cell", async ({
    authenticatedPage: page,
  }) => {
    const table = await insertTable(page);

    // Place cursor inside the first header cell
    await focusFirstCell(page);
    await page.keyboard.type("Cell A");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    await page.keyboard.type("Cell B");

    // Shift+Tab back to the first cell
    await page.keyboard.press("Shift+Tab");
    await page.waitForTimeout(300);

    // The table must still exist
    await expect(table).toBeVisible();

    // Type additional text — it should appear in the first cell
    await page.keyboard.type(" updated");
    await expect(table.locator("th").first()).toContainText("Cell A updated");
  });

  test("Tab from last cell does not delete the table", async ({
    authenticatedPage: page,
  }) => {
    const table = await insertTable(page);

    // Navigate to the last cell (3×3 table = 9 cells, Tab 8 times)
    await focusFirstCell(page);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(100);
    }

    // Type in the last cell
    await page.keyboard.type("Last");
    const lastCell = table.locator("td").last();
    await expect(lastCell).toContainText("Last");

    // Tab one more time to navigate out of the table
    await page.keyboard.press("Tab");
    await page.waitForTimeout(500);

    // The table must still exist
    await expect(table).toBeVisible();
  });

  // --- Skipped tests: blocked by pre-existing bugs ---
  // These are tracked as separate bug issues.

  // Bug: Table cell content is lost after page reload. The table structure
  // (rows/columns) is preserved but all cell text content is empty after
  // deserialization.
  test.skip("table cell content persists after reload", async () => {
    // Blocked by: table cell content not serialized/deserialized correctly
  });

  // Bug: The TableActionMenuPlugin uses createPortal to render a trigger
  // button into the table cell DOM, but Lexical's DOM reconciler removes
  // the portaled content. The trigger button never appears in the DOM.
  test.skip("user can add a row via the table action menu", async () => {
    // Blocked by: table action menu trigger not rendering
  });

  test.skip("user can add a column via the table action menu", async () => {
    // Blocked by: table action menu trigger not rendering
  });

  test.skip("user can delete a row and a column via the table action menu", async () => {
    // Blocked by: table action menu trigger not rendering
  });
});
