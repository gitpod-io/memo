import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage, selectSlashOption } from "./fixtures/editor-helpers";

test.describe("Table of Contents block", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await navigateToEditorPage(page);
  });

  test("/toc appears in slash command menu", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/toc");

    const option = page.getByRole("option", {
      name: /^Table of Contents/,
    });
    await expect(option).toBeVisible({ timeout: 3_000 });
  });

  test("inserting TOC shows empty state when no headings exist", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");

    await selectSlashOption(page, "Table of Contents");

    const emptyToc = page.getByTestId("toc-empty");
    await expect(emptyToc).toBeVisible({ timeout: 3_000 });
    await expect(emptyToc).toContainText(
      "Add headings to see a table of contents",
    );
  });

  test("TOC lists headings after they are added", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Add headings using markdown shortcuts
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");

    await page.keyboard.type("# ");
    await page.keyboard.type("First Heading");
    await page.keyboard.press("Enter");

    // Wait for the heading to render before continuing
    await expect(editor.locator("h1", { hasText: "First Heading" })).toBeVisible({ timeout: 3_000 });

    await page.keyboard.type("## ");
    await page.keyboard.type("Second Heading");
    await page.keyboard.press("Enter");

    await expect(editor.locator("h2", { hasText: "Second Heading" })).toBeVisible({ timeout: 3_000 });

    await page.keyboard.type("### ");
    await page.keyboard.type("Third Heading");
    await page.keyboard.press("Enter");

    await expect(editor.locator("h3", { hasText: "Third Heading" })).toBeVisible({ timeout: 3_000 });

    // Now insert the TOC
    await page.keyboard.type("/");
    await selectSlashOption(page, "Table of Contents");

    const tocBlock = page.getByTestId("toc-block");
    await expect(tocBlock).toBeVisible({ timeout: 5_000 });

    // Verify heading entries appear
    await expect(tocBlock.getByTestId("toc-entry-h1")).toBeVisible({ timeout: 3_000 });
    await expect(tocBlock.getByTestId("toc-entry-h2")).toBeVisible();
    await expect(tocBlock.getByTestId("toc-entry-h3")).toBeVisible();

    // Verify text content
    await expect(
      tocBlock.getByRole("button", { name: "First Heading" }),
    ).toBeVisible();
    await expect(
      tocBlock.getByRole("button", { name: "Second Heading" }),
    ).toBeVisible();
    await expect(
      tocBlock.getByRole("button", { name: "Third Heading" }),
    ).toBeVisible();
  });

  test("TOC updates live when headings change", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Insert a heading first
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("# ");
    await page.keyboard.type("Original Heading");
    await page.keyboard.press("Enter");

    await expect(editor.locator("h1", { hasText: "Original Heading" })).toBeVisible({ timeout: 3_000 });

    // Insert TOC
    await page.keyboard.type("/");
    await selectSlashOption(page, "Table of Contents");

    const tocBlock = page.getByTestId("toc-block");
    await expect(tocBlock).toBeVisible({ timeout: 3_000 });
    await expect(
      tocBlock.getByRole("button", { name: "Original Heading" }),
    ).toBeVisible();

    // Now add another heading above the TOC
    const heading = editor.locator("h1", { hasText: "Original Heading" });
    await heading.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("## ");
    await page.keyboard.type("New Sub Heading");

    await expect(editor.locator("h2", { hasText: "New Sub Heading" })).toBeVisible({ timeout: 3_000 });

    // The TOC should now show both headings (debounced update: 200ms + buffer)
    await expect(
      tocBlock.getByRole("button", { name: "New Sub Heading" }),
    ).toBeVisible({ timeout: 3_000 });
  });

  test("clicking a TOC entry scrolls to the heading", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Add a heading
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("# ");
    await page.keyboard.type("Target Heading");
    await page.keyboard.press("Enter");

    await expect(editor.locator("h1", { hasText: "Target Heading" })).toBeVisible({ timeout: 3_000 });

    // Insert TOC
    await page.keyboard.type("/");
    await selectSlashOption(page, "Table of Contents");

    const tocBlock = page.getByTestId("toc-block");
    await expect(tocBlock).toBeVisible({ timeout: 3_000 });

    // Click the TOC entry
    const tocEntry = tocBlock.getByRole("button", {
      name: "Target Heading",
    });
    await tocEntry.click();

    // The heading should be in the viewport after clicking
    const targetHeading = editor.locator("h1", {
      hasText: "Target Heading",
    });
    await expect(targetHeading).toBeInViewport({ timeout: 2_000 });
  });

  test("TOC block can be deleted with backspace", async ({
    authenticatedPage: page,
  }) => {
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Insert TOC
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");
    await selectSlashOption(page, "Table of Contents");

    const emptyToc = page.getByTestId("toc-empty");
    await expect(emptyToc).toBeVisible({ timeout: 3_000 });

    // Position cursor after the TOC and press backspace to delete it
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");

    // TOC should be removed
    await expect(emptyToc).not.toBeVisible({ timeout: 2_000 });
  });
});
