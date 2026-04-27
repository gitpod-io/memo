import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage, waitForEditor } from "./fixtures/editor-helpers";

/**
 * Wait for a successful Supabase PATCH to /rest/v1/pages (content auto-save).
 * Resolves once the response arrives with a 2xx status.
 */
function waitForContentSave(page: import("@playwright/test").Page) {
  return page.waitForResponse(
    (resp) =>
      resp.url().includes("/rest/v1/pages") &&
      resp.request().method() === "PATCH" &&
      resp.status() >= 200 &&
      resp.status() < 300,
    { timeout: 10_000 }
  );
}

/**
 * Extract the page ID from the current URL (last path segment).
 */
function getPageIdFromUrl(page: import("@playwright/test").Page): string {
  const url = new URL(page.url());
  const segments = url.pathname.split("/").filter(Boolean);
  return segments[segments.length - 1];
}

/**
 * Create a version snapshot via the API by calling the versions endpoint directly.
 * This avoids waiting for the 5-minute auto-save interval.
 */
async function createVersionViaApi(
  page: import("@playwright/test").Page,
  pageId: string,
  content: Record<string, unknown>
) {
  return page.evaluate(
    async ({ pageId, content }) => {
      const res = await fetch(`/api/pages/${pageId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      return res.json();
    },
    { pageId, content }
  );
}

/**
 * Open the page menu (⋯ button) and click "Version history".
 * Scoped to `<main>` to avoid matching sidebar tree item menus.
 */
async function openVersionHistory(page: import("@playwright/test").Page) {
  const main = page.locator("main");
  const menuButton = main.getByRole("button", { name: "Page actions" });
  await menuButton.click();

  const historyItem = page.getByRole("menuitem", { name: "Version history" });
  await historyItem.click();
}

/**
 * Build a minimal valid Lexical editor state with a single paragraph.
 */
function makeLexicalState(text: string) {
  return {
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text,
              type: "text",
              version: 1,
            },
          ],
          direction: "ltr",
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
          textFormat: 0,
          textStyle: "",
        },
      ],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  };
}

test.describe("Version history", () => {
  test("user can open the version history panel from the page menu", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    await waitForEditor(page);

    await openVersionHistory(page);

    // The sheet panel should be visible with the "Version history" title
    const panel = page.locator('[data-slot="sheet-content"]');
    await expect(panel).toBeVisible({ timeout: 5_000 });
    await expect(panel).toContainText("Version history");
  });

  test("version history panel shows a list of saved versions with timestamps", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = await waitForEditor(page);

    // Type content and wait for auto-save so the page has content
    const savePromise = waitForContentSave(page);
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("version-history-test-v1");
    await savePromise;

    const pageId = getPageIdFromUrl(page);

    // Create version snapshots via the API (bypasses the 5-min interval)
    await createVersionViaApi(page, pageId, makeLexicalState("version-v1"));
    await createVersionViaApi(page, pageId, makeLexicalState("version-v2"));

    // Open version history
    await openVersionHistory(page);

    const panel = page.locator('[data-slot="sheet-content"]');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Should show at least "2 versions" (auto-save may create additional ones)
    await expect(panel).toContainText("version", { timeout: 5_000 });

    // Version entries are buttons inside the scrollable container.
    // Each entry contains a formatted date (e.g. "Apr 21, 1:39 PM").
    // The scrollable area is the flex-1 overflow-y-auto div after the header.
    const scrollArea = panel.locator(".overflow-y-auto");
    const versionEntries = scrollArea.locator("button");
    await expect(versionEntries.first()).toBeVisible({ timeout: 5_000 });
    const count = await versionEntries.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("user can click a version to preview it", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = await waitForEditor(page);

    // Type initial content and save
    const savePromise = waitForContentSave(page);
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("original-content-for-preview");
    await savePromise;

    const pageId = getPageIdFromUrl(page);

    // Create a version with distinct content via the API
    await createVersionViaApi(
      page,
      pageId,
      makeLexicalState("preview-version-content")
    );

    // Open version history
    await openVersionHistory(page);

    const panel = page.locator('[data-slot="sheet-content"]');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Click the first version entry (not the close button)
    const versionEntry = panel
      .locator("button:not([data-slot='sheet-close'])")
      .first();
    await versionEntry.click();

    // When previewing, the editor switches to read-only mode and shows
    // "Previewing version (read-only)" below the editor.
    await expect(page.getByText("Previewing version (read-only)")).toBeVisible({
      timeout: 10_000,
    });

    // The preview editor should contain the version's content
    await expect(page.locator("main")).toContainText(
      "preview-version-content",
      { timeout: 10_000 }
    );

    // The "Restore this version" button should appear when a version is selected
    const restoreButton = panel.getByRole("button", {
      name: /restore this version/i,
    });
    await expect(restoreButton).toBeVisible();
  });

  test("user can restore a previous version", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = await waitForEditor(page);

    // Type initial content and save
    const savePromise = waitForContentSave(page);
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("content-before-restore");
    await savePromise;

    const pageId = getPageIdFromUrl(page);

    // Create a version with the content we want to restore to
    await createVersionViaApi(
      page,
      pageId,
      makeLexicalState("restored-version-content")
    );

    // Open version history
    await openVersionHistory(page);

    const panel = page.locator('[data-slot="sheet-content"]');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Click the version to select it
    const versionEntry = panel
      .locator("button:not([data-slot='sheet-close'])")
      .first();
    await versionEntry.click();

    // Wait for the restore button to appear
    const restoreButton = panel.getByRole("button", {
      name: /restore this version/i,
    });
    await expect(restoreButton).toBeVisible({ timeout: 5_000 });

    // Click restore
    await restoreButton.click();

    // The panel should close after restore
    await expect(panel).not.toBeVisible({ timeout: 5_000 });

    // A success toast should appear
    await expect(page.getByText("Version restored")).toBeVisible({
      timeout: 5_000,
    });

    // The editor returns to editable mode after restore — wait for Lexical
    // to fully re-initialize behind the lazy-load boundary
    const restoredEditor = await waitForEditor(page);
    await expect(restoredEditor).toBeVisible();

    // Reload to verify the restored content was persisted to the database.
    // The restore API updates the DB, but the client-side editor may
    // re-initialize with stale initialContent from the server component.
    await page.reload({ waitUntil: "domcontentloaded" });
    const reloadedEditor = await waitForEditor(page);
    await expect(reloadedEditor).toContainText("restored-version-content", {
      timeout: 10_000,
    });
  });

  test("version history panel can be closed", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    await waitForEditor(page);

    // Open version history
    await openVersionHistory(page);

    const panel = page.locator('[data-slot="sheet-content"]');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Close via the X button in the sheet
    const closeButton = panel.locator('[data-slot="sheet-close"]');
    await closeButton.click();

    // Panel should disappear
    await expect(panel).not.toBeVisible({ timeout: 5_000 });
  });
});
