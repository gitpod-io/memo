import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Wait for the Lexical editor to be fully initialized after a lazy-load
 * boundary. Waits for `[data-lexical-editor="true"]` which Lexical sets
 * after the editor instance is mounted and all plugins are ready. This is
 * more reliable than `[contenteditable="true"]` alone because the
 * contenteditable attribute can appear before Lexical finishes initializing.
 *
 * Returns the editor locator for chaining.
 */
export async function waitForEditor(
  page: Page,
  { timeout = 15_000 }: { timeout?: number } = {},
): Promise<Locator> {
  const editor = page.locator('[data-lexical-editor="true"]');
  await expect(editor).toBeVisible({ timeout });
  return editor;
}

/**
 * Navigate to a page that has an editor. Always creates a fresh page via the
 * sidebar "New Page" button so each test gets its own isolated page. This
 * prevents parallel tests (e.g. the delete test) from interfering by deleting
 * a shared page mid-test.
 *
 * If the new page returns a 404 (e.g. due to Supabase replication lag), the
 * function reloads the page and retries up to 2 times before failing.
 *
 * Returns once the Lexical editor is fully initialized
 * (`[data-lexical-editor="true"]` is visible).
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

  // Wait for the Lexical editor to be fully initialized. The editor is
  // behind a next/dynamic lazy-load boundary (ssr: false), so it takes
  // longer to appear than a regular server-rendered component. We wait
  // for `data-lexical-editor` which Lexical sets after full initialization.
  // If the server returns a 404 (e.g. Supabase replication lag between
  // the client-side insert and the server-side read), reload and retry.
  const editor = page.locator('[data-lexical-editor="true"]');
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const visible = await editor
      .waitFor({ state: "visible", timeout: 15_000 })
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

/**
 * Select a slash command option by its exact title text.
 *
 * The slash menu contains both direct commands ("Heading 1") and "Turn into"
 * variants ("Turn into Heading 1"). Using `hasText` matches both because it
 * checks substring containment. This helper uses `getByRole('option', { name })`
 * with a regex anchored to the start of the accessible name to select only the
 * direct command, not the "Turn into" variant.
 */
export async function selectSlashOption(
  page: Page,
  label: string,
  { timeout = 3_000 }: { timeout?: number } = {},
): Promise<void> {
  // The accessible name starts with the option title (e.g. "Heading 1 Large section heading").
  // Anchor the regex to the start so "Turn into Heading 1 ..." doesn't match.
  const option = page.getByRole("option", {
    name: new RegExp(`^${escapeRegExp(label)}\\b`),
  });
  await expect(option).toBeVisible({ timeout });
  await option.click();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
