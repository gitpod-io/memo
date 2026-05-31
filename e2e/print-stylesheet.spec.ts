import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage, waitForEditor } from "./fixtures/editor-helpers";

/**
 * Helper: get the computed style of an element by selector.
 */
async function getComputedStyleProp(
  page: import("@playwright/test").Page,
  selector: string,
  prop: string,
): Promise<string> {
  return page.evaluate(
    ({ sel, p }) => {
      const el = document.querySelector(sel);
      if (!el) return "";
      return window.getComputedStyle(el).getPropertyValue(p);
    },
    { sel: selector, p: prop },
  );
}

test.describe("print stylesheet", () => {
  test("editor page: hides chrome and expands content in print media", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);
    await waitForEditor(page);

    // --- Verify sidebar is visible in screen media first ---
    const sidebar = page.getByTestId("as-sidebar");
    await expect(sidebar).toBeVisible();

    // --- Type and select text to trigger the floating toolbar ---
    const editor = page.locator('[data-lexical-editor="true"]');
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await editor.pressSequentially("Print test toolbar text");
    await page.keyboard.down("Shift");
    await page.keyboard.press("Home");
    await page.keyboard.up("Shift");

    const toolbar = page.getByTestId("editor-toolbar");
    await expect(toolbar).toBeVisible({ timeout: 3_000 });

    // --- Switch to print media ---
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(200);

    // Sidebar is hidden
    const sidebarDisplay = await getComputedStyleProp(
      page,
      '[data-testid="as-sidebar"]',
      "display",
    );
    expect(sidebarDisplay).toBe("none");

    // Mobile header bar is hidden (contains sidebar toggle)
    const mobileHeaderHidden = await page.evaluate(() => {
      const toggle = document.querySelector(
        '[data-testid="as-sidebar-toggle"]',
      );
      if (!toggle) return true; // no toggle means no mobile header
      const header = toggle.closest("header");
      if (!header) return true;
      return window.getComputedStyle(header).display === "none";
    });
    expect(mobileHeaderHidden).toBe(true);

    // Editor toolbar is hidden
    const toolbarDisplay = await getComputedStyleProp(
      page,
      '[data-testid="editor-toolbar"]',
      "display",
    );
    expect(toolbarDisplay).toBe("none");

    // Main content expands to full width
    const mainContentStyles = await page.evaluate(() => {
      const el = document.querySelector("#main-content");
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      return {
        maxWidth: cs.maxWidth,
        overflow: cs.overflow,
      };
    });
    expect(mainContentStyles).not.toBeNull();
    expect(["100%", "none"]).toContain(mainContentStyles!.maxWidth);

    // App shell has overflow: visible
    const shellStyles = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="as-shell"]');
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      return { overflow: cs.overflow };
    });
    expect(shellStyles).not.toBeNull();
    expect(shellStyles!.overflow).toBe("visible");
  });

  test("database page: hides controls and shows cell borders in print media", async ({
    authenticatedPage: page,
  }) => {
    // Create a database page via the sidebar
    const sidebar = page.getByRole("complementary");
    const treeLoaded = sidebar
      .locator('[role="treeitem"], :text("No pages yet")')
      .first();
    await expect(treeLoaded).toBeVisible({ timeout: 15_000 });

    const newDbBtn = sidebar.getByTestId("sb-new-database-btn");
    await expect(newDbBtn).toBeVisible({ timeout: 5_000 });
    await newDbBtn.click();

    // Wait for the database view to load
    await page.waitForURL(
      (url) => url.pathname.split("/").filter(Boolean).length >= 2,
      { timeout: 15_000 },
    );
    const dbLoaded = page
      .locator('[role="grid"], :text("No rows yet")')
      .first();
    await expect(dbLoaded).toBeVisible({ timeout: 15_000 });

    // Add a row so the full table renders (empty state uses a different branch
    // without db-table-container). Click the add-row button and wait for the
    // table container to appear.
    const addRowBtn = page.getByTestId("db-table-add-row").first();
    await expect(addRowBtn).toBeVisible({ timeout: 5_000 });
    await addRowBtn.click();
    await page
      .getByTestId("db-table-container")
      .waitFor({ state: "visible", timeout: 10_000 });

    // --- Switch to print media ---
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(200);

    // Add-row buttons are hidden
    const addRowHidden = await page.evaluate(() => {
      const els = document.querySelectorAll(
        '[data-testid="db-table-add-row"]',
      );
      return (
        els.length > 0 &&
        Array.from(els).every(
          (el) => window.getComputedStyle(el).display === "none",
        )
      );
    });
    expect(addRowHidden).toBe(true);

    // Add-column button is hidden
    const addColDisplay = await getComputedStyleProp(
      page,
      '[data-testid="db-table-add-column"]',
      "display",
    );
    expect(addColDisplay).toBe("none");

    // Select-all checkbox is hidden
    const selectAllDisplay = await getComputedStyleProp(
      page,
      '[data-testid="db-table-select-all"]',
      "display",
    );
    expect(selectAllDisplay).toBe("none");

    // Table cells have visible borders.
    // The print stylesheet sets `border: 1px solid var(--border) !important`
    // on columnheader, gridcell, and row > div inside db-table-container.
    const cellHasBorder = await page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="db-table-container"]',
      );
      if (!container) return false;

      const rowDivs = container.querySelectorAll('[role="row"] > div');
      return Array.from(rowDivs).some((div) => {
        const cs = window.getComputedStyle(div);
        if (cs.display === "none") return false;
        return (
          (parseFloat(cs.borderTopWidth) > 0 &&
            cs.borderTopStyle !== "none") ||
          (parseFloat(cs.borderLeftWidth) > 0 &&
            cs.borderLeftStyle !== "none")
        );
      });
    });
    expect(cellHasBorder).toBe(true);
  });
});
