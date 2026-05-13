import { test, expect } from "./fixtures/auth";

test.describe("theme toggle", () => {
  test("defaults to dark theme", async ({ authenticatedPage: page }) => {
    const theme = await page.locator("html").getAttribute("data-theme");
    expect(theme).toBe("dark");
    const hasDarkClass = await page
      .locator("html")
      .evaluate((el) => el.classList.contains("dark"));
    expect(hasDarkClass).toBe(true);
  });

  test("can switch to light theme via user menu", async ({
    authenticatedPage: page,
  }) => {
    // Open user menu (bottom of sidebar)
    await page.getByTestId("as-user-menu").click();

    // Wait for the dropdown to appear
    await page.locator('[data-slot="dropdown-menu-content"]').waitFor();

    // Hover over "Theme" submenu trigger
    await page.locator('text=Theme').click();

    // Wait for submenu to appear
    await page
      .locator('[data-slot="dropdown-menu-sub-content"]')
      .waitFor({ timeout: 5000 });

    // Click "Light"
    await page.locator('[data-slot="dropdown-menu-sub-content"]').locator('text=Light').click();

    // Verify theme changed
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const hasDarkClass = await page
      .locator("html")
      .evaluate((el) => el.classList.contains("dark"));
    expect(hasDarkClass).toBe(false);

    // Verify localStorage was set
    const storedTheme = await page.evaluate(() =>
      localStorage.getItem("memo-theme"),
    );
    expect(storedTheme).toBe("light");
  });

  test("persists theme preference across page reload", async ({
    authenticatedPage: page,
  }) => {
    // Set theme to light via localStorage directly
    await page.evaluate(() => localStorage.setItem("memo-theme", "light"));
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // The inline script should apply light theme before React hydrates
    const theme = await page.locator("html").getAttribute("data-theme");
    expect(theme).toBe("light");
    const hasDarkClass = await page
      .locator("html")
      .evaluate((el) => el.classList.contains("dark"));
    expect(hasDarkClass).toBe(false);
  });

  test("system preference follows prefers-color-scheme", async ({
    authenticatedPage: page,
  }) => {
    // Set preference to system
    await page.evaluate(() => localStorage.setItem("memo-theme", "system"));

    // Emulate light color scheme
    await page.emulateMedia({ colorScheme: "light" });
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    const theme = await page.locator("html").getAttribute("data-theme");
    expect(theme).toBe("light");

    // Emulate dark color scheme
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    const darkTheme = await page.locator("html").getAttribute("data-theme");
    expect(darkTheme).toBe("dark");
  });
});
