import { test, expect } from "./fixtures/auth";

test.describe("Workspace home — New Database button", () => {
  test("creates a database and navigates to it", async ({
    authenticatedPage: page,
  }) => {
    // Scope to main content to avoid matching the sidebar's "New Database" button
    const main = page.locator("#main-content");

    // Wait for the workspace home page to load (the heading and buttons)
    const newDbButton = main.getByTestId("wh-new-database-btn");
    await expect(newDbButton).toBeVisible({ timeout: 15_000 });

    // Click the "New Database" button
    await newDbButton.click();

    // Should navigate to the new database page — URL contains a UUID page ID
    await page.waitForURL(
      (url) => /\/[^/]+\/[0-9a-f-]{36}/.test(url.pathname),
      { timeout: 15_000 },
    );

    // The database view should render — look for the view tabs bar
    // that createDatabase sets up with a "Default view" tab
    const dbIndicator = page.locator('[data-testid="db-view-tabs"]');
    await expect(dbIndicator).toBeVisible({ timeout: 15_000 });
  });
});
