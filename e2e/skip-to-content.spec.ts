import { test, expect } from "./fixtures/auth";

test.describe("skip to content link", () => {
  test("is the first focusable element and moves focus to main", async ({
    authenticatedPage: page,
  }) => {
    // Press Tab — the skip link should be the first element to receive focus
    await page.keyboard.press("Tab");

    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toHaveText("Skip to content");

    // The link should be visible when focused (not sr-only)
    await expect(skipLink).toBeVisible();

    // Activate the skip link
    await page.keyboard.press("Enter");

    // Focus should move to the main content area
    const main = page.locator("main#main-content");
    await expect(main).toBeFocused();
  });

  test("is visually hidden when not focused", async ({
    authenticatedPage: page,
  }) => {
    const skipLink = page.locator('a[href="#main-content"]');

    // The link exists in the DOM but is visually hidden (sr-only)
    await expect(skipLink).toBeAttached();
    const box = await skipLink.boundingBox();
    // sr-only makes the element 1x1px and clips it
    expect(box?.width).toBeLessThanOrEqual(1);
    expect(box?.height).toBeLessThanOrEqual(1);
  });
});
