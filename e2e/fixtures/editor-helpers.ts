import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Navigate to a page that has an editor. Always creates a fresh page via the
 * sidebar "New Page" button so each test gets its own isolated page. This
 * prevents parallel tests (e.g. the delete test) from interfering by deleting
 * a shared page mid-test.
 *
 * If the new page returns a 404 (e.g. due to Supabase replication lag), the
 * function reloads the page and retries up to 2 times before failing.
 *
 * Returns once `[contenteditable="true"]` is visible.
 */
export async function navigateToEditorPage(page: Page): Promise<void> {
  const sidebar = page.getByRole("complementary");

  // The page tree loads asynchronously: workspace ID lookup → page fetch.
  // The "New Page" button silently no-ops if the workspace ID hasn't resolved
  // yet, so we must wait for the tree to finish loading before clicking it.
  // The tree renders either treeitem elements (pages exist) or "No pages yet"
  // once loading completes. Wait for either signal.
  const treeLoaded = sidebar
    .locator('[role="treeitem"], :text("No pages yet")')
    .first();
  await expect(treeLoaded).toBeVisible({ timeout: 10_000 });

  // Create a fresh page so this test owns it and parallel tests cannot
  // delete or modify it underneath us.
  const newPageBtn = sidebar.getByRole("button", { name: /new page/i });
  await newPageBtn.click();

  // Wait for the editor to appear. If the server returns a 404 (e.g.
  // Supabase replication lag between the client-side insert and the
  // server-side read), reload and retry.
  const editor = page.locator('[contenteditable="true"]');
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const visible = await editor
      .waitFor({ state: "visible", timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (visible) return;

    // Check if we got a 404 — if so, reload to retry the server render
    const is404 = await page.getByText("This page could not be found").isVisible().catch(() => false);
    if (is404 && attempt < maxRetries) {
      await page.reload({ waitUntil: "domcontentloaded" });
      continue;
    }

    // Not a 404 or out of retries — fail with a clear message
    throw new Error(
      `navigateToEditorPage: editor not visible after ${attempt + 1} attempt(s)`,
    );
  }
}

/**
 * Returns the platform-appropriate modifier key for keyboard shortcuts.
 * macOS uses Meta, Linux/Windows use Control.
 */
export function modifierKey(): "Meta" | "Control" {
  return process.platform === "darwin" ? "Meta" : "Control";
}
