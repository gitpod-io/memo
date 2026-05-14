import { test, expect } from "./fixtures/auth";
import type { Locator } from "@playwright/test";

/**
 * Waits for the workspace home page to fully load inside #main-content.
 */
async function waitForWorkspaceHome(main: Locator): Promise<void> {
  const filterInput = main.getByTestId("wh-filter-input");
  await expect(filterInput).toBeVisible({ timeout: 15_000 });
}

/**
 * Navigates to the workspace home page from any page in the app.
 */
async function navigateToWorkspaceHome(page: import("@playwright/test").Page): Promise<Locator> {
  const main = page.locator("#main-content");

  // If already on workspace home, return
  const filterInput = main.getByTestId("wh-filter-input");
  const isHome = await filterInput.isVisible().catch(() => false);
  if (isHome) return main;

  // Navigate to workspace root by extracting slug from current URL
  const pathSegments = new URL(page.url()).pathname.split("/").filter(Boolean);
  const workspaceSlug = pathSegments[0];
  if (workspaceSlug) {
    await page.goto(`/${workspaceSlug}`);
  }

  await waitForWorkspaceHome(main);
  return main;
}

test.describe("Workspace home — Import Markdown", () => {
  test("Import Markdown button is visible in the workspace home header", async ({
    authenticatedPage: page,
  }) => {
    const main = page.locator("#main-content");
    await waitForWorkspaceHome(main);

    const importBtn = main.getByTestId("wh-import-markdown-btn");
    await expect(importBtn).toBeVisible({ timeout: 5_000 });
  });

  test("clicking Import Markdown and selecting a .md file creates a new page and navigates to it", async ({
    authenticatedPage: page,
  }) => {
    const main = await navigateToWorkspaceHome(page);

    const importBtn = main.getByTestId("wh-import-markdown-btn");
    await expect(importBtn).toBeVisible({ timeout: 5_000 });

    // Click the import button — this triggers the hidden file input
    await importBtn.click();

    // Set the file on the hidden input directly
    const fileInput = main.locator('input[type="file"][accept=".md,.markdown"]');
    await fileInput.setInputFiles({
      name: "test-import-from-home.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Hello from Home\n\nThis is imported from workspace home.\n\n- Item one\n- Item two\n"),
    });

    // Should navigate to the new page — URL contains a UUID page ID
    await page.waitForURL(
      (url) => /\/[^/]+\/[0-9a-f-]{36}/.test(url.pathname),
      { timeout: 15_000 },
    );

    // The editor should be visible with the imported content
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Verify the imported content is present
    await expect(editor).toContainText("Hello from Home", { timeout: 5_000 });
    await expect(editor).toContainText("Item one");

    // Page title should match the imported filename (without extension)
    const titleInput = page.locator('input[aria-label="Page title"]');
    await expect(titleInput).toHaveValue("test-import-from-home", {
      timeout: 5_000,
    });
  });

  test("imported page appears in the workspace home page list after navigating back", async ({
    authenticatedPage: page,
  }) => {
    const main = await navigateToWorkspaceHome(page);

    const importBtn = main.getByTestId("wh-import-markdown-btn");
    await importBtn.click();

    const fileInput = main.locator('input[type="file"][accept=".md,.markdown"]');
    await fileInput.setInputFiles({
      name: "verify-in-list.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Verify In List\n\nContent for list verification.\n"),
    });

    // Wait for navigation to the new page
    await page.waitForURL(
      (url) => /\/[^/]+\/[0-9a-f-]{36}/.test(url.pathname),
      { timeout: 15_000 },
    );

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Navigate back to workspace home
    const pathSegments = new URL(page.url()).pathname.split("/").filter(Boolean);
    const workspaceSlug = pathSegments[0];
    await page.goto(`/${workspaceSlug}`);
    await waitForWorkspaceHome(main);

    // The imported page should appear in the page list
    const pageItem = main.locator("button.text-left.text-sm", {
      hasText: "verify-in-list",
    });
    await expect(pageItem.first()).toBeVisible({ timeout: 10_000 });
  });
});
