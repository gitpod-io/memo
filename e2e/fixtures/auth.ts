import { test as base, type Page } from "@playwright/test";

/**
 * Extends the base Playwright test with an `authenticatedPage` fixture.
 * Logs in once per test using TEST_USER_EMAIL / TEST_USER_PASSWORD env vars,
 * then provides an authenticated Page instance.
 */
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ browser }, use) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;

    if (!email || !password) {
      throw new Error(
        "TEST_USER_EMAIL and TEST_USER_PASSWORD must be set for authenticated E2E tests"
      );
    }

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/sign-in");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/sign-in"), {
      timeout: 15_000,
    });

    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
