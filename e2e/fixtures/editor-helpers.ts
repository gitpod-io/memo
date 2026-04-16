import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Navigate to a page that has an editor. Waits for the sidebar page tree to
 * load, then clicks an existing page. If no pages exist, creates one via the
 * sidebar "New Page" button.
 *
 * Returns once `[contenteditable="true"]` is visible.
 */
export async function navigateToEditorPage(page: Page): Promise<void> {
  const sidebar = page.getByRole("complementary");

  // The page tree loads asynchronously: fetches workspace ID, then pages.
  // While loading it shows skeleton pulse divs. Once loaded it renders either
  // role="tree" with role="treeitem" children (pages exist) or "No pages yet".
  // Wait for tree items to appear — this is the most reliable signal that
  // the async data has loaded and the sidebar is interactive.
  const treeItem = sidebar.locator('[role="treeitem"]').first();
  try {
    await expect(treeItem).toBeVisible({ timeout: 10_000 });
  } catch {
    // Tree loaded but has no pages, or workspace has no pages yet
  }

  if ((await treeItem.count()) > 0) {
    // The tree item row contains: grip icon, expand button, file icon, title button, action buttons.
    // The title button has class "flex-1 truncate text-left" and triggers navigation.
    // Use text-left as a more specific selector since it's unique to the title button.
    const titleBtn = treeItem.locator("button.text-left");
    if ((await titleBtn.count()) > 0) {
      await titleBtn.click();
    } else {
      // Fallback: click the last button in the tree item (the title button)
      await treeItem.locator("button").last().click();
    }
  } else {
    // No pages exist — create one via the sidebar "New Page" button
    await sidebar.getByRole("button", { name: /new page/i }).click();
  }

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
