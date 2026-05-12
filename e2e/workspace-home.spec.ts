import { test, expect } from "./fixtures/auth";
import type { Locator } from "@playwright/test";

/**
 * Returns the "All Pages" container — the div.mt-6 that holds the heading,
 * filter/sort toolbar, and the page list.
 */
function getAllPagesSection(main: Locator): Locator {
  // The "All Pages" heading is inside a div.mt-6. Use the filter input's
  // ancestor to scope precisely — the filter input only exists in "All Pages".
  return main.locator("div.mt-6").filter({
    hasText: /All Pages/,
  });
}

/**
 * Returns the page-list buttons inside the "All Pages" section only.
 * Excludes buttons from "Recently Visited" and the filter/sort toolbar.
 */
function getPageListItems(main: Locator): Locator {
  const section = getAllPagesSection(main);
  return section.locator("button.text-left.text-sm");
}

/**
 * Collects visible page titles from the page list (up to `max` items).
 */
async function collectTitles(
  items: Locator,
  max = 20,
): Promise<string[]> {
  const count = Math.min(await items.count(), max);
  const titles: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await items.nth(i).locator("span.flex-1").textContent();
    titles.push((text ?? "Untitled").trim());
  }
  return titles;
}

/**
 * Waits for the workspace home page to fully load inside #main-content.
 */
async function waitForWorkspaceHome(main: Locator): Promise<void> {
  const filterInput = main.getByRole("textbox", { name: /filter pages/i });
  await expect(filterInput).toBeVisible({ timeout: 15_000 });
}

test.describe("Workspace home page interactions", () => {
  test("clicking 'New Page' creates a page and navigates to it", async ({
    authenticatedPage: page,
  }) => {
    const main = page.locator("#main-content");

    const newPageButton = main.getByRole("button", { name: /new page/i });
    await expect(newPageButton).toBeVisible({ timeout: 15_000 });

    await newPageButton.click();

    // Should navigate to the new page — URL contains a UUID page ID
    await page.waitForURL(
      (url) => /\/[^/]+\/[0-9a-f-]{36}/.test(url.pathname),
      { timeout: 15_000 },
    );

    // The editor should be visible (contenteditable area or title input)
    const editor = page
      .locator('[contenteditable="true"]')
      .or(page.locator('input[aria-label="Page title"]'));
    await expect(editor.first()).toBeVisible({ timeout: 10_000 });
  });

  test("typing in the filter input filters the page list by title", async ({
    authenticatedPage: page,
  }) => {
    const main = page.locator("#main-content");
    await waitForWorkspaceHome(main);

    const filterInput = main.getByRole("textbox", { name: /filter pages/i });
    const pageItems = getPageListItems(main);

    await expect(pageItems.first()).toBeVisible({ timeout: 10_000 });
    const initialCount = await pageItems.count();

    if (initialCount < 2) {
      test.skip(true, "Need at least 2 pages to test filtering");
      return;
    }

    // Find a page with a non-empty, non-"Untitled" title for a meaningful filter
    let searchTerm = "";
    const titleCount = Math.min(initialCount, 20);
    for (let i = 0; i < titleCount; i++) {
      const text = await pageItems
        .nth(i)
        .locator("span.flex-1")
        .textContent();
      const trimmed = (text ?? "").trim();
      if (trimmed && trimmed !== "Untitled") {
        searchTerm = trimmed;
        break;
      }
    }

    if (!searchTerm) {
      // Fall back to "Untitled" if all pages are untitled
      searchTerm = "Untitled";
    }

    // Type the filter
    await filterInput.fill(searchTerm);

    // Wait for the list to update — filtered count should be <= initial
    await expect(async () => {
      const filteredCount = await pageItems.count();
      expect(filteredCount).toBeGreaterThan(0);
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    }).toPass({ timeout: 5_000 });

    // Verify the first few visible items contain the filter text
    const titles = await collectTitles(pageItems, 5);
    for (const title of titles) {
      expect(title.toLowerCase()).toContain(searchTerm.toLowerCase());
    }
  });

  test("changing the sort dropdown reorders the page list", async ({
    authenticatedPage: page,
  }) => {
    const main = page.locator("#main-content");
    await waitForWorkspaceHome(main);

    const sortTrigger = main.getByRole("combobox", { name: /sort pages/i });
    const pageItems = getPageListItems(main);

    await expect(pageItems.first()).toBeVisible({ timeout: 10_000 });
    const initialCount = await pageItems.count();

    if (initialCount < 2) {
      test.skip(true, "Need at least 2 pages to test sorting");
      return;
    }

    // Collect titles in default order (Last modified)
    const titlesDefault = await collectTitles(pageItems, 10);

    // Switch to "Title A-Z"
    await sortTrigger.click();
    await page.getByRole("option", { name: "Title A-Z" }).click();

    // Wait for the list to stabilize
    await expect(async () => {
      const count = await pageItems.count();
      expect(count).toBe(initialCount);
    }).toPass({ timeout: 5_000 });

    // Collect titles in A-Z order
    const titlesAZ = await collectTitles(pageItems, 10);

    // Verify A-Z order: each consecutive pair should be in ascending order
    for (let i = 1; i < titlesAZ.length; i++) {
      expect(titlesAZ[i - 1].localeCompare(titlesAZ[i])).toBeLessThanOrEqual(0);
    }

    // Switch to "Title Z-A"
    await sortTrigger.click();
    await page.getByRole("option", { name: "Title Z-A" }).click();

    await expect(async () => {
      const count = await pageItems.count();
      expect(count).toBe(initialCount);
    }).toPass({ timeout: 5_000 });

    // Collect titles in Z-A order
    const titlesZA = await collectTitles(pageItems, 10);

    // Verify Z-A order: each consecutive pair should be in descending order
    for (let i = 1; i < titlesZA.length; i++) {
      expect(titlesZA[i - 1].localeCompare(titlesZA[i])).toBeGreaterThanOrEqual(
        0,
      );
    }

    // Verify A-Z and Z-A are different orderings (not all identical titles)
    const allSame = titlesAZ.every((t) => t === titlesAZ[0]);
    if (!allSame) {
      expect(titlesAZ).not.toEqual(titlesZA);
    }
  });

  test("clicking a page in the list navigates to that page", async ({
    authenticatedPage: page,
  }) => {
    const main = page.locator("#main-content");
    await waitForWorkspaceHome(main);

    const pageItems = getPageListItems(main);
    await expect(pageItems.first()).toBeVisible({ timeout: 10_000 });

    const count = await pageItems.count();
    if (count === 0) {
      test.skip(true, "No pages available to navigate to");
      return;
    }

    const urlBefore = page.url();

    // Click the first page item
    await pageItems.first().click();

    // Should navigate to the page — URL contains a UUID page ID
    await page.waitForURL(
      (url) => /\/[^/]+\/[0-9a-f-]{36}/.test(url.pathname),
      { timeout: 15_000 },
    );

    expect(page.url()).not.toBe(urlBefore);

    // The page should render — either an editor or a database view
    const editor = page.locator('[contenteditable="true"]');
    const dbView = page.locator('[data-testid="db-view-tabs"]');
    const titleInput = page.locator('input[aria-label="Page title"]');
    await expect(editor.or(dbView).or(titleInput).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("'Clear filter' button appears for non-matching filter and resets the list", async ({
    authenticatedPage: page,
  }) => {
    const main = page.locator("#main-content");
    await waitForWorkspaceHome(main);

    const filterInput = main.getByRole("textbox", { name: /filter pages/i });
    const pageItems = getPageListItems(main);

    await expect(pageItems.first()).toBeVisible({ timeout: 10_000 });
    const initialCount = await pageItems.count();

    if (initialCount === 0) {
      test.skip(true, "No pages available to test clear filter");
      return;
    }

    // Type a filter that matches nothing
    await filterInput.fill("zzz_nonexistent_page_xyz_12345");

    // The "No matches" state should appear with a "Clear filter" button
    const clearButton = main.getByRole("button", { name: /clear filter/i });
    await expect(clearButton).toBeVisible({ timeout: 5_000 });
    await expect(main.locator("text=No matches")).toBeVisible();

    // Click "Clear filter"
    await clearButton.click();

    // The filter input should be cleared
    await expect(filterInput).toHaveValue("");

    // The page list should be restored
    await expect(async () => {
      const restoredCount = await pageItems.count();
      expect(restoredCount).toBe(initialCount);
    }).toPass({ timeout: 5_000 });
  });

  test("'Recently Visited' section shows pages the user has visited", async ({
    authenticatedPage: page,
  }) => {
    const main = page.locator("#main-content");
    await waitForWorkspaceHome(main);

    const pageItems = getPageListItems(main);
    await expect(pageItems.first()).toBeVisible({ timeout: 10_000 });

    const count = await pageItems.count();
    if (count === 0) {
      test.skip(true, "No pages available to visit");
      return;
    }

    // Get the title of the page we'll visit
    const visitedTitle = await pageItems
      .first()
      .locator("span.flex-1")
      .textContent();

    // Click the page to visit it (this records a page_visit server-side)
    await pageItems.first().click();

    // Wait for the page to load
    await page.waitForURL(
      (url) => /\/[^/]+\/[0-9a-f-]{36}/.test(url.pathname),
      { timeout: 15_000 },
    );

    const editor = page.locator('[contenteditable="true"]');
    const dbView = page.locator('[data-testid="db-view-tabs"]');
    const titleInput = page.locator('input[aria-label="Page title"]');
    await expect(editor.or(dbView).or(titleInput).first()).toBeVisible({
      timeout: 10_000,
    });

    // Navigate back to the workspace home
    const pathSegments = new URL(page.url()).pathname
      .split("/")
      .filter(Boolean);
    const workspaceSlug = pathSegments[0];
    await page.goto(`/${workspaceSlug}`);

    // Wait for the workspace home to reload
    await waitForWorkspaceHome(main);

    // The "Recently Visited" section should be visible
    const recentHeading = main.locator("h2").filter({
      hasText: /recently visited/i,
    });
    await expect(recentHeading).toBeVisible({ timeout: 10_000 });

    // The visited page should appear in the recently visited list
    if (visitedTitle && visitedTitle.trim()) {
      const trimmedTitle = visitedTitle.trim();
      // The recently visited section is the parent div of the heading
      const recentContainer = recentHeading.locator("..").first();
      const recentItem = recentContainer.locator("button", {
        hasText: trimmedTitle,
      });
      await expect(recentItem.first()).toBeVisible({ timeout: 5_000 });
    }
  });
});
