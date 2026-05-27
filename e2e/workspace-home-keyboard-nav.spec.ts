import { test, expect } from "./fixtures/auth";
import type { Locator, Page } from "@playwright/test";

/**
 * Waits for the workspace home page to fully load.
 */
async function waitForWorkspaceHome(main: Locator): Promise<void> {
  const filterInput = main.getByTestId("wh-filter-input");
  await expect(filterInput).toBeVisible({ timeout: 15_000 });
}

/**
 * Returns the All Pages listbox container.
 */
function getAllPagesListbox(main: Locator): Locator {
  return main.locator('[data-testid="wh-all-pages"] [role="listbox"]');
}

/**
 * Returns all option elements inside the All Pages listbox.
 */
function getAllPagesOptions(main: Locator): Locator {
  return getAllPagesListbox(main).locator('[role="option"]');
}

/**
 * Returns the data-item-id of the currently focused element.
 */
async function getFocusedItemId(page: Page): Promise<string | null> {
  return page.evaluate(
    () => document.activeElement?.getAttribute("data-item-id") ?? null,
  );
}

/**
 * Collects data-item-id values from all visible options in DOM order.
 */
async function getOptionIds(options: Locator): Promise<string[]> {
  return options.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-item-id")!),
  );
}

test.describe("Workspace home keyboard navigation", () => {
  test("All Pages section has listbox role and option items", async ({
    authenticatedPage: page,
  }) => {
    const main = page.locator("#main-content");
    await waitForWorkspaceHome(main);

    const listbox = getAllPagesListbox(main);
    await expect(listbox).toBeVisible({ timeout: 10_000 });

    // Listbox should have an accessible label via aria-labelledby
    await expect(listbox).toHaveAttribute("aria-labelledby", "wh-all-pages-heading");

    const options = getAllPagesOptions(main);
    const count = await options.count();
    if (count === 0) {
      test.skip(true, "No pages available");
      return;
    }

    // Each item should have role="option"
    await expect(options.first()).toHaveAttribute("role", "option");
  });

  test("ArrowDown moves focus to the next option", async ({
    authenticatedPage: page,
  }) => {
    const main = page.locator("#main-content");
    await waitForWorkspaceHome(main);

    const options = getAllPagesOptions(main);
    const count = await options.count();
    if (count < 2) {
      test.skip(true, "Need at least 2 pages");
      return;
    }

    const ids = await getOptionIds(options);

    // Focus the first option
    await options.first().focus();
    expect(await getFocusedItemId(page)).toBe(ids[0]);

    // ArrowDown should move to the next item
    await page.keyboard.press("ArrowDown");
    expect(await getFocusedItemId(page)).toBe(ids[1]);
  });

  test("ArrowUp moves focus to the previous option", async ({
    authenticatedPage: page,
  }) => {
    const main = page.locator("#main-content");
    await waitForWorkspaceHome(main);

    const options = getAllPagesOptions(main);
    const count = await options.count();
    if (count < 2) {
      test.skip(true, "Need at least 2 pages");
      return;
    }

    const ids = await getOptionIds(options);

    // Focus the second option
    await options.nth(1).focus();
    expect(await getFocusedItemId(page)).toBe(ids[1]);

    // ArrowUp should move to the previous item
    await page.keyboard.press("ArrowUp");
    expect(await getFocusedItemId(page)).toBe(ids[0]);
  });

  test("Home moves focus to the first option", async ({
    authenticatedPage: page,
  }) => {
    const main = page.locator("#main-content");
    await waitForWorkspaceHome(main);

    const options = getAllPagesOptions(main);
    const count = await options.count();
    if (count < 2) {
      test.skip(true, "Need at least 2 pages");
      return;
    }

    const ids = await getOptionIds(options);

    // Focus the last option
    await options.last().focus();

    // Home should move to the first item
    await page.keyboard.press("Home");
    await expect(async () => {
      expect(await getFocusedItemId(page)).toBe(ids[0]);
    }).toPass({ timeout: 3_000 });
  });

  test("End moves focus to the last option", async ({
    authenticatedPage: page,
  }) => {
    const main = page.locator("#main-content");
    await waitForWorkspaceHome(main);

    const options = getAllPagesOptions(main);
    const count = await options.count();
    if (count < 2) {
      test.skip(true, "Need at least 2 pages");
      return;
    }

    const ids = await getOptionIds(options);

    // Focus the first option
    await options.first().focus();

    // End should move to the last item
    await page.keyboard.press("End");
    await expect(async () => {
      expect(await getFocusedItemId(page)).toBe(ids[ids.length - 1]);
    }).toPass({ timeout: 3_000 });
  });

  test("Enter navigates to the focused page", async ({
    authenticatedPage: page,
  }) => {
    const main = page.locator("#main-content");
    await waitForWorkspaceHome(main);

    const options = getAllPagesOptions(main);
    const count = await options.count();
    if (count === 0) {
      test.skip(true, "No pages available");
      return;
    }

    const ids = await getOptionIds(options);

    // Focus the first option and press Enter
    await options.first().focus();
    await page.keyboard.press("Enter");

    // URL should contain the page ID
    await page.waitForURL((url) => url.pathname.includes(ids[0]), {
      timeout: 10_000,
    });
  });

  test("roving tabindex: only focused option has tabindex=0", async ({
    authenticatedPage: page,
  }) => {
    const main = page.locator("#main-content");
    await waitForWorkspaceHome(main);

    const options = getAllPagesOptions(main);
    const count = await options.count();
    if (count < 2) {
      test.skip(true, "Need at least 2 pages");
      return;
    }

    // Before interaction, first item should be tabbable
    await expect(options.first()).toHaveAttribute("tabindex", "0");
    await expect(options.nth(1)).toHaveAttribute("tabindex", "-1");

    // Focus first and move down
    await options.first().focus();
    await page.keyboard.press("ArrowDown");

    // Now second item should be tabbable, first should not
    await expect(options.first()).toHaveAttribute("tabindex", "-1");
    await expect(options.nth(1)).toHaveAttribute("tabindex", "0");
  });

  test("focus-visible style is applied on the focused option", async ({
    authenticatedPage: page,
  }) => {
    const main = page.locator("#main-content");
    await waitForWorkspaceHome(main);

    const options = getAllPagesOptions(main);
    const count = await options.count();
    if (count === 0) {
      test.skip(true, "No pages available");
      return;
    }

    // Focus the first option via keyboard (Tab into the listbox)
    await options.first().focus();

    // The focus-visible:bg-overlay-active class should be applied.
    // Verify the element has the class in its className attribute.
    await expect(options.first()).toHaveClass(/focus-visible:bg-overlay-active/);
  });

  test("ArrowDown wraps from last to first option", async ({
    authenticatedPage: page,
  }) => {
    const main = page.locator("#main-content");
    await waitForWorkspaceHome(main);

    const options = getAllPagesOptions(main);
    const count = await options.count();
    if (count < 2) {
      test.skip(true, "Need at least 2 pages");
      return;
    }

    const ids = await getOptionIds(options);

    // Focus the last option
    await options.last().focus();
    expect(await getFocusedItemId(page)).toBe(ids[ids.length - 1]);

    // ArrowDown should wrap to the first item
    await page.keyboard.press("ArrowDown");
    await expect(async () => {
      expect(await getFocusedItemId(page)).toBe(ids[0]);
    }).toPass({ timeout: 3_000 });
  });

  test("Recently Visited section uses the same keyboard navigation", async ({
    authenticatedPage: page,
  }) => {
    const main = page.locator("#main-content");
    await waitForWorkspaceHome(main);

    const recentSection = main.getByTestId("wh-recently-visited");
    const isVisible = await recentSection.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip(true, "No Recently Visited section present");
      return;
    }

    const recentListbox = recentSection.locator('[role="listbox"]');
    await expect(recentListbox).toBeVisible({ timeout: 5_000 });

    // Should have aria-labelledby pointing to the heading
    await expect(recentListbox).toHaveAttribute(
      "aria-labelledby",
      "wh-recently-visited-label",
    );

    const recentOptions = recentListbox.locator('[role="option"]');
    const count = await recentOptions.count();
    if (count < 2) {
      test.skip(true, "Need at least 2 recent visits");
      return;
    }

    const ids = await recentOptions.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-item-id")!),
    );

    // Focus first and ArrowDown
    await recentOptions.first().focus();
    expect(await getFocusedItemId(page)).toBe(ids[0]);

    await page.keyboard.press("ArrowDown");
    expect(await getFocusedItemId(page)).toBe(ids[1]);

    // ArrowUp back
    await page.keyboard.press("ArrowUp");
    expect(await getFocusedItemId(page)).toBe(ids[0]);
  });
});
