import { test, expect } from "./fixtures/auth";

const MOBILE_VIEWPORT = { width: 375, height: 667 };
const DESKTOP_VIEWPORT = { width: 1280, height: 720 };

test.describe("Responsive sidebar behavior", () => {
  test("mobile: sidebar is hidden by default and opens as a Sheet overlay", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);

    // Wait for the app to settle after viewport change
    await page.waitForTimeout(500);

    // Desktop aside should not be visible at mobile viewport
    const aside = page.locator("aside");
    await expect(aside).toHaveCount(0);

    // The Sheet content should not be visible initially
    const sheetContent = page.locator('[data-slot="sheet-content"]');
    await expect(sheetContent).toBeHidden();

    // Mobile header with hamburger button should be visible
    const toggleButton = page.getByRole("button", { name: "Toggle sidebar" });
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
    await page.waitForTimeout(500);

    // Desktop aside should be visible
    const aside = page.locator("aside");
    await expect(aside).toBeVisible({ timeout: 5_000 });

    // Aside should have non-zero width (open state = 240px)
    const box = await aside.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);

    // The mobile hamburger toggle should NOT be visible on desktop
    const toggleButton = page.getByRole("button", { name: "Toggle sidebar" });
    await expect(toggleButton).toBeHidden();

    // Sheet overlay should not be present
    const sheetContent = page.locator('[data-slot="sheet-content"]');
    await expect(sheetContent).toBeHidden();
  });

  test("keyboard shortcut Ctrl+\\ toggles sidebar visibility on desktop", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.waitForTimeout(500);

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
});
