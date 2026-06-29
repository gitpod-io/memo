import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage } from "./fixtures/editor-helpers";

test.describe("Sidebar 'Open in new tab' action", () => {
  test("'Open in new tab' appears in the page actions dropdown", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const sidebar = page.getByRole("complementary");
    const selectedItem = sidebar.locator(
      '[role="treeitem"][aria-selected="true"]',
    );
    await expect(selectedItem).toBeVisible({ timeout: 10_000 });

    await selectedItem.hover();

    const moreBtn = selectedItem.locator('[aria-label="Page actions"]');
    await expect(moreBtn).toBeVisible({ timeout: 3_000 });
    await moreBtn.click();

    const openNewTabItem = page.getByRole("menuitem", {
      name: /open in new tab/i,
    });
    await expect(openNewTabItem).toBeVisible({ timeout: 3_000 });
  });

  test("'Open in new tab' is positioned after 'Add sub-page' and before favorites", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const sidebar = page.getByRole("complementary");
    const selectedItem = sidebar.locator(
      '[role="treeitem"][aria-selected="true"]',
    );
    await expect(selectedItem).toBeVisible({ timeout: 10_000 });

    await selectedItem.hover();

    const moreBtn = selectedItem.locator('[aria-label="Page actions"]');
    await expect(moreBtn).toBeVisible({ timeout: 3_000 });
    await moreBtn.click();

    // Scope to the open dropdown menu and verify item order
    const menu = page.getByRole("menu", { name: "Page actions" });
    await expect(menu).toBeVisible({ timeout: 3_000 });

    const menuItems = menu.getByRole("menuitem");
    const texts = await menuItems.allInnerTexts();

    const addSubPageIdx = texts.findIndex((t) => /add sub-page/i.test(t));
    const openNewTabIdx = texts.findIndex((t) => /open in new tab/i.test(t));
    const favoritesIdx = texts.findIndex((t) =>
      /add to favorites|remove from favorites/i.test(t),
    );

    expect(addSubPageIdx).toBeGreaterThanOrEqual(0);
    expect(openNewTabIdx).toBeGreaterThanOrEqual(0);
    expect(favoritesIdx).toBeGreaterThanOrEqual(0);
    expect(openNewTabIdx).toBe(addSubPageIdx + 1);
    expect(openNewTabIdx).toBeLessThan(favoritesIdx);
  });

  test("clicking 'Open in new tab' opens a new tab with the page URL", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const sidebar = page.getByRole("complementary");
    const selectedItem = sidebar.locator(
      '[role="treeitem"][aria-selected="true"]',
    );
    await expect(selectedItem).toBeVisible({ timeout: 10_000 });

    // Capture the current page URL to verify the new tab opens the same page
    const currentUrl = new URL(page.url());

    await selectedItem.hover();

    const moreBtn = selectedItem.locator('[aria-label="Page actions"]');
    await expect(moreBtn).toBeVisible({ timeout: 3_000 });
    await moreBtn.click();

    const openNewTabItem = page.getByRole("menuitem", {
      name: /open in new tab/i,
    });
    await expect(openNewTabItem).toBeVisible({ timeout: 3_000 });

    // Listen for the new page (tab) to open
    const newPagePromise = page.context().waitForEvent("page", {
      timeout: 5_000,
    });
    await openNewTabItem.click();

    const newPage = await newPagePromise;
    await newPage.waitForLoadState("domcontentloaded");

    // The new tab should navigate to the same page path
    expect(newPage.url()).toContain(currentUrl.pathname);

    await newPage.close();
  });
});
