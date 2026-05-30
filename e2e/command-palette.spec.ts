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

    // Should have at least one group heading (Recent or All Pages)
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

    // Get the title of the first visible item
    const firstItemText = await items.first().textContent();

    // Type a query that won't match anything
    const input = dialog.locator('[data-slot="command-input"]');
    await input.fill("zzzznonexistent");

    // Should show empty state
    const empty = dialog.locator('[data-slot="command-empty"]');
    await expect(empty).toBeVisible({ timeout: 5_000 });

    // Clear and type part of the first item's title to verify filtering works
    if (firstItemText && firstItemText.trim().length > 3) {
      const searchTerm = firstItemText.trim().substring(0, 4);
      await input.fill(searchTerm);

      // Should show at least one result
      await expect(items.first()).toBeVisible({ timeout: 5_000 });
    }
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

    // Press Enter to navigate to the first result
    await page.keyboard.press("Enter");

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
