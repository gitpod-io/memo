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

    // Disable Sentry in E2E sessions to prevent simulated errors from
    // generating real Sentry events in production. The flag is checked
    // by the beforeSend filter in instrumentation-client.ts.
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__SENTRY_DISABLED__ = true;
    });

    await page.goto("/sign-in");

    // Wait for React hydration to complete before filling controlled inputs.
    // The sign-in form uses controlled inputs (value + onChange) which reset
    // to empty string during hydration. Filling before hydration completes
    // causes the email value to be cleared.
    const emailInput = page.locator('input[type="email"]');
    await emailInput.waitFor({ state: "visible", timeout: 10_000 });

    // Wait for hydration: the submit button becomes enabled once React hydrates
    // the form. Poll until the input is interactive (accepts focus and value).
    await page.waitForFunction(
      () => {
        const input = document.querySelector('input[type="email"]') as HTMLInputElement | null;
        return input !== null && !input.disabled;
      },
      { timeout: 10_000 },
    );

    await emailInput.fill(email);
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
