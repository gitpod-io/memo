import { test, expect } from "./fixtures/auth";

const MOBILE_VIEWPORT = { width: 375, height: 667 };

test.describe("Workspace home — mobile header layout", () => {
  test("header buttons do not overflow viewport on mobile", async ({
    authenticatedPage: page,
  }) => {
    // Resize to mobile after authentication completes
    await page.setViewportSize(MOBILE_VIEWPORT);

    // Navigate to workspace home (root redirects there after auth)
    await page.goto("/");
    const main = page.locator("#main-content");

    // Wait for the workspace home to load — look for the header
    const header = main.getByTestId("wh-header");
    await expect(header).toBeVisible({ timeout: 15_000 });

    const dbButton = main.getByTestId("wh-new-database-btn");
    const pageButton = main.getByTestId("wh-new-page-btn");
    await expect(dbButton).toBeVisible({ timeout: 5_000 });
    await expect(pageButton).toBeVisible({ timeout: 5_000 });

    // Verify no button extends beyond the viewport width
    const dbBox = await dbButton.boundingBox();
    const pageBox = await pageButton.boundingBox();
    expect(dbBox).not.toBeNull();
    expect(pageBox).not.toBeNull();

    expect(dbBox!.x + dbBox!.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
    expect(pageBox!.x + pageBox!.width).toBeLessThanOrEqual(
      MOBILE_VIEWPORT.width,
    );

    // Verify no horizontal scrollbar — document width should not exceed viewport
    const docWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(docWidth).toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
  });
});
