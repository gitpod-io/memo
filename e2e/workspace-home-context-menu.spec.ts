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

/**
 * Wait for the workspace home page to fully load.
 */
async function waitForWorkspaceHome(
  page: import("@playwright/test").Page,
) {
  const main = page.locator("#main-content");
  const filterInput = main.getByTestId("wh-filter-input");
  await expect(filterInput).toBeVisible({ timeout: 15_000 });
}

/**
 * Get the first page item button in the "All Pages" section.
 */
function getFirstPageItem(page: import("@playwright/test").Page) {
  const main = page.locator("#main-content");
  const section = main.locator('[data-testid="wh-all-pages"]');
  return section.locator("button.text-left.text-sm").first();
}

test.describe("Workspace home context menu", () => {
  test.setTimeout(90_000);

  test("right-clicking a page item opens a context menu with expected actions", async ({
    authenticatedPage: page,
  }) => {
    await waitForWorkspaceHome(page);

    const firstItem = getFirstPageItem(page);
    await expect(firstItem).toBeVisible({ timeout: 10_000 });

    // Right-click to open context menu
    await openContextMenu(firstItem);

    // Verify all expected menu items appear
    await page.waitForFunction(
      () => document.querySelector('[data-testid="wh-context-menu"]') !== null,
      { timeout: 5_000 },
    );

    const menu = page.getByTestId("wh-context-menu");
    await expect(menu).toBeVisible({ timeout: 5_000 });

    // Check for all expected items
    await expect(page.getByTestId("wh-ctx-open")).toBeVisible();
    await expect(page.getByTestId("wh-ctx-open-new-tab")).toBeVisible();
    await expect(page.getByTestId("wh-ctx-toggle-favorite")).toBeVisible();
    await expect(page.getByTestId("wh-ctx-duplicate")).toBeVisible();
    await expect(page.getByTestId("wh-ctx-delete")).toBeVisible();
  });

  test("'Open' navigates to the page", async ({
    authenticatedPage: page,
  }) => {
    await waitForWorkspaceHome(page);

    const firstItem = getFirstPageItem(page);
    await expect(firstItem).toBeVisible({ timeout: 10_000 });

    const urlBefore = page.url();

    await openContextMenu(firstItem);
    await clickContextMenuItem(page, "wh-ctx-open");

    // Should navigate to the page — URL contains a UUID page ID
    await page.waitForURL(
      (url) => /\/[^/]+\/[0-9a-f-]{36}/.test(url.pathname),
      { timeout: 15_000 },
    );

    expect(page.url()).not.toBe(urlBefore);
  });

  test("'Delete' soft-deletes the page and shows undo toast", async ({
    authenticatedPage: page,
  }) => {
    await waitForWorkspaceHome(page);

    const firstItem = getFirstPageItem(page);
    await expect(firstItem).toBeVisible({ timeout: 10_000 });

    // Right-click and delete
    await openContextMenu(firstItem);
    await clickContextMenuItem(page, "wh-ctx-delete");

    // An undo toast should appear — this confirms the delete action fired
    const undoToast = page.locator('[data-sonner-toast]', {
      hasText: "Page moved to trash",
    });
    await expect(undoToast).toBeVisible({ timeout: 10_000 });

    // Verify the undo button is present
    const undoButton = undoToast.getByRole("button", { name: /undo/i });
    await expect(undoButton).toBeVisible({ timeout: 5_000 });

    // Click Undo to restore the page
    await undoButton.click();

    // Wait for the restore to complete — the trash-changed event fires
    // and router.refresh() re-fetches the page list
    await page.waitForTimeout(2_000);

    // Verify the page list is still visible after undo
    await expect(firstItem).toBeVisible({ timeout: 10_000 });
  });

  test("'Add to favorites' toggles favorite status", async ({
    authenticatedPage: page,
  }) => {
    await waitForWorkspaceHome(page);

    const firstItem = getFirstPageItem(page);
    await expect(firstItem).toBeVisible({ timeout: 10_000 });

    // Open context menu and check the initial favorite toggle text
    await openContextMenu(firstItem);

    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="wh-ctx-toggle-favorite"]') !==
        null,
      { timeout: 5_000 },
    );

    const favText = await page
      .getByTestId("wh-ctx-toggle-favorite")
      .textContent();
    const wasFavorited = favText?.includes("Remove from favorites");
    const expectedAfterToggle = wasFavorited
      ? "Add to favorites"
      : "Remove from favorites";

    // Click the favorite toggle
    await clickContextMenuItem(page, "wh-ctx-toggle-favorite");

    // Poll: re-open context menu until the text flips.
    // The favorites-changed event triggers a re-fetch, which is async.
    await expect(async () => {
      // Small delay to let the menu close and state update
      await page.waitForTimeout(500);

      await openContextMenu(firstItem);

      await page.waitForFunction(
        () =>
          document.querySelector(
            '[data-testid="wh-ctx-toggle-favorite"]',
          ) !== null,
        { timeout: 3_000 },
      );

      const newText = await page
        .getByTestId("wh-ctx-toggle-favorite")
        .textContent();
      expect(newText).toContain(expectedAfterToggle);
    }).toPass({ timeout: 15_000 });

    // Clean up: toggle back to original state
    await clickContextMenuItem(page, "wh-ctx-toggle-favorite");
  });
});
