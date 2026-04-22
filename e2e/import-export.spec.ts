import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage, selectSlashOption } from "./fixtures/editor-helpers";

test.describe("Markdown import and export", () => {
  test("user can export a page as markdown via the page menu", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Type some structured content: heading, paragraph, list
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");

    // Insert a heading via slash command
    await page.keyboard.type("/");
    await selectSlashOption(page, "Heading 1");
    await page.keyboard.type("Export Test Heading");
    await page.keyboard.press("Enter");

    // Type a paragraph
    await page.keyboard.type("This is a test paragraph for export.");
    await page.keyboard.press("Enter");

    // Insert a bullet list via slash command
    await page.keyboard.type("/");
    await selectSlashOption(page, "Bullet List");
    await page.keyboard.type("First item");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second item");

    // Wait for auto-save to persist
    await page.waitForTimeout(1_500);

    // Open the page menu — scoped to <main> to avoid sidebar "Page actions" buttons
    const main = page.locator("main");
    const menuTrigger = main.locator('button[aria-label="Page actions"]');
    await expect(menuTrigger).toBeVisible({ timeout: 5_000 });
    await menuTrigger.click();

    const exportItem = page
      .getByRole("menuitem")
      .filter({ hasText: "Export as Markdown" });
    await expect(exportItem).toBeVisible({ timeout: 3_000 });

    // Intercept the download
    const downloadPromise = page.waitForEvent("download");
    await exportItem.click();
    const download = await downloadPromise;

    // Verify the downloaded file
    expect(download.suggestedFilename()).toMatch(/\.md$/);

    const content = await (
      await download.createReadStream()
    )
      .toArray()
      .then((chunks) => Buffer.concat(chunks).toString("utf-8"));

    expect(content).toContain("# Export Test Heading");
    expect(content).toContain("This is a test paragraph for export.");
    expect(content).toContain("First item");
    expect(content).toContain("Second item");
  });

  test("user can import a markdown file via the page menu to create a new page", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Capture the current URL to detect navigation after import
    const urlBefore = page.url();

    // Prepare the markdown content to import
    const markdownContent = [
      "# Imported Heading",
      "",
      "A paragraph with **bold** and *italic* text.",
      "",
      "- List item alpha",
      "- List item beta",
      "",
      "```",
      "const x = 42;",
      "```",
      "",
      "[Example link](https://example.com)",
    ].join("\n");

    // Set the file on the hidden input scoped to <main> (sidebar also has page action menus)
    const main = page.locator("main");
    const fileInput = main.locator('input[type="file"][accept=".md,.markdown"]');

    // Setting input files triggers the onChange handler directly
    await fileInput.setInputFiles({
      name: "imported-doc.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(markdownContent, "utf-8"),
    });

    // Wait for navigation to the newly created page
    await page.waitForURL((url) => url.href !== urlBefore, {
      timeout: 15_000,
    });

    // The new page should have an editor with the imported content
    const newEditor = page.locator('[contenteditable="true"]');
    await expect(newEditor).toBeVisible({ timeout: 10_000 });

    // Verify the imported content is rendered in the editor
    // Heading
    const heading = newEditor.locator("h1");
    await expect(heading).toBeVisible({ timeout: 5_000 });
    await expect(heading).toContainText("Imported Heading");

    // Paragraph with bold/italic
    await expect(newEditor).toContainText("A paragraph with");
    await expect(newEditor).toContainText("bold");
    await expect(newEditor).toContainText("italic");

    // List items
    await expect(newEditor).toContainText("List item alpha");
    await expect(newEditor).toContainText("List item beta");

    // Code block
    await expect(newEditor).toContainText("const x = 42;");

    // Link
    const link = newEditor.locator('a[href="https://example.com"]');
    await expect(link).toBeVisible({ timeout: 3_000 });
    await expect(link).toContainText("Example link");

    // Verify the page title matches the imported filename (minus extension)
    const titleInput = page.locator('input[aria-label="Page title"]');
    await expect(titleInput).toHaveValue("imported-doc", { timeout: 5_000 });
  });
});
