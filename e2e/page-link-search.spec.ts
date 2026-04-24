import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage } from "./fixtures/editor-helpers";

test.describe("Page link dropdown search", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await navigateToEditorPage(page);
  });

  test("slash command 'Link to page' opens dropdown with search input", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");

    // Open slash command menu
    await editor.pressSequentially("/");
    // Select "Link to page"
    const linkOption = page.getByRole("option", { name: /link to page/i });
    await expect(linkOption).toBeVisible({ timeout: 3_000 });
    await linkOption.click();
    // The page link dropdown should appear with a search input
    // Use placeholder to disambiguate from the sidebar search
    const searchInput = page.locator('input[placeholder="Search pages…"]');
    await expect(searchInput).toBeVisible({ timeout: 3_000 });
    await expect(searchInput).toBeFocused();
  });

  test("search input filters pages by title", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");

    // Open slash command menu and select "Link to page"
    await editor.pressSequentially("/");
    const linkOption = page.getByRole("option", { name: /link to page/i });
    await expect(linkOption).toBeVisible({ timeout: 3_000 });
    await linkOption.click();
    const searchInput = page.locator('input[placeholder="Search pages…"]');
    await expect(searchInput).toBeVisible({ timeout: 3_000 });

    // Type a query that is unlikely to match any page
    await searchInput.fill("zzz_nonexistent_page_xyz");
    // Should show "No pages found"
    await expect(page.getByText("No pages found")).toBeVisible({
      timeout: 3_000,
    });
  });

  test("keyboard navigation works in search dropdown", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");

    // Open slash command menu and select "Link to page"
    await editor.pressSequentially("/");
    const linkOption = page.getByRole("option", { name: /link to page/i });
    await expect(linkOption).toBeVisible({ timeout: 3_000 });
    await linkOption.click();
    const searchInput = page.locator('input[placeholder="Search pages…"]');
    await expect(searchInput).toBeVisible({ timeout: 3_000 });

    // Wait for results to load — options are inside the page link dropdown
    const dropdown = searchInput.locator("..").locator("..");
    const firstOption = dropdown.getByRole("option").first();
    await expect(firstOption).toBeVisible({ timeout: 5_000 });

    // First item should be selected by default
    await expect(firstOption).toHaveAttribute("aria-selected", "true");

    // Arrow down should move selection
    await page.keyboard.press("ArrowDown");
    const optionCount = await dropdown.getByRole("option").count();
    if (optionCount > 1) {
      const secondOption = dropdown.getByRole("option").nth(1);
      await expect(secondOption).toHaveAttribute("aria-selected", "true");
      await expect(firstOption).toHaveAttribute("aria-selected", "false");
    }

    // Escape should close the dropdown
    await page.keyboard.press("Escape");
    await expect(searchInput).not.toBeVisible({ timeout: 3_000 });
  });

  test("[[ trigger shows search input with typed query", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");

    // Type [[ to trigger page link menu
    await editor.pressSequentially("[[");
    // The search input should appear
    const searchInput = page.locator('input[placeholder="Search pages…"]');
    await expect(searchInput).toBeVisible({ timeout: 3_000 });

    // The input should show the query (empty initially since nothing typed after [[)
    await expect(searchInput).toHaveValue("");
  });
});
