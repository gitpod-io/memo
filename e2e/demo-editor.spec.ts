import { test, expect } from "@playwright/test";

test.describe("Demo editor on landing page", () => {
  test.beforeEach(async ({ page }) => {
    // Clear sessionStorage before each test to start fresh
    await page.goto("/");
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await page.waitForSelector('[data-testid="demo-editor"]', {
      timeout: 15_000,
    });
  });

  test("renders the demo editor with placeholder", async ({ page }) => {
    const editor = page.locator('[data-testid="demo-editor"]');
    await expect(editor).toBeVisible();

    // Placeholder text should be visible in the empty editor
    await expect(page.getByText("Type '/' for commands")).toBeVisible();
  });

  test("supports typing text", async ({ page }) => {
    const editable = page.locator(
      '[data-testid="demo-editor"] [contenteditable="true"]',
    );
    await editable.click();
    await page.keyboard.type("Hello from the demo editor");

    await expect(editable).toContainText("Hello from the demo editor");
  });

  test("slash command menu opens and inserts heading", async ({ page }) => {
    const editable = page.locator(
      '[data-testid="demo-editor"] [contenteditable="true"]',
    );
    await editable.click();
    await page.keyboard.type("/head");

    // Slash menu should appear with heading options
    const slashMenu = page.locator('[data-testid="demo-editor-slash-menu"]');
    await expect(slashMenu).toBeVisible({ timeout: 5_000 });

    const option = slashMenu.locator('[role="option"]').first();
    await expect(option).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press("Enter");

    // The heading block should be inserted
    const heading = page.locator('[data-testid="demo-editor"] h1');
    await expect(heading).toBeVisible({ timeout: 3_000 });
  });

  test("slash command menu excludes Supabase-dependent items", async ({
    page,
  }) => {
    const editable = page.locator(
      '[data-testid="demo-editor"] [contenteditable="true"]',
    );
    await editable.click();
    await page.keyboard.type("/");

    // Wait for the slash menu to appear
    const slashMenu = page.locator('[data-testid="demo-editor-slash-menu"]');
    await expect(slashMenu).toBeVisible({ timeout: 5_000 });

    // These items should NOT be in the demo slash menu
    await expect(slashMenu.getByText("Image", { exact: true })).not.toBeVisible();
    await expect(
      slashMenu.getByText("Link to page", { exact: true }),
    ).not.toBeVisible();
    await expect(
      slashMenu.getByText("Database", { exact: true }),
    ).not.toBeVisible();

    // These items SHOULD be present
    await expect(slashMenu.getByText("Paragraph")).toBeVisible();
    await expect(slashMenu.getByText("Heading 1")).toBeVisible();
    await expect(slashMenu.getByText("Bullet List")).toBeVisible();
    await expect(slashMenu.getByText("Code Block")).toBeVisible();
    await expect(slashMenu.getByText("Quote", { exact: true })).toBeVisible();
    await expect(slashMenu.getByText("Divider", { exact: true })).toBeVisible();
  });

  test("floating toolbar appears on text selection", async ({ page }) => {
    const editable = page.locator(
      '[data-testid="demo-editor"] [contenteditable="true"]',
    );
    await editable.click();
    await page.keyboard.type("Select this text");

    // Select all text
    await page.keyboard.down("Shift");
    await page.keyboard.press("Home");
    await page.keyboard.up("Shift");

    // Floating toolbar should appear
    const toolbar = page.locator(
      '[role="toolbar"][aria-label="Text formatting"]',
    );
    await expect(toolbar).toBeVisible({ timeout: 5_000 });
  });

  test("persists content to sessionStorage and restores on reload", async ({
    page,
  }) => {
    const editable = page.locator(
      '[data-testid="demo-editor"] [contenteditable="true"]',
    );
    await editable.click();
    await page.keyboard.type("Persistent content test");

    // Wait for debounced save (500ms + buffer)
    await page.waitForTimeout(1000);

    // Verify sessionStorage has content
    const stored = await page.evaluate(() =>
      sessionStorage.getItem("memo-demo-editor-content"),
    );
    expect(stored).toBeTruthy();
    expect(stored).toContain("Persistent content test");

    // Reload the page
    await page.reload();
    await page.waitForSelector('[data-testid="demo-editor"]', {
      timeout: 15_000,
    });

    // Content should be restored
    const editable2 = page.locator(
      '[data-testid="demo-editor"] [contenteditable="true"]',
    );
    await expect(editable2).toContainText("Persistent content test");
  });

  test("CTA section is visible with sign-up and sign-in links", async ({
    page,
  }) => {
    const cta = page.locator('[data-testid="landing-cta"]');
    await expect(cta).toBeVisible();
    await expect(cta.getByText("Ready to save your work?")).toBeVisible();
    await expect(cta.getByRole("link", { name: "Sign Up" })).toBeVisible();
    await expect(cta.getByRole("link", { name: "Sign In" })).toBeVisible();
  });

  test("sign-up link navigates to /sign-up", async ({ page }) => {
    const cta = page.locator('[data-testid="landing-cta"]');
    const signUpLink = cta.getByRole("link", { name: "Sign Up" });
    await expect(signUpLink).toHaveAttribute("href", "/sign-up");
  });

  test("no Supabase database calls are made from the landing page editor", async ({
    page,
  }) => {
    // Monitor network requests for Supabase API calls
    const supabaseRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("supabase") && !url.includes("auth")) {
        supabaseRequests.push(url);
      }
    });

    const editable = page.locator(
      '[data-testid="demo-editor"] [contenteditable="true"]',
    );
    await editable.click();
    await page.keyboard.type("Testing no supabase calls");

    // Wait for any potential debounced saves
    await page.waitForTimeout(1500);

    // Filter out auth-related calls (getUser on page load is expected)
    const nonAuthCalls = supabaseRequests.filter(
      (url) => !url.includes("auth") && !url.includes("token"),
    );
    expect(nonAuthCalls).toHaveLength(0);
  });

  test("supports core block types via slash commands", async ({ page }) => {
    const editable = page.locator(
      '[data-testid="demo-editor"] [contenteditable="true"]',
    );

    // Insert a bullet list
    await editable.click();
    await page.keyboard.type("/bullet");
    const option = page.locator('[role="option"]').first();
    await expect(option).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press("Enter");

    // Type list item content
    await page.keyboard.type("List item one");

    // Verify a list was created
    const list = page.locator('[data-testid="demo-editor"] ul');
    await expect(list).toBeVisible();
  });

  test("page title and heading are visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Memo" })).toBeVisible();
    await expect(
      page.getByText(
        "A Notion-style workspace, built with zero human code.",
      ),
    ).toBeVisible();
  });
});
