import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Navigate to a page that has an editor. Always creates a new page via the
 * sidebar "New Page" button to avoid race conditions with parallel tests that
 * may delete shared pages.
 *
 * Returns once `[contenteditable="true"]` is visible.
 */
export async function navigateToEditorPage(page: Page): Promise<void> {
  const sidebar = page.getByRole("complementary");

  // Wait for the page tree to finish loading before clicking "New Page".
  // The tree loads asynchronously (workspace ID → pages). Skeleton pulse
  // divs are shown while loading. Once loaded, either tree items or
  // "No pages yet" appears. Wait for either signal so the sidebar is ready.
  const treeLoaded = sidebar.locator('[role="tree"], :text("No pages yet")');
  await expect(treeLoaded).toBeVisible({ timeout: 10_000 });

  // Always create a fresh page so this test owns it and parallel tests
  // cannot delete it out from under us.
  await sidebar.getByRole("button", { name: /new page/i }).click();

  // Wait for the editor to appear (works for both hard and soft navigation)
  const editor = page.locator('[contenteditable="true"]');
  await expect(editor).toBeVisible({ timeout: 10_000 });
}

/**
 * Returns the platform-appropriate modifier key for keyboard shortcuts.
 * macOS uses Meta, Linux/Windows use Control.
 */
export function modifierKey(): "Meta" | "Control" {
  return process.platform === "darwin" ? "Meta" : "Control";
}
