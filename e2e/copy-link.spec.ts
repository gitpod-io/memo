import { test, expect } from "./fixtures/auth";

/**
 * Dispatch a contextmenu event on an element.
 * @base-ui/react's context menu has timing-sensitive mouseup handling,
 * so we dispatch the contextmenu event directly via evaluate.
 */
async function openContextMenu(
  locator: import("@playwright/test").Locator,
) {
  await locator.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    el.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: rect.x + rect.width / 2,
        clientY: rect.y + rect.height / 2,
        button: 2,
      }),
    );
  });
}

/**
 * Click a context menu item by test ID. @base-ui/react menu items animate
 * on open, so we poll and click via JS as soon as the element appears.
 */
async function clickContextMenuItem(
  page: import("@playwright/test").Page,
  testId: string,
) {
  await page.waitForFunction(
    (id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (el) {
        (el as HTMLElement).click();
        return true;
      }
      return false;
    },
    testId,
    { timeout: 5_000 },
  );
}

async function waitForWorkspaceHome(
  page: import("@playwright/test").Page,
) {
  const main = page.locator("#main-content");
  const filterInput = main.getByTestId("wh-filter-input");
  await expect(filterInput).toBeVisible({ timeout: 15_000 });
}

function getFirstPageItem(page: import("@playwright/test").Page) {
  const main = page.locator("#main-content");
  const section = main.locator('[data-testid="wh-all-pages"]');
  return section.locator("a.text-left.text-sm").first();
}

test.describe("Copy link action", () => {
  test.setTimeout(90_000);

  test("workspace home context menu 'Copy link' copies page URL to clipboard", async ({
    authenticatedPage: page,
  }) => {
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);

    await waitForWorkspaceHome(page);

    const firstItem = getFirstPageItem(page);
    await expect(firstItem).toBeVisible({ timeout: 10_000 });

    // Get the page href to know the expected URL
    const href = await firstItem.getAttribute("href");
    expect(href).toBeTruthy();

    await openContextMenu(firstItem);

    // Verify the Copy link item is visible
    await expect(page.getByTestId("wh-ctx-copy-link")).toBeVisible({
      timeout: 5_000,
    });

    await clickContextMenuItem(page, "wh-ctx-copy-link");

    // Verify toast appears
    const toast = page.locator("[data-sonner-toast]", {
      hasText: "Link copied",
    });
    await expect(toast).toBeVisible({ timeout: 5_000 });

    // Verify clipboard content
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).toContain(href);
  });

  test("page menu 'Copy link' copies page URL to clipboard", async ({
    authenticatedPage: page,
  }) => {
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);

    await waitForWorkspaceHome(page);

    // Create a new page to ensure we get a regular page with the PageMenu
    const sidebar = page.getByRole("complementary");
    const newPageBtn = sidebar.getByTestId("sb-new-page-btn");
    await expect(newPageBtn).toBeVisible({ timeout: 5_000 });
    await newPageBtn.click();

    await page.waitForURL(
      (url) => url.pathname.split("/").filter(Boolean).length >= 2,
      { timeout: 20_000 },
    );

    // Wait for the editor to load (PageMenu is dynamically imported alongside it)
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 15_000 });

    // Open the page menu (⋯ button) — scoped to #main-content to avoid sidebar buttons
    const main = page.locator("#main-content");
    const menuButton = main.locator('button[aria-label="Page actions"]');
    await expect(menuButton).toBeVisible({ timeout: 10_000 });
    await menuButton.click();

    // Click "Copy link"
    const copyLinkItem = page.getByRole("menuitem", { name: "Copy link" });
    await expect(copyLinkItem).toBeVisible({ timeout: 5_000 });
    await copyLinkItem.click();

    // Verify toast appears
    const toast = page.locator("[data-sonner-toast]", {
      hasText: "Link copied",
    });
    await expect(toast).toBeVisible({ timeout: 5_000 });

    // Verify clipboard content contains the page URL
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).toMatch(/https?:\/\/.+\/[^/]+\/[0-9a-f-]{36}/);
  });

  test("sidebar page tree dropdown 'Copy link' copies page URL to clipboard", async ({
    authenticatedPage: page,
  }) => {
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);

    await waitForWorkspaceHome(page);

    // Find a page tree item in the sidebar
    const sidebar = page.getByRole("complementary");
    const treeItem = sidebar.locator("[role='treeitem']").first();
    await expect(treeItem).toBeVisible({ timeout: 10_000 });

    // Hover to reveal the actions button
    await treeItem.hover();

    // Click the "Page actions" button (⋯) scoped to this tree item
    const actionsButton = treeItem.locator('[aria-label="Page actions"]');
    await expect(actionsButton).toBeVisible({ timeout: 5_000 });
    await actionsButton.click();

    // Click "Copy link"
    const copyLinkItem = page.getByRole("menuitem", { name: "Copy link" });
    await expect(copyLinkItem).toBeVisible({ timeout: 5_000 });
    await copyLinkItem.click();

    // Verify toast appears
    const toast = page.locator("[data-sonner-toast]", {
      hasText: "Link copied",
    });
    await expect(toast).toBeVisible({ timeout: 5_000 });

    // Verify clipboard has a URL
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).toMatch(/https?:\/\/.+\/[^/]+\/[0-9a-f-]{36}/);
  });
});
