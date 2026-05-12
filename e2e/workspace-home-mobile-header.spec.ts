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

    // Wait for the workspace home to load — look for a heading
    const heading = main.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Scope to the header row (the container that holds the h1) to avoid
    // matching sidebar page buttons like "Untitled Database just now".
    const headerRow = heading.locator("..");
    const dbButton = headerRow.getByRole("button", { name: /database/i });
    const pageButton = headerRow.getByRole("button", { name: /page/i });
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
