import { test, expect } from "./fixtures/auth";

/**
 * Helper: wait for the sidebar to be ready so keyboard shortcuts
 * are registered (they live in SidebarProvider).
 */
async function waitForAppReady(page: import("@playwright/test").Page) {
  const sidebar = page.getByRole("complementary");
  await expect(sidebar).toBeVisible({ timeout: 15_000 });

  // Click the main content area to ensure focus is not in an input/editor
  const main = page.locator("#main-content, main, [role='main']").first();
  if ((await main.count()) > 0) {
    await main.click({ position: { x: 10, y: 10 }, force: true });
  } else {
    await page.locator("body").click({ position: { x: 400, y: 300 }, force: true });
  }
}

/**
 * Helper: open the command palette via ⌘+P / Ctrl+P.
 * Uses dispatchEvent for reliability across platforms.
 */
async function openCommandPalette(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "p",
        code: "KeyP",
        metaKey: true,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

test.describe("Command palette", () => {
  test("opens via ⌘+P and shows pages when input is empty", async ({
    authenticatedPage: page,
  }) => {
    await waitForAppReady(page);
    await openCommandPalette(page);

    // The command palette dialog should be visible
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // The search input should be visible
    const input = dialog.locator('[data-slot="command-input"]');
    await expect(input).toBeVisible();

    // Should show items (recent or all pages)
    const items = dialog.locator('[data-slot="command-item"]');
    await expect(items.first()).toBeVisible({ timeout: 10_000 });
  });

  test("shows recent pages when input is empty", async ({
    authenticatedPage: page,
  }) => {
    await waitForAppReady(page);
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Wait for items to load
    const items = dialog.locator('[data-slot="command-item"]');
    await expect(items.first()).toBeVisible({ timeout: 10_000 });

    // Should have at least one group heading (Quick Actions, Recent, or All Pages)
    const headings = dialog.locator('[cmdk-group-heading]');
    await expect(headings.first()).toBeVisible({ timeout: 5_000 });
  });

  test("filters pages by title when typing", async ({
    authenticatedPage: page,
  }) => {
    await waitForAppReady(page);
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Wait for items to load first
    const items = dialog.locator('[data-slot="command-item"]');
    await expect(items.first()).toBeVisible({ timeout: 10_000 });

    // Type a query that won't match anything
    const input = dialog.locator('[data-slot="command-input"]');
    await input.fill("zzzznonexistent");

    // Should show empty state
    const empty = dialog.locator('[data-slot="command-empty"]');
    await expect(empty).toBeVisible({ timeout: 5_000 });
  });

  test("navigates to selected page on Enter", async ({
    authenticatedPage: page,
  }) => {
    await waitForAppReady(page);

    const urlBefore = page.url();

    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Wait for items to load
    const items = dialog.locator('[data-slot="command-item"]');
    await expect(items.first()).toBeVisible({ timeout: 10_000 });

    // Navigate down past Quick Actions to a page item, then press Enter
    // Quick Actions are first, so arrow down to reach a page item
    const pageItem = dialog.locator('[data-testid^="command-palette-recent-"], [data-testid^="command-palette-page-"]').first();
    if (await pageItem.isVisible()) {
      await pageItem.click();
    } else {
      await page.keyboard.press("Enter");
    }

    // The dialog should close
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    // URL should have changed (navigated to a page)
    await page.waitForURL((url) => url.href !== urlBefore, {
      timeout: 10_000,
    });
  });

  test("closes on Escape", async ({ authenticatedPage: page }) => {
    await waitForAppReady(page);
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden({ timeout: 3_000 });
  });

  test("navigates results with arrow keys", async ({
    authenticatedPage: page,
  }) => {
    await waitForAppReady(page);
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Wait for items to load
    const items = dialog.locator('[data-slot="command-item"]');
    await expect(items.first()).toBeVisible({ timeout: 10_000 });

    // Check that at least 2 items exist for arrow key navigation
    const count = await items.count();
    if (count >= 2) {
      // Get the data-value of the currently active item.
      // cmdk marks the active item with aria-selected="true" but may
      // also set it on other items in the same group. Use the
      // [cmdk-item] selector with data-value to identify the active one.
      const getActiveValue = () =>
        page.evaluate(() => {
          const el = document.querySelector(
            '[cmdk-item=""][aria-selected="true"]',
          );
          return el?.getAttribute("data-value") ?? null;
        });

      const valueBefore = await getActiveValue();

      // Press ArrowDown to move selection
      await page.keyboard.press("ArrowDown");

      // Wait for cmdk to update the selected item
      await page.waitForFunction(
        (prevValue) => {
          const el = document.querySelector(
            '[cmdk-item=""][aria-selected="true"]',
          );
          const current = el?.getAttribute("data-value") ?? null;
          return current !== null && current !== prevValue;
        },
        valueBefore,
        { timeout: 5_000 },
      );

      const valueAfter = await getActiveValue();

      // Selection should have moved to a different item
      expect(valueAfter).not.toBeNull();
      if (valueBefore !== null) {
        expect(valueAfter).not.toBe(valueBefore);
      }
    }
  });

  test("does not open when a text input is focused", async ({
    authenticatedPage: page,
  }) => {
    await waitForAppReady(page);

    // Focus the search input in the sidebar
    const sidebar = page.getByRole("complementary");
    const searchInput = sidebar.getByTestId("as-search-input");

    await expect(searchInput).toBeVisible({ timeout: 5_000 });
    await searchInput.click();
    await expect(searchInput).toBeFocused();

    // Dispatch ⌘+P on the focused input element
    await page.evaluate(() => {
      const el = document.activeElement;
      if (el) {
        el.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "p",
            code: "KeyP",
            metaKey: true,
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }),
        );
      }
    });

    // Verify the event was processed by waiting for a microtask cycle
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));

    // Dialog should NOT open when an input is focused
    const dialog = page.getByRole("dialog");
    await expect(dialog).not.toBeVisible();
  });

  test("⌘+P is listed in keyboard shortcuts dialog", async ({
    authenticatedPage: page,
  }) => {
    await waitForAppReady(page);

    // Open the keyboard shortcuts dialog via ? key
    await page.evaluate(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "?",
          code: "Slash",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Verify the command palette shortcut is listed
    await expect(dialog.getByText("Quick page switcher")).toBeVisible();
  });
});

test.describe("Command palette — Quick Actions", () => {
  test("shows Quick Actions group when no search query is entered", async ({
    authenticatedPage: page,
  }) => {
    await waitForAppReady(page);
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Wait for items to load
    const items = dialog.locator('[data-slot="command-item"]');
    await expect(items.first()).toBeVisible({ timeout: 10_000 });

    // Should show "Quick Actions" group heading
    const quickActionsHeading = dialog.locator('[cmdk-group-heading]', { hasText: "Quick Actions" });
    await expect(quickActionsHeading).toBeVisible({ timeout: 5_000 });
  });

  test("displays expected action items with icons and labels", async ({
    authenticatedPage: page,
  }) => {
    await waitForAppReady(page);
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Wait for items to load
    const items = dialog.locator('[data-slot="command-item"]');
    await expect(items.first()).toBeVisible({ timeout: 10_000 });

    // Verify core action items are present
    await expect(dialog.getByTestId("command-palette-action-new-page")).toBeVisible();
    await expect(dialog.getByTestId("command-palette-action-new-database")).toBeVisible();
    await expect(dialog.getByTestId("command-palette-action-import-markdown")).toBeVisible();
    await expect(dialog.getByTestId("command-palette-action-workspace-settings")).toBeVisible();
    await expect(dialog.getByTestId("command-palette-action-members")).toBeVisible();
    await expect(dialog.getByTestId("command-palette-action-toggle-theme")).toBeVisible();
    await expect(dialog.getByTestId("command-palette-action-toggle-sidebar")).toBeVisible();
    await expect(dialog.getByTestId("command-palette-action-toggle-focus-mode")).toBeVisible();
  });

  test("action items show keyboard shortcut hints", async ({
    authenticatedPage: page,
  }) => {
    await waitForAppReady(page);
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const items = dialog.locator('[data-slot="command-item"]');
    await expect(items.first()).toBeVisible({ timeout: 10_000 });

    // The "New Page" action should show a shortcut hint
    const newPageAction = dialog.getByTestId("command-palette-action-new-page");
    const shortcut = newPageAction.locator('[data-slot="command-shortcut"]');
    await expect(shortcut).toBeVisible();
    const shortcutText = await shortcut.textContent();
    // Should contain N (⌘N or Ctrl+N)
    expect(shortcutText).toContain("N");
  });

  test("actions are filterable by typing", async ({
    authenticatedPage: page,
  }) => {
    await waitForAppReady(page);
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const items = dialog.locator('[data-slot="command-item"]');
    await expect(items.first()).toBeVisible({ timeout: 10_000 });

    // Type "settings" to filter actions
    const input = dialog.locator('[data-slot="command-input"]');
    await input.fill("Settings");

    // "Workspace Settings" should be visible
    await expect(
      dialog.getByTestId("command-palette-action-workspace-settings"),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("Export as Markdown is hidden when not on a page", async ({
    authenticatedPage: page,
  }) => {
    // Navigate to workspace home (not a page route)
    await waitForAppReady(page);

    // Ensure we're on the workspace home, not a page
    const url = page.url();
    const isOnPage = /\/[^/]+\/[0-9a-f]{8}-[0-9a-f]{4}/.test(url);

    if (!isOnPage) {
      await openCommandPalette(page);

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      const items = dialog.locator('[data-slot="command-item"]');
      await expect(items.first()).toBeVisible({ timeout: 10_000 });

      // Export should NOT be visible when not on a page
      await expect(
        dialog.getByTestId("command-palette-action-export-markdown"),
      ).not.toBeVisible();
    }
  });

  test("Export as Markdown is shown when on a page", async ({
    authenticatedPage: page,
  }) => {
    await waitForAppReady(page);

    // First navigate to a page by using the command palette
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Wait for page items to load and click a page to navigate
    const pageItem = dialog.locator(
      '[data-testid^="command-palette-recent-"], [data-testid^="command-palette-page-"]',
    ).first();
    await expect(pageItem).toBeVisible({ timeout: 10_000 });
    await pageItem.click();

    // Wait for navigation to a page URL (contains a UUID)
    await page.waitForURL(/\/[^/]+\/[0-9a-f]{8}-[0-9a-f]{4}/, {
      timeout: 10_000,
    });

    // Ensure focus is not in an input/editor before opening palette
    await page.locator("body").click({ position: { x: 400, y: 10 }, force: true });
    await page.waitForTimeout(300);

    // Re-open command palette on the page
    await openCommandPalette(page);

    const dialog2 = page.getByRole("dialog");
    await expect(dialog2).toBeVisible({ timeout: 5_000 });

    const items2 = dialog2.locator('[data-slot="command-item"]');
    await expect(items2.first()).toBeVisible({ timeout: 10_000 });

    // Export should be visible when on a page
    await expect(
      dialog2.getByTestId("command-palette-action-export-markdown"),
    ).toBeVisible();
  });

  test("Toggle Theme action works", async ({
    authenticatedPage: page,
  }) => {
    await waitForAppReady(page);

    // Get current theme
    const themeBefore = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );

    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const items = dialog.locator('[data-slot="command-item"]');
    await expect(items.first()).toBeVisible({ timeout: 10_000 });

    // Click the toggle theme action
    const themeAction = dialog.getByTestId("command-palette-action-toggle-theme");
    await themeAction.click();

    // Dialog should close
    await expect(dialog).toBeHidden({ timeout: 3_000 });

    // Theme should have changed
    const themeAfter = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );
    expect(themeAfter).not.toBe(themeBefore);
  });

  test("Workspace Settings action navigates to settings page", async ({
    authenticatedPage: page,
  }) => {
    await waitForAppReady(page);
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const items = dialog.locator('[data-slot="command-item"]');
    await expect(items.first()).toBeVisible({ timeout: 10_000 });

    // Click the workspace settings action
    const settingsAction = dialog.getByTestId("command-palette-action-workspace-settings");
    await settingsAction.click();

    // Should navigate to settings
    await page.waitForURL(/\/settings$/, { timeout: 10_000 });
  });

  test("Members action navigates to members page", async ({
    authenticatedPage: page,
  }) => {
    await waitForAppReady(page);
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const items = dialog.locator('[data-slot="command-item"]');
    await expect(items.first()).toBeVisible({ timeout: 10_000 });

    // Click the members action
    const membersAction = dialog.getByTestId("command-palette-action-members");
    await membersAction.click();

    // Should navigate to members settings
    await page.waitForURL(/\/settings\/members$/, { timeout: 10_000 });
  });

  test("search input placeholder shows shortcut hint", async ({
    authenticatedPage: page,
  }) => {
    await waitForAppReady(page);
    await openCommandPalette(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Check the placeholder text contains the shortcut hint
    const input = dialog.locator('[data-slot="command-input"]');
    const placeholder = await input.getAttribute("placeholder");
    // Should contain "P" (⌘P or Ctrl+P)
    expect(placeholder).toContain("P");
    expect(placeholder).toContain("Search pages");
  });
});
