import { test, expect } from "./fixtures/auth";

/**
 * Wait for a successful Supabase PATCH to /rest/v1/pages (content auto-save).
 */
function waitForContentSave(page: import("@playwright/test").Page) {
  return page.waitForResponse(
    (resp) =>
      resp.url().includes("/rest/v1/pages") &&
      resp.request().method() === "PATCH" &&
      resp.status() >= 200 &&
      resp.status() < 300,
    { timeout: 15_000 },
  );
}

/**
 * Create a new page via the sidebar "New Page" button, set its title,
 * and return { path, pageId }.
 */
async function createPageWithTitle(
  page: import("@playwright/test").Page,
  title: string,
): Promise<{ path: string; pageId: string }> {
  const sidebar = page.getByRole("complementary");

  // Wait for the page tree to finish loading
  const treeLoaded = sidebar
    .locator('[role="treeitem"], :text("No pages yet")')
    .first();
  await expect(treeLoaded).toBeVisible({ timeout: 10_000 });

  const newPageBtn = sidebar.getByTestId("sb-new-page-btn");
  await newPageBtn.click();

  // Wait for navigation to the new page
  await page.waitForURL(
    (url) => url.pathname.split("/").filter(Boolean).length >= 2,
    { timeout: 10_000 },
  );

  // Wait for the editor to be ready
  const editor = page.locator('[data-lexical-editor="true"]');
  await expect(editor).toBeVisible({ timeout: 15_000 });

  const pagePath = new URL(page.url()).pathname;
  const pageId = pagePath.split("/").pop()!;

  // Set the page title via the inline input
  const titleInput = page.locator('input[aria-label="Page title"]');
  await expect(titleInput).toBeVisible({ timeout: 5_000 });
  await titleInput.click();
  await titleInput.fill(title);

  // Trigger save via blur and wait for the PATCH to complete
  const titleSavePromise = page.waitForResponse(
    async (resp) => {
      if (
        !resp.url().includes("/rest/v1/pages") ||
        resp.request().method() !== "PATCH"
      ) {
        return false;
      }
      const body = resp.request().postData();
      return body !== null && body.includes('"title"');
    },
    { timeout: 10_000 },
  );

  await titleInput.blur();
  await titleSavePromise;

  return { path: pagePath, pageId };
}

test.describe("Page backlinks", () => {
  test("backlink appears on target page after inserting a page link", async ({
    authenticatedPage: page,
  }) => {
    const uniqueId = Math.random().toString(36).slice(2, 8);
    const pageBTitle = `BLTarget ${uniqueId}`;
    const pageATitle = `BLSource ${uniqueId}`;

    // --- Create page B (the target that will receive the backlink) ---
    const pageB = await createPageWithTitle(page, pageBTitle);

    // --- Create page A (the source that will link to page B) ---
    const pageA = await createPageWithTitle(page, pageATitle);

    // Reload page A so the title is pre-filled and the title input's
    // auto-focus effect doesn't fire (it only auto-focuses empty titles).
    await page.goto(pageA.path, { waitUntil: "domcontentloaded" });

    // Wait for the editor to be ready
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 15_000 });

    // Click the editor to ensure it has focus
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");

    // Open slash command menu and select "Link to page"
    await editor.pressSequentially("/");
    const linkOption = page.getByRole("option", { name: /link to page/i });
    await expect(linkOption).toBeVisible({ timeout: 5_000 });
    await linkOption.click();

    // The page link search dropdown should appear
    const searchInput = page.getByTestId("pls-search-input");
    await expect(searchInput).toBeVisible({ timeout: 3_000 });

    // Wait for the dropdown to show initial results
    const dropdown = page.getByTestId("pls-dropdown");
    await expect(dropdown.getByRole("option").first()).toBeVisible({
      timeout: 10_000,
    });

    // Select page B from the results. Each option has
    // id="page-link-option-{pageId}", so we can target it directly
    // regardless of whether the title has propagated.
    const targetOption = dropdown.locator(
      `#page-link-option-${pageB.pageId}`,
    );

    // If page B isn't in the initial 10 results, search for it
    if (!(await targetOption.isVisible().catch(() => false))) {
      await searchInput.fill(pageBTitle);
      await expect(targetOption).toBeVisible({ timeout: 10_000 });
    }

    // Register the save listener BEFORE clicking to insert the link
    const savePromise = waitForContentSave(page);
    await targetOption.click();

    // Wait for auto-save to persist the page link
    await savePromise;

    // Wait for syncPageLinks to write to the page_links table
    await page.waitForResponse(
      (resp) =>
        resp.url().includes("/rest/v1/page_links") &&
        resp.status() >= 200 &&
        resp.status() < 300,
      { timeout: 10_000 },
    );

    // --- Navigate to page B and verify the backlink ---
    await page.goto(pageB.path, { waitUntil: "domcontentloaded" });

    const pageBEditor = page.locator('[contenteditable="true"]');
    await expect(pageBEditor).toBeVisible({ timeout: 15_000 });

    // The backlinks section should appear with the "Backlinks" heading.
    // The section is a div with a border-t that contains the heading and links.
    const backlinksSection = page.locator(".border-t").filter({
      hasText: "Backlinks",
    });
    await expect(backlinksSection).toBeVisible({ timeout: 10_000 });

    // The backlink to page A should be visible within the backlinks section
    const backlinkToA = backlinksSection
      .locator("a")
      .filter({ hasText: pageATitle });
    await expect(backlinkToA).toBeVisible({ timeout: 5_000 });

    // Verify the backlink href points to page A
    const href = await backlinkToA.getAttribute("href");
    expect(href).toBeTruthy();
    expect(href).toContain(pageA.pageId);

    // --- Click the backlink and verify navigation to page A ---
    await backlinkToA.click();

    await page.waitForURL((url) => url.pathname === pageA.path, {
      timeout: 10_000,
    });

    const pageATitleInput = page.locator('input[aria-label="Page title"]');
    await expect(pageATitleInput).toBeVisible({ timeout: 10_000 });
    await expect(pageATitleInput).toHaveValue(pageATitle);
  });
});
