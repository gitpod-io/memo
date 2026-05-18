import { test, expect } from "./fixtures/auth";

const MOBILE_VIEWPORT = { width: 375, height: 667 };
const DESKTOP_VIEWPORT = { width: 1280, height: 720 };

test.describe("Mobile header page title", () => {
  test("shows workspace name on workspace home at mobile viewport", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/");

    // Wait for the app shell to load
    const toggleButton = page.getByTestId("as-sidebar-toggle");
    await expect(toggleButton).toBeVisible({ timeout: 15_000 });

    // The mobile header title should display the workspace name
    const titleEl = page.getByTestId("mobile-header-title");
    await expect(titleEl).toBeVisible({ timeout: 10_000 });

    // The title should be non-empty (workspace name)
    const titleText = await titleEl.textContent();
    expect(titleText).toBeTruthy();
    expect(titleText!.trim().length).toBeGreaterThan(0);
  });

  test("updates title when navigating to a page via sidebar", async ({
    authenticatedPage: page,
  }) => {
    // Start at desktop to get workspace slug, then switch to mobile
    await page.goto("/");
    await page.waitForURL((url) => !url.pathname.includes("/sign-in"), {
      timeout: 15_000,
    });

    // Get workspace slug from URL
    const currentUrl = new URL(page.url());
    const pathParts = currentUrl.pathname.split("/").filter(Boolean);
    const workspaceSlug = pathParts[0];
    if (!workspaceSlug) {
      test.skip(true, "Could not determine workspace slug");
      return;
    }

    // Switch to mobile viewport
    await page.setViewportSize(MOBILE_VIEWPORT);

    // Open sidebar
    const toggleButton = page.getByTestId("as-sidebar-toggle");
    await expect(toggleButton).toBeVisible({ timeout: 10_000 });
    await toggleButton.click();

    const sheetContent = page.locator('[data-slot="sheet-content"]');
    await expect(sheetContent).toBeVisible({ timeout: 5_000 });

    // Wait for the page tree to load
    const treeItem = sheetContent.locator('[role="treeitem"]').first();
    try {
      await expect(treeItem).toBeVisible({ timeout: 10_000 });
    } catch {
      // No pages — create one via sidebar
      const newPageBtn = sheetContent.getByTestId("sb-new-page-btn");
      if ((await newPageBtn.count()) > 0) {
        await newPageBtn.click();
        await page.waitForURL(
          (url) => url.pathname.split("/").filter(Boolean).length >= 2,
          { timeout: 15_000 },
        );
        // After navigation, the mobile header title should be visible
        const titleEl = page.getByTestId("mobile-header-title");
        await expect(titleEl).toBeVisible({ timeout: 10_000 });
        return;
      }
      test.skip(true, "No pages and no new-page button available");
      return;
    }

    // Record URL before clicking
    const urlBefore = page.url();

    // Click to navigate
    await treeItem.click();

    // Wait for URL to change
    await page.waitForURL((url) => url.href !== urlBefore, {
      timeout: 15_000,
    });

    // The mobile header title should update to show the page title
    const titleEl = page.getByTestId("mobile-header-title");
    await expect(titleEl).toBeVisible({ timeout: 10_000 });

    // Title should be non-empty
    const titleText = await titleEl.textContent();
    expect(titleText).toBeTruthy();
    expect(titleText!.trim().length).toBeGreaterThan(0);
  });

  test("shows Settings on settings page", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/");
    await page.waitForURL((url) => !url.pathname.includes("/sign-in"), {
      timeout: 15_000,
    });

    // Get workspace slug from URL
    const currentUrl = new URL(page.url());
    const pathParts = currentUrl.pathname.split("/").filter(Boolean);
    const workspaceSlug = pathParts[0];
    if (!workspaceSlug) {
      test.skip(true, "Could not determine workspace slug");
      return;
    }

    await page.setViewportSize(MOBILE_VIEWPORT);

    // Navigate to settings
    await page.goto(`/${workspaceSlug}/settings`);

    // Wait for the settings page to load
    const titleEl = page.getByTestId("mobile-header-title");
    await expect(titleEl).toBeVisible({ timeout: 15_000 });

    // Title should contain "Settings"
    await expect(titleEl).toContainText("Settings", { timeout: 10_000 });
  });

  test("header is hidden on desktop viewport", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/");

    await page.waitForURL((url) => !url.pathname.includes("/sign-in"), {
      timeout: 15_000,
    });

    // The entire mobile header (including the title) should be hidden on desktop
    // because the header has md:hidden class
    const mobileHeader = page.locator("header").filter({
      has: page.getByTestId("as-sidebar-toggle"),
    });

    await expect(mobileHeader).toBeHidden({ timeout: 5_000 });
  });

  test("title element has truncation styles", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/");

    const toggleButton = page.getByTestId("as-sidebar-toggle");
    await expect(toggleButton).toBeVisible({ timeout: 15_000 });

    const titleEl = page.getByTestId("mobile-header-title");
    await expect(titleEl).toBeVisible({ timeout: 10_000 });

    // Verify the element has overflow hidden via the truncate class
    const overflow = await titleEl.evaluate(
      (el) => window.getComputedStyle(el).overflow,
    );
    expect(overflow).toBe("hidden");

    const textOverflow = await titleEl.evaluate(
      (el) => window.getComputedStyle(el).textOverflow,
    );
    expect(textOverflow).toBe("ellipsis");
  });
});
