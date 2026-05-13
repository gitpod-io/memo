import { test, expect } from "./fixtures/auth";

/**
 * Helper: wait for the sidebar to be ready so keyboard shortcuts
 * are registered (they live in SidebarProvider).
 * Then click the main content area to ensure no input is focused.
 */
async function waitForAppReady(page: import("@playwright/test").Page) {
  const sidebar = page.getByRole("complementary");
  await expect(sidebar).toBeVisible({ timeout: 10_000 });

  // Click the main content area to ensure focus is not in an input/editor,
  // which would prevent the ? shortcut from firing.
  const main = page.locator("#main-content, main, [role='main']").first();
  if ((await main.count()) > 0) {
    await main.click({ position: { x: 10, y: 10 }, force: true });
  } else {
    await page.locator("body").click({ position: { x: 400, y: 300 }, force: true });
  }
}

/**
 * Helper: press the ? key to open the keyboard shortcuts dialog.
 * Uses dispatchEvent to reliably produce a "?" keydown event,
 * since Playwright's keyboard.press("Shift+/") may not produce
 * the correct key value on all keyboard layouts.
 */
async function pressQuestionMark(page: import("@playwright/test").Page) {
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
}

test.describe("Keyboard shortcuts dialog", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await waitForAppReady(page);
  });

  test("opens via ? key and displays shortcut categories", async ({
    authenticatedPage: page,
  }) => {
    await pressQuestionMark(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Verify the dialog title
    await expect(
      dialog.getByRole("heading", { name: "Keyboard shortcuts" }),
    ).toBeVisible();

    // Verify all section categories are displayed
    const expectedSections = [
      "Global",
      "Editor — Formatting",
      "Editor — Blocks",
      "Database Table",
      "Database Board",
      "Database Gallery",
      "Database List",
      "Database Calendar",
    ];

    for (const section of expectedSections) {
      await expect(dialog.getByText(section, { exact: true })).toBeVisible();
    }
  });

  test("displays at least one shortcut from each category", async ({
    authenticatedPage: page,
  }) => {
    await pressQuestionMark(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Verify a representative shortcut from each category
    // Global
    await expect(dialog.getByText("Search pages")).toBeVisible();
    // Editor — Formatting
    await expect(dialog.getByText("Bold")).toBeVisible();
    // Editor — Blocks
    await expect(dialog.getByText("Slash commands")).toBeVisible();
    // Database Table
    await expect(dialog.getByText("Navigate between cells")).toBeVisible();
    // Database Board
    await expect(
      dialog.getByText("Navigate between cards in a column"),
    ).toBeVisible();
    // Database Gallery
    await expect(
      dialog.getByText("Navigate between cards", { exact: true }),
    ).toBeVisible();
    // Database List
    await expect(dialog.getByText("Jump to first row")).toBeVisible();
    // Database Calendar
    await expect(dialog.getByText("Previous month")).toBeVisible();
  });

  test("closes on Escape key", async ({ authenticatedPage: page }) => {
    await pressQuestionMark(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Press Escape to close
    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden({ timeout: 3_000 });
  });

  test("opens via user menu", async ({ authenticatedPage: page }) => {
    // Find the user menu trigger in the sidebar footer.
    // It's a ghost button containing a User icon (lucide-user).
    const sidebar = page.getByRole("complementary");

    // The user menu trigger contains an SVG with class lucide-user
    const userTrigger = sidebar.locator("button").filter({
      has: page.locator("svg.lucide-user"),
    });

    await expect(userTrigger).toBeVisible({ timeout: 5_000 });
    await userTrigger.click();

    // Wait for the dropdown menu to appear
    const menuItem = page.getByRole("menuitem", {
      name: /keyboard shortcuts/i,
    });
    await expect(menuItem).toBeVisible({ timeout: 5_000 });

    // Click the "Keyboard shortcuts" menu item
    await menuItem.click();

    // The dialog should now be open
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(
      dialog.getByRole("heading", { name: "Keyboard shortcuts" }),
    ).toBeVisible();
  });

  test("does not open ? shortcut when input is focused", async ({
    authenticatedPage: page,
  }) => {
    // Focus the search input in the sidebar
    const sidebar = page.getByRole("complementary");
    const searchInput = sidebar
      .locator('input[type="text"], input[type="search"]')
      .first();

    // If there's a search input, focus it and try the shortcut
    if ((await searchInput.count()) > 0) {
      await searchInput.click();

      // Dispatch the ? keydown on the focused input element so e.target
      // is the input — matching real browser behavior.
      await page.evaluate(() => {
        const el = document.activeElement;
        if (el) {
          el.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "?",
              code: "Slash",
              shiftKey: true,
              bubbles: true,
              cancelable: true,
            }),
          );
        }
      });

      // Dialog should NOT open when an input is focused.
      // Confirm the input still has focus (positive signal that the event was processed),
      // then verify no dialog appeared.
      await expect(searchInput).toBeFocused();
      const dialog = page.getByRole("dialog");
      await expect(dialog).not.toBeVisible();
    }
  });
});
