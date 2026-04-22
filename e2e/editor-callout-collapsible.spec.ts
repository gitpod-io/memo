import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage, selectSlashOption } from "./fixtures/editor-helpers";

/**
 * Helper: insert a block via the slash command menu.
 * Types `/`, waits for the matching option, and clicks it.
 */
async function insertViaSlashCommand(
  page: import("@playwright/test").Page,
  commandLabel: string
) {
  const editor = page.locator('[contenteditable="true"]');
  await editor.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");

  await selectSlashOption(page, commandLabel);
}

test.describe("Callout block", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await navigateToEditorPage(page);
  });

  test("insert callout via /callout and verify distinct styling", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await insertViaSlashCommand(page, "Callout");

    // The callout renders as a div with border-l-2 and an emoji span
    const callout = editor.locator(".callout-emoji").first();
    await expect(callout).toBeVisible({ timeout: 3_000 });

    // Verify the callout container has distinct styling (border-l-2 class)
    // that differentiates it from a code block
    const calloutContainer = callout.locator("..");
    await expect(calloutContainer).toHaveClass(/border-l-2/);
    await expect(calloutContainer).toHaveClass(/bg-muted/);

    // The emoji should be the default 💡
    await expect(callout).toHaveText("💡");

    // Verify it does NOT look like a code block — code blocks use <code>
    // elements, callouts use a div with border-l styling
    const calloutTag = await calloutContainer.evaluate((el) =>
      el.tagName.toLowerCase()
    );
    expect(calloutTag).toBe("div");
  });
});

test.describe("Collapsible/Toggle block", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await navigateToEditorPage(page);
  });

  test("insert toggle via /toggle and verify expand/collapse", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await insertViaSlashCommand(page, "Toggle");

    // The collapsible renders as a <details> element with a <summary>
    const details = editor.locator("details").first();
    await expect(details).toBeVisible({ timeout: 3_000 });

    // It should start open (the plugin sets open=true by default)
    await expect(details).toHaveAttribute("open", "");

    // The content area should be visible when open
    const content = details.locator("summary + div");
    await expect(content).toBeVisible();

    // Click the chevron toggle button to collapse
    const chevron = details.locator(".collapsible-toggle").first();
    await expect(chevron).toBeVisible();
    await chevron.click();

    // After clicking, the details element should no longer have the open attribute
    await expect(details).not.toHaveAttribute("open", "", { timeout: 2_000 });

    // The content should be hidden when collapsed
    await expect(content).not.toBeVisible();

    // Click again to re-expand
    await chevron.click();
    await expect(details).toHaveAttribute("open", "", { timeout: 2_000 });
    await expect(content).toBeVisible();
  });

  test("type content inside collapsible content area and verify persistence", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await insertViaSlashCommand(page, "Toggle");

    const details = editor.locator("details").first();
    await expect(details).toBeVisible({ timeout: 3_000 });

    // The content area is the div after the summary, containing a paragraph
    const contentArea = details.locator("summary + div");
    await expect(contentArea).toBeVisible();

    // The default content paragraph has "Toggle content" — click into it
    const contentParagraph = contentArea.locator("p").first();
    await expect(contentParagraph).toBeVisible();
    await contentParagraph.click();

    // Triple-click to select just the paragraph text, then type replacement
    await contentParagraph.click({ clickCount: 3 });
    await page.keyboard.type("My custom toggle content");

    // Verify the typed text appears in the content area
    await expect(contentArea).toContainText("My custom toggle content");

    // Collapse and re-expand to verify content persists
    const chevron = details.locator(".collapsible-toggle").first();
    await chevron.click();
    await expect(details).not.toHaveAttribute("open", "", { timeout: 2_000 });

    await chevron.click();
    await expect(details).toHaveAttribute("open", "", { timeout: 2_000 });
    await expect(contentArea).toContainText("My custom toggle content");
  });
});
