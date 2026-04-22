import { test, expect } from "./fixtures/auth";
import { modifierKey } from "./fixtures/editor-helpers";

const mod = modifierKey();

test.describe("Sidebar Favorites", () => {
  // Run serially — all tests share the same user account and its favorites state
  test.describe.configure({ mode: "serial" });

  /**
   * Helper: wait for the page tree to finish loading.
   */
  async function waitForTree(page: import("@playwright/test").Page) {
    const sidebar = page.getByRole("complementary");
    const treeLoaded = sidebar
      .locator('[role="treeitem"], :text("No pages yet")')
      .first();
    await expect(treeLoaded).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Helper: create a new page, give it a unique title, and return the page ID.
   */
  async function createPageWithTitle(
    page: import("@playwright/test").Page,
    title: string,
  ): Promise<string> {
    const sidebar = page.getByRole("complementary");
    const newPageBtn = sidebar.getByRole("button", { name: /new page/i });
    await newPageBtn.click();

    await page.waitForURL(
      (url) => url.pathname.split("/").filter(Boolean).length >= 2,
      { timeout: 10_000 },
    );

    // Wait for the title input and type the title
    const titleInput = page.locator('input[aria-label="Page title"]');
    await expect(titleInput).toBeVisible({ timeout: 10_000 });
    await titleInput.fill(title);
    await page.keyboard.press("Enter");

    // Wait for the title to propagate to the sidebar
    await page.waitForTimeout(1_000);

    // Extract page ID from URL
    const segments = new URL(page.url()).pathname.split("/").filter(Boolean);
    return segments[segments.length - 1];
  }

  /**
   * Helper: get the currently selected tree item.
   */
  function getSelectedTreeItem(page: import("@playwright/test").Page) {
    const sidebar = page.getByRole("complementary");
    return sidebar.locator('[role="treeitem"][aria-selected="true"]');
  }

  /**
   * Helper: open the context menu for a tree item and click a menu item.
   */
  async function openContextMenuAndClick(
    page: import("@playwright/test").Page,
    treeItem: import("@playwright/test").Locator,
    menuItemName: RegExp,
  ) {
    await treeItem.hover();
    await page.waitForTimeout(300);

    const moreBtn = treeItem.locator('[aria-label="Page actions"]');
    await expect(moreBtn).toBeVisible({ timeout: 3_000 });
    await moreBtn.click();
    await page.waitForTimeout(300);

    const menuItem = page.getByRole("menuitem", { name: menuItemName });
    await expect(menuItem).toBeVisible({ timeout: 3_000 });
    await menuItem.click();
  }

  /**
   * Helper: get the favorites section heading locator.
   */
  function getFavoritesHeading(page: import("@playwright/test").Page) {
    const sidebar = page.getByRole("complementary");
    return sidebar.getByText("Favorites", { exact: true });
  }

  /**
   * Helper: count the number of favorite items currently displayed.
   */
  async function countFavorites(
    page: import("@playwright/test").Page,
  ): Promise<number> {
    const favoritesHeading = getFavoritesHeading(page);
    const isVisible = await favoritesHeading.isVisible().catch(() => false);
    if (!isVisible) return 0;
    const favoritesSection = favoritesHeading.locator("..");
    return favoritesSection.locator("button.flex-1").count();
  }

  /**
   * Helper: remove all existing favorites to start from a clean state.
   * The remove button uses opacity-0/group-hover:opacity-100, so we hover
   * the row first to make it visible, then click.
   */
  async function removeAllFavorites(page: import("@playwright/test").Page) {
    const favoritesHeading = getFavoritesHeading(page);

    // Keep removing until the section disappears or we run out of items
    for (let i = 0; i < 20; i++) {
      const isVisible = await favoritesHeading.isVisible().catch(() => false);
      if (!isVisible) break;

      const favoritesSection = favoritesHeading.locator("..");
      const removeBtn = favoritesSection
        .getByRole("button", { name: /remove from favorites/i })
        .first();

      // The button exists in DOM but is invisible (opacity-0).
      // Hover the parent row to trigger group-hover.
      const favoriteRow = favoritesSection.locator("div.group").first();
      const rowExists = await favoriteRow.isVisible().catch(() => false);
      if (!rowExists) break;

      await favoriteRow.hover();
      await page.waitForTimeout(300);

      // Click the remove button — use force since opacity transition may lag
      await removeBtn.click({ force: true });
      await page.waitForTimeout(500);
    }
  }

  test("user can add a page to favorites from context menu", async ({
    authenticatedPage: page,
  }) => {
    await waitForTree(page);

    // Clean up any pre-existing favorites
    await removeAllFavorites(page);

    const title = `FavTest Add ${Date.now()}`;
    await createPageWithTitle(page, title);

    const selectedItem = getSelectedTreeItem(page);
    await expect(selectedItem).toBeVisible({ timeout: 10_000 });

    // Favorites section should not be visible (we cleaned up)
    const favoritesHeading = getFavoritesHeading(page);
    await expect(favoritesHeading).not.toBeVisible();

    // Add to favorites via context menu
    await openContextMenuAndClick(page, selectedItem, /add to favorites/i);

    // Favorites section should now appear
    await expect(favoritesHeading).toBeVisible({ timeout: 5_000 });
  });

  test("favorited page appears in the Favorites section", async ({
    authenticatedPage: page,
  }) => {
    await waitForTree(page);
    await removeAllFavorites(page);

    const title = `FavTest Appear ${Date.now()}`;
    await createPageWithTitle(page, title);

    const selectedItem = getSelectedTreeItem(page);
    await expect(selectedItem).toBeVisible({ timeout: 10_000 });

    // Add to favorites
    await openContextMenuAndClick(page, selectedItem, /add to favorites/i);

    // The Favorites section should now be visible
    const favoritesHeading = getFavoritesHeading(page);
    await expect(favoritesHeading).toBeVisible({ timeout: 5_000 });

    // The favorited page should appear with its title
    const favoritesSection = favoritesHeading.locator("..");
    const favoriteBtn = favoritesSection.locator("button.flex-1", {
      hasText: title,
    });
    await expect(favoriteBtn).toBeVisible({ timeout: 3_000 });
  });

  test("user can remove a page from favorites via context menu", async ({
    authenticatedPage: page,
  }) => {
    await waitForTree(page);
    await removeAllFavorites(page);

    const title = `FavTest Remove ${Date.now()}`;
    await createPageWithTitle(page, title);

    const selectedItem = getSelectedTreeItem(page);
    await expect(selectedItem).toBeVisible({ timeout: 10_000 });

    // Add to favorites first
    await openContextMenuAndClick(page, selectedItem, /add to favorites/i);

    const favoritesHeading = getFavoritesHeading(page);
    await expect(favoritesHeading).toBeVisible({ timeout: 5_000 });

    // Remove from favorites via context menu
    await openContextMenuAndClick(
      page,
      selectedItem,
      /remove from favorites/i,
    );

    // Favorites section should disappear (we cleaned up all others first)
    await expect(favoritesHeading).not.toBeVisible({ timeout: 5_000 });
  });

  test("user can remove a favorite using the remove button in favorites section", async ({
    authenticatedPage: page,
  }) => {
    await waitForTree(page);
    await removeAllFavorites(page);

    const title = `FavTest RemoveBtn ${Date.now()}`;
    await createPageWithTitle(page, title);

    const selectedItem = getSelectedTreeItem(page);
    await expect(selectedItem).toBeVisible({ timeout: 10_000 });

    // Add to favorites
    await openContextMenuAndClick(page, selectedItem, /add to favorites/i);

    const favoritesHeading = getFavoritesHeading(page);
    await expect(favoritesHeading).toBeVisible({ timeout: 5_000 });

    // Hover over the favorite item to reveal the remove button
    const favoritesSection = favoritesHeading.locator("..");
    const favoriteRow = favoritesSection.locator("div.group").first();
    await favoriteRow.hover();

    const removeBtn = favoritesSection.getByRole("button", {
      name: /remove from favorites/i,
    });
    await expect(removeBtn).toBeVisible({ timeout: 3_000 });
    await removeBtn.click();

    // Favorites section should disappear
    await expect(favoritesHeading).not.toBeVisible({ timeout: 5_000 });
  });

  test("clicking a favorite navigates to the correct page", async ({
    authenticatedPage: page,
  }) => {
    await waitForTree(page);
    await removeAllFavorites(page);

    const title = `FavTest Nav ${Date.now()}`;
    const pageId = await createPageWithTitle(page, title);

    const selectedItem = getSelectedTreeItem(page);
    await expect(selectedItem).toBeVisible({ timeout: 10_000 });

    // Add to favorites
    await openContextMenuAndClick(page, selectedItem, /add to favorites/i);
    await expect(getFavoritesHeading(page)).toBeVisible({ timeout: 5_000 });

    // Navigate away from the current page (go to workspace root)
    const workspaceSlug = new URL(page.url()).pathname
      .split("/")
      .filter(Boolean)[0];
    await page.goto(`/${workspaceSlug}`);
    await waitForTree(page);

    // Wait for favorites section to load
    const favoritesHeading = getFavoritesHeading(page);
    await expect(favoritesHeading).toBeVisible({ timeout: 10_000 });

    // Click the favorite with the matching title
    const favoritesSection = favoritesHeading.locator("..");
    const favoriteBtn = favoritesSection.locator("button.flex-1", {
      hasText: title,
    });
    await expect(favoriteBtn).toBeVisible({ timeout: 3_000 });
    await favoriteBtn.click();

    // URL should contain the page ID
    await page.waitForURL((url) => url.pathname.includes(pageId), {
      timeout: 10_000,
    });

    expect(page.url()).toContain(pageId);
  });

  test("favorites section is hidden when no pages are favorited", async ({
    authenticatedPage: page,
  }) => {
    await waitForTree(page);
    await removeAllFavorites(page);

    // Favorites section should not be visible (no favorites)
    const favoritesHeading = getFavoritesHeading(page);
    await expect(favoritesHeading).not.toBeVisible();

    // Create a page and add to favorites
    const title = `FavTest Hidden ${Date.now()}`;
    await createPageWithTitle(page, title);

    const selectedItem = getSelectedTreeItem(page);
    await expect(selectedItem).toBeVisible({ timeout: 10_000 });

    await openContextMenuAndClick(page, selectedItem, /add to favorites/i);
    await expect(favoritesHeading).toBeVisible({ timeout: 5_000 });

    // Remove from favorites
    await openContextMenuAndClick(
      page,
      selectedItem,
      /remove from favorites/i,
    );

    // Favorites section should be hidden again. The removal triggers an async
    // re-fetch via the favorites-changed event, so allow extra time.
    await expect(favoritesHeading).not.toBeVisible({ timeout: 10_000 });
  });

  test("favorites persist across page navigation", async ({
    authenticatedPage: page,
  }) => {
    await waitForTree(page);
    await removeAllFavorites(page);

    const title = `FavTest Persist ${Date.now()}`;
    await createPageWithTitle(page, title);

    const selectedItem = getSelectedTreeItem(page);
    await expect(selectedItem).toBeVisible({ timeout: 10_000 });

    // Add to favorites
    await openContextMenuAndClick(page, selectedItem, /add to favorites/i);

    const favoritesHeading = getFavoritesHeading(page);
    await expect(favoritesHeading).toBeVisible({ timeout: 5_000 });

    // Create a second page (navigates away from the first)
    await createPageWithTitle(page, `FavTest Other ${Date.now()}`);

    // Favorites section should still be visible after navigating to the new page
    await expect(favoritesHeading).toBeVisible({ timeout: 10_000 });

    // The original favorite should still be listed with its title
    const favoritesSection = favoritesHeading.locator("..");
    const favoriteBtn = favoritesSection.locator("button.flex-1", {
      hasText: title,
    });
    await expect(favoriteBtn).toBeVisible({ timeout: 3_000 });
  });
});
