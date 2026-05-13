import { test, expect } from "./fixtures/auth";
import {
  navigateToEditorPage,
  selectSlashOption,
} from "./fixtures/editor-helpers";

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
    await page.waitForLoadState("networkidle");

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

  test("importing markdown with unsupported elements handles them gracefully", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    const urlBefore = page.url();

    // Markdown with HTML tags, footnotes, and other unsupported elements
    const markdownContent = [
      "# Supported Heading",
      "",
      "A normal paragraph.",
      "",
      "<div class=\"custom\">HTML block content</div>",
      "",
      "<strong>HTML bold</strong> and <em>HTML italic</em>",
      "",
      "Text with a footnote[^1].",
      "",
      "[^1]: This is the footnote definition.",
      "",
      "<table><tr><td>HTML table cell</td></tr></table>",
      "",
      "Final paragraph after unsupported elements.",
    ].join("\n");

    // Collect console errors to verify no unhandled exceptions
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    const main = page.locator("main");
    const fileInput = main.locator(
      'input[type="file"][accept=".md,.markdown"]',
    );

    await fileInput.setInputFiles({
      name: "unsupported-elements.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(markdownContent, "utf-8"),
    });

    // Wait for navigation to the newly created page
    await page.waitForURL((url) => url.href !== urlBefore, {
      timeout: 15_000,
    });

    const newEditor = page.locator('[contenteditable="true"]');
    await expect(newEditor).toBeVisible({ timeout: 10_000 });

    // The supported heading should be rendered correctly
    const heading = newEditor.locator("h1");
    await expect(heading).toBeVisible({ timeout: 5_000 });
    await expect(heading).toContainText("Supported Heading");

    // Normal paragraphs should be present
    await expect(newEditor).toContainText("A normal paragraph.");
    await expect(newEditor).toContainText(
      "Final paragraph after unsupported elements.",
    );

    // Unsupported HTML/footnote content should appear as plain text (not crash)
    // The raw text content is preserved even if the markup is stripped
    await expect(newEditor).toContainText("HTML block content");
    await expect(newEditor).toContainText("footnote");

    // Page title should match the filename
    const titleInput = page.locator('input[aria-label="Page title"]');
    await expect(titleInput).toHaveValue("unsupported-elements", {
      timeout: 5_000,
    });

    // No unhandled JS errors during import
    const importErrors = consoleErrors.filter(
      (e) =>
        e.includes("Unhandled") ||
        e.includes("uncaught") ||
        e.includes("TypeError") ||
        e.includes("ReferenceError"),
    );
    expect(importErrors).toHaveLength(0);
  });

  test("importing an empty markdown file creates a page with empty content", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    const urlBefore = page.url();

    const main = page.locator("main");
    const fileInput = main.locator(
      'input[type="file"][accept=".md,.markdown"]',
    );

    // Import a completely empty file
    await fileInput.setInputFiles({
      name: "empty-file.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("", "utf-8"),
    });

    // Wait for navigation to the newly created page
    await page.waitForURL((url) => url.href !== urlBefore, {
      timeout: 15_000,
    });

    const newEditor = page.locator('[contenteditable="true"]');
    await expect(newEditor).toBeVisible({ timeout: 10_000 });

    // The editor should be present and editable (empty content = empty paragraph)
    await expect(newEditor).toBeEditable();

    // The editor should have minimal or no visible text content
    const textContent = await newEditor.textContent();
    expect(textContent?.trim()).toBe("");

    // Page title should match the filename (minus extension)
    const titleInput = page.locator('input[aria-label="Page title"]');
    await expect(titleInput).toHaveValue("empty-file", { timeout: 5_000 });

    // Verify the user can type into the empty page
    await newEditor.click();
    await page.keyboard.type("Content added after empty import");
    await expect(newEditor).toContainText("Content added after empty import");
  });

  test("exporting a page with code blocks containing special characters produces valid markdown", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Type content with a code block containing special characters
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");

    // Insert a heading
    await page.keyboard.type("/");
    await selectSlashOption(page, "Heading 1");
    await page.keyboard.type("Code Export Test");
    await page.keyboard.press("Enter");

    // Insert a code block via slash command
    await page.keyboard.type("/");
    await selectSlashOption(page, "Code Block");

    // Type code with special characters: backticks, angle brackets, ampersands
    await page.keyboard.type('const html = "<div class=\\"test\\">&amp;</div>";');
    await page.keyboard.press("Enter");
    await page.keyboard.type("const tpl = `template ${value}`;");
    await page.keyboard.press("Enter");
    await page.keyboard.type("// <script>alert('xss')</script>");

    // Wait for auto-save
    await page.waitForLoadState("networkidle");

    // Export via page menu
    const main = page.locator("main");
    const menuTrigger = main.locator('button[aria-label="Page actions"]');
    await expect(menuTrigger).toBeVisible({ timeout: 5_000 });
    await menuTrigger.click();

    const exportItem = page
      .getByRole("menuitem")
      .filter({ hasText: "Export as Markdown" });
    await expect(exportItem).toBeVisible({ timeout: 3_000 });

    const downloadPromise = page.waitForEvent("download");
    await exportItem.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.md$/);

    const content = await (await download.createReadStream())
      .toArray()
      .then((chunks) => Buffer.concat(chunks).toString("utf-8"));

    // The exported markdown should contain the code block delimiters
    expect(content).toContain("```");

    // The special characters should be present in the export
    expect(content).toContain("<div");
    expect(content).toContain("&amp;");
    expect(content).toContain("template");
    expect(content).toContain("<script>");

    // Verify the markdown is structurally valid: code block should be
    // properly fenced (opening and closing ```)
    const codeBlockMatches = content.match(/```/g);
    expect(codeBlockMatches).not.toBeNull();
    // Must have an even number of ``` delimiters (opening + closing pairs)
    expect(codeBlockMatches!.length % 2).toBe(0);
  });

  test("exporting a page with nested lists preserves nesting in markdown", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");

    // Insert a heading
    await page.keyboard.type("/");
    await selectSlashOption(page, "Heading 1");
    await page.keyboard.type("Nested List Test");
    await page.keyboard.press("Enter");

    // Create a bullet list with 3+ levels of nesting
    await page.keyboard.type("/");
    await selectSlashOption(page, "Bullet List");
    await page.keyboard.type("Level 1 item A");
    await page.keyboard.press("Enter");

    // Indent to level 2
    await page.keyboard.press("Tab");
    await page.keyboard.type("Level 2 item A");
    await page.keyboard.press("Enter");

    // Indent to level 3
    await page.keyboard.press("Tab");
    await page.keyboard.type("Level 3 item A");
    await page.keyboard.press("Enter");

    // Back to level 2
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.type("Level 2 item B");
    await page.keyboard.press("Enter");

    // Back to level 1
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.type("Level 1 item B");

    // Wait for auto-save
    await page.waitForLoadState("networkidle");

    // Export via page menu
    const main = page.locator("main");
    const menuTrigger = main.locator('button[aria-label="Page actions"]');
    await expect(menuTrigger).toBeVisible({ timeout: 5_000 });
    await menuTrigger.click();

    const exportItem = page
      .getByRole("menuitem")
      .filter({ hasText: "Export as Markdown" });
    await expect(exportItem).toBeVisible({ timeout: 3_000 });

    const downloadPromise = page.waitForEvent("download");
    await exportItem.click();
    const download = await downloadPromise;

    const content = await (await download.createReadStream())
      .toArray()
      .then((chunks) => Buffer.concat(chunks).toString("utf-8"));

    // Verify all list items are present
    expect(content).toContain("Level 1 item A");
    expect(content).toContain("Level 2 item A");
    expect(content).toContain("Level 3 item A");
    expect(content).toContain("Level 2 item B");
    expect(content).toContain("Level 1 item B");

    // Verify nesting is preserved via indentation in the markdown.
    // Level 1 items should start with "- " (no leading spaces).
    // Level 2 items should have indentation (spaces or tabs before "-").
    // Level 3 items should have deeper indentation.
    const lines = content.split("\n");

    const level1Lines = lines.filter(
      (l) => l.match(/^- Level 1/) || l.match(/^\* Level 1/),
    );
    const level2Lines = lines.filter(
      (l) => l.match(/^\s+- Level 2/) || l.match(/^\s+\* Level 2/),
    );
    const level3Lines = lines.filter(
      (l) => l.match(/^\s+\s+- Level 3/) || l.match(/^\s+\s+\* Level 3/),
    );

    expect(level1Lines.length).toBeGreaterThanOrEqual(2);
    expect(level2Lines.length).toBeGreaterThanOrEqual(2);
    expect(level3Lines.length).toBeGreaterThanOrEqual(1);
  });

  test("round-trip: export then import preserves content", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // Create structured content for the round-trip test
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");

    // Heading
    await page.keyboard.type("/");
    await selectSlashOption(page, "Heading 1");
    await page.keyboard.type("Round Trip Heading");
    await page.keyboard.press("Enter");

    // Paragraph with formatting
    await page.keyboard.type("A paragraph with important content.");
    await page.keyboard.press("Enter");

    // Bullet list
    await page.keyboard.type("/");
    await selectSlashOption(page, "Bullet List");
    await page.keyboard.type("Alpha item");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Beta item");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Gamma item");

    // Wait for auto-save
    await page.waitForLoadState("networkidle");

    // Step 1: Export the page
    const main = page.locator("main");
    const menuTrigger = main.locator('button[aria-label="Page actions"]');
    await expect(menuTrigger).toBeVisible({ timeout: 5_000 });
    await menuTrigger.click();

    const exportItem = page
      .getByRole("menuitem")
      .filter({ hasText: "Export as Markdown" });
    await expect(exportItem).toBeVisible({ timeout: 3_000 });

    const downloadPromise = page.waitForEvent("download");
    await exportItem.click();
    const download = await downloadPromise;

    const exportedMarkdown = await (await download.createReadStream())
      .toArray()
      .then((chunks) => Buffer.concat(chunks).toString("utf-8"));

    // Verify the export has the expected content
    expect(exportedMarkdown).toContain("Round Trip Heading");
    expect(exportedMarkdown).toContain("A paragraph with important content.");
    expect(exportedMarkdown).toContain("Alpha item");

    // Step 2: Import the exported markdown as a new page
    const urlBeforeImport = page.url();

    const fileInput = main.locator(
      'input[type="file"][accept=".md,.markdown"]',
    );

    await fileInput.setInputFiles({
      name: "round-trip-test.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(exportedMarkdown, "utf-8"),
    });

    // Wait for navigation to the newly created page
    await page.waitForURL((url) => url.href !== urlBeforeImport, {
      timeout: 15_000,
    });

    const newEditor = page.locator('[contenteditable="true"]');
    await expect(newEditor).toBeVisible({ timeout: 10_000 });

    // Step 3: Verify the imported content matches the original
    // Heading
    const heading = newEditor.locator("h1");
    await expect(heading).toBeVisible({ timeout: 5_000 });
    await expect(heading).toContainText("Round Trip Heading");

    // Paragraph
    await expect(newEditor).toContainText(
      "A paragraph with important content.",
    );

    // List items
    await expect(newEditor).toContainText("Alpha item");
    await expect(newEditor).toContainText("Beta item");
    await expect(newEditor).toContainText("Gamma item");

    // Page title should match the imported filename
    const titleInput = page.locator('input[aria-label="Page title"]');
    await expect(titleInput).toHaveValue("round-trip-test", {
      timeout: 5_000,
    });
  });
});
