import { test, expect } from "./fixtures/auth";

const MOBILE_VIEWPORT = { width: 375, height: 667 };
const DESKTOP_VIEWPORT = { width: 1280, height: 720 };
const SHEET_SELECTOR = '[data-slot="sheet-content"]';

test.describe("Responsive sidebar behavior", () => {
  test("mobile: sidebar is hidden by default and opens as a Sheet overlay", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);

    // Wait for the app to settle after viewport change

    // Desktop aside should not be visible at mobile viewport
    const aside = page.locator("aside");
    await expect(aside).toHaveCount(0);

    // The Sheet content should not be visible initially
    const sheetContent = page.locator('[data-slot="sheet-content"]');
    await expect(sheetContent).toBeHidden();

    // Mobile header with hamburger button should be visible
    const toggleButton = page.getByTestId("as-sidebar-toggle");
    await expect(toggleButton).toBeVisible({ timeout: 5_000 });

    // Click the hamburger to open the Sheet sidebar
    await toggleButton.click();

    // Sheet overlay and content should now be visible
    await expect(sheetContent).toBeVisible({ timeout: 5_000 });
    expect(await sheetContent.getAttribute("data-side")).toBe("left");

    // Verify the Sheet rendered with sidebar structure
    const sidebarContent = sheetContent.locator("div").first();
    await expect(sidebarContent).toBeVisible();
  });

  test("desktop: sidebar is visible as a persistent aside", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);

    // Wait for the app to settle after viewport change

    // Desktop aside should be visible
    const aside = page.locator("aside");
    await expect(aside).toBeVisible({ timeout: 5_000 });

    // Aside should have non-zero width (open state = 240px)
    const box = await aside.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);

    // The mobile hamburger toggle should NOT be visible on desktop
    const toggleButton = page.getByTestId("as-sidebar-toggle");
    await expect(toggleButton).toBeHidden();

    // Sheet overlay should not be present
    const sheetContent = page.locator('[data-slot="sheet-content"]');
    await expect(sheetContent).toBeHidden();
  });

  test("keyboard shortcut Ctrl+\\ toggles sidebar visibility on desktop", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);

    // Sidebar should be open initially
    const aside = page.locator("aside");
    await expect(aside).toBeVisible({ timeout: 5_000 });

    const initialBox = await aside.boundingBox();
    expect(initialBox).not.toBeNull();
    expect(initialBox!.width).toBeGreaterThan(0);

    // Press Ctrl+\ to close the sidebar
    await page.keyboard.press("Control+\\");

    // Wait for the CSS transition (duration-200) to complete
    await expect(async () => {
      const box = await aside.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeLessThanOrEqual(1);
    }).toPass({ timeout: 3_000 });

    // Press Ctrl+\ again to reopen
    await page.keyboard.press("Control+\\");

    // Wait for the sidebar to expand back
    await expect(async () => {
      const box = await aside.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(100);
    }).toPass({ timeout: 3_000 });
  });

  test("mobile: sidebar Sheet closes automatically after navigating via a page link", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);

    const sheetContent = page.locator(SHEET_SELECTOR);
    await expect(sheetContent).toBeHidden();

    // Open the sidebar Sheet
    const toggleButton = page.getByTestId("as-sidebar-toggle");
    await expect(toggleButton).toBeVisible({ timeout: 5_000 });
    await toggleButton.click();
    await expect(sheetContent).toBeVisible({ timeout: 5_000 });

    // Wait for the page tree to load inside the Sheet
    const treeItem = sheetContent.locator('[role="treeitem"]').first();
    try {
      await expect(treeItem).toBeVisible({ timeout: 10_000 });
    } catch {
      // No pages exist — create one so we can navigate
      const newPageBtn = sheetContent.getByTestId("sb-new-page-btn");
      if ((await newPageBtn.count()) > 0) {
        await newPageBtn.click();
        // Wait for navigation to the new page
        await page.waitForURL(
          (url) => url.pathname.split("/").filter(Boolean).length >= 2,
          { timeout: 10_000 },
        );
        // Sheet should have closed after navigation
        await expect(sheetContent).toBeHidden({ timeout: 5_000 });
        return;
      }
      test.skip(true, "No pages and no new-page button available");
      return;
    }

    // Record the current URL before clicking
    const urlBefore = page.url();

    // Click the first page link in the tree to navigate
    await treeItem.click();

    // Wait for the URL to change (navigation occurred)
    await page.waitForURL((url) => url.href !== urlBefore, { timeout: 10_000 });

    // The Sheet sidebar should close automatically after navigation
    await expect(sheetContent).toBeHidden({ timeout: 5_000 });
  });
});
