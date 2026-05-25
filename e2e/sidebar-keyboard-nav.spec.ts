import { test, expect } from "./fixtures/auth";

test.describe("Sidebar page tree keyboard navigation", () => {
  /**
   * Helper: wait for the page tree to finish loading and have at least
   * `minItems` visible data-page-id rows. Skips the test if not enough items.
   */
  async function waitForTree(
    page: import("@playwright/test").Page,
    minItems: number,
  ) {
    const sidebar = page.getByRole("complementary");
    const treeLoaded = sidebar
      .locator('[role="treeitem"], :text("No pages yet")')
      .first();
    await expect(treeLoaded).toBeVisible({ timeout: 10_000 });

    const count = await page.locator("[data-page-id]").count();
    if (count < minItems) {
      test.skip(
        true,
        `Need at least ${minItems} page(s) in sidebar, found ${count}`,
      );
    }
  }

  /**
   * Helper: get the data-page-id of the currently focused element.
   */
  async function getFocusedPageId(
    page: import("@playwright/test").Page,
  ): Promise<string | null> {
    return page.evaluate(() =>
      document.activeElement?.getAttribute("data-page-id") ?? null,
    );
  }

  /**
   * Helper: get all visible data-page-id values in DOM order.
   */
  async function getVisiblePageIds(
    page: import("@playwright/test").Page,
  ): Promise<string[]> {
    return page.locator("[data-page-id]").evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-page-id")!),
    );
  }

  test("ArrowDown moves focus to the next visible treeitem", async ({
    authenticatedPage: page,
  }) => {
    await waitForTree(page, 2);

    const ids = await getVisiblePageIds(page);
    const firstRow = page.locator(`[data-page-id="${ids[0]}"]`);

    // Focus the first row — onFocus handler syncs focusedId
    await firstRow.focus();
    expect(await getFocusedPageId(page)).toBe(ids[0]);

    // Press ArrowDown — should move to the next visible item
    await page.keyboard.press("ArrowDown");
    expect(await getFocusedPageId(page)).toBe(ids[1]);
  });

  test("ArrowUp moves focus to the previous visible treeitem", async ({
    authenticatedPage: page,
  }) => {
    await waitForTree(page, 2);

    const ids = await getVisiblePageIds(page);
    const secondRow = page.locator(`[data-page-id="${ids[1]}"]`);

    await secondRow.focus();
    expect(await getFocusedPageId(page)).toBe(ids[1]);

    await page.keyboard.press("ArrowUp");
    expect(await getFocusedPageId(page)).toBe(ids[0]);
  });

  test("Home moves focus to the first treeitem", async ({
    authenticatedPage: page,
  }) => {
    await waitForTree(page, 2);

    const ids = await getVisiblePageIds(page);
    // Focus the last rendered item
    const lastRow = page.locator(`[data-page-id="${ids[ids.length - 1]}"]`);
    await lastRow.focus();

    await page.keyboard.press("Home");
    // With virtualization the tree may scroll to reveal the first item.
    // Wait for focus to settle then verify it landed on the first item.
    await expect(async () => {
      const focusedId = await getFocusedPageId(page);
      const currentIds = await getVisiblePageIds(page);
      expect(focusedId).toBe(currentIds[0]);
    }).toPass({ timeout: 3_000 });
  });

  test("End moves focus to the last visible treeitem", async ({
    authenticatedPage: page,
  }) => {
    await waitForTree(page, 2);

    const ids = await getVisiblePageIds(page);
    const firstRow = page.locator(`[data-page-id="${ids[0]}"]`);
    await firstRow.focus();

    await page.keyboard.press("End");
    // With virtualization the tree may scroll to reveal the last item.
    // Wait for focus to settle on a data-page-id element, then verify
    // it is the last item in the tree (which may differ from the initial
    // DOM snapshot captured in `ids`).
    await expect(async () => {
      const focusedId = await getFocusedPageId(page);
      expect(focusedId).toBeTruthy();
      // After scrolling, re-read the DOM to get the last rendered item
      const currentIds = await getVisiblePageIds(page);
      expect(focusedId).toBe(currentIds[currentIds.length - 1]);
    }).toPass({ timeout: 3_000 });
  });

  test("Enter navigates to the focused page", async ({
    authenticatedPage: page,
  }) => {
    await waitForTree(page, 1);

    const ids = await getVisiblePageIds(page);
    const firstRow = page.locator(`[data-page-id="${ids[0]}"]`);
    await firstRow.focus();

    await page.keyboard.press("Enter");

    // URL should contain the page ID
    await page.waitForURL((url) => url.pathname.includes(ids[0]), {
      timeout: 10_000,
    });
  });

  test("ArrowRight expands collapsed parent, ArrowLeft collapses it", async ({
    authenticatedPage: page,
  }) => {
    await waitForTree(page, 1);

    // Find a treeitem that has children (aria-expanded attribute present)
    const expandableItems = page.locator('[role="treeitem"][aria-expanded]');
    const expandableCount = await expandableItems.count();

    if (expandableCount === 0) {
      test.skip(true, "No expandable tree items found");
      return;
    }

    // Find the first expandable item and get its row
    const firstExpandable = expandableItems.first();
    const row = firstExpandable.locator("[data-page-id]").first();
    const wasExpanded = (await firstExpandable.getAttribute("aria-expanded")) === "true";

    // Ensure it's collapsed first
    if (wasExpanded) {
      await row.focus();
      await page.keyboard.press("ArrowLeft");
      await expect(firstExpandable).toHaveAttribute("aria-expanded", "false");
    }

    // ArrowRight should expand
    await row.focus();
    await page.keyboard.press("ArrowRight");
    await expect(firstExpandable).toHaveAttribute("aria-expanded", "true");

    // ArrowLeft should collapse
    await page.keyboard.press("ArrowLeft");
    await expect(firstExpandable).toHaveAttribute("aria-expanded", "false");

    // Restore original state
    if (wasExpanded) {
      await page.keyboard.press("ArrowRight");
    }
  });

  test("ArrowRight on expanded parent moves focus to first child", async ({
    authenticatedPage: page,
  }) => {
    await waitForTree(page, 1);

    const expandableItems = page.locator('[role="treeitem"][aria-expanded]');
    const expandableCount = await expandableItems.count();

    if (expandableCount === 0) {
      test.skip(true, "No expandable tree items found");
      return;
    }

    const firstExpandable = expandableItems.first();
    const row = firstExpandable.locator("[data-page-id]").first();

    // Ensure it's expanded
    const wasExpanded = (await firstExpandable.getAttribute("aria-expanded")) === "true";
    if (!wasExpanded) {
      await row.focus();
      await page.keyboard.press("ArrowRight");
      await expect(firstExpandable).toHaveAttribute("aria-expanded", "true");
    } else {
      await row.focus();
    }

    // ArrowRight on expanded parent should move to first child
    await page.keyboard.press("ArrowRight");

    // The focused element should be a child (different from the parent)
    const parentId = await row.getAttribute("data-page-id");
    const focusedId = await getFocusedPageId(page);
    expect(focusedId).not.toBe(parentId);
    expect(focusedId).not.toBeNull();

    // Restore original state
    if (!wasExpanded) {
      await row.focus();
      await page.keyboard.press("ArrowLeft");
    }
  });

  test("roving tabindex: only focused item has tabindex=0", async ({
    authenticatedPage: page,
  }) => {
    await waitForTree(page, 2);

    const ids = await getVisiblePageIds(page);
    const firstRow = page.locator(`[data-page-id="${ids[0]}"]`);
    const secondRow = page.locator(`[data-page-id="${ids[1]}"]`);

    // Before any interaction, first item should be tabbable (tabindex=0)
    await expect(firstRow).toHaveAttribute("tabindex", "0");
    await expect(secondRow).toHaveAttribute("tabindex", "-1");

    // Focus first and move down
    await firstRow.focus();
    await page.keyboard.press("ArrowDown");

    // Now second item should be tabbable, first should not
    await expect(firstRow).toHaveAttribute("tabindex", "-1");
    await expect(secondRow).toHaveAttribute("tabindex", "0");
  });

  test("focus ring is visible on the focused treeitem", async ({
    authenticatedPage: page,
  }) => {
    await waitForTree(page, 1);

    const ids = await getVisiblePageIds(page);
    const firstRow = page.locator(`[data-page-id="${ids[0]}"]`);

    // Focus the item
    await firstRow.focus();

    // The focused item should have the ring-1 ring-accent classes
    await expect(firstRow).toHaveClass(/ring-1/);
    await expect(firstRow).toHaveClass(/ring-accent/);
  });

  test("existing mouse interactions still work after keyboard nav", async ({
    authenticatedPage: page,
  }) => {
    await waitForTree(page, 2);

    const ids = await getVisiblePageIds(page);
    const firstRow = page.locator(`[data-page-id="${ids[0]}"]`);

    // Use keyboard nav first
    await firstRow.focus();
    await page.keyboard.press("ArrowDown");

    // Now hover a treeitem — drag handle should appear
    const firstTreeitem = page.locator('[role="treeitem"]').first();
    await firstTreeitem.hover();

    const gripIcon = page.locator("svg.lucide-grip-vertical").first();
    await expect(gripIcon).toBeVisible({ timeout: 2_000 });
  });
});
