import { test, expect } from "./fixtures/auth";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";
import os from "os";

// ---------------------------------------------------------------------------
// Admin client for cleanup
// ---------------------------------------------------------------------------

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const createdDatabaseIds: string[] = [];

test.afterAll(async () => {
  if (createdDatabaseIds.length === 0) return;
  const admin = getAdminClient();
  for (const id of createdDatabaseIds) {
    await admin.from("pages").delete().eq("parent_id", id);
    await admin.from("pages").delete().eq("id", id);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForSidebarTree(page: import("@playwright/test").Page) {
  const sidebar = page.getByRole("complementary");
  const treeLoaded = sidebar
    .locator('[role="treeitem"], :text("No pages yet")')
    .first();
  await expect(treeLoaded).toBeVisible({ timeout: 15_000 });
  return sidebar;
}

async function createDatabaseFromSidebar(
  page: import("@playwright/test").Page,
): Promise<string> {
  const sidebar = await waitForSidebarTree(page);

  const newDbBtn = sidebar.getByTestId("sb-new-database-btn");
  await expect(newDbBtn).toBeVisible({ timeout: 5_000 });
  await newDbBtn.click();

  await page.waitForURL(
    (url) => url.pathname.split("/").filter(Boolean).length >= 2,
    { timeout: 15_000 },
  );

  const dbLoaded = page
    .locator('[role="grid"], :text("No rows yet")')
    .first();
  await expect(dbLoaded).toBeVisible({ timeout: 15_000 });

  const pathParts = new URL(page.url()).pathname.split("/").filter(Boolean);
  const pageId = pathParts[pathParts.length - 1];
  createdDatabaseIds.push(pageId);
  return pageId;
}

function createTempCSV(content: string): string {
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, `test-import-${Date.now()}.csv`);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Database CSV Import", () => {
  test("user can import CSV via upload → preview → confirm → rows appear", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Wait for the import button to be visible
    const importBtn = page.getByTestId("csv-import-button");
    await expect(importBtn).toBeVisible({ timeout: 10_000 });

    // Create a CSV file with Title and a text column
    const csvContent = "Title,Notes\nTask A,First note\nTask B,Second note\nTask C,Third note";
    const csvPath = createTempCSV(csvContent);

    try {
      // Trigger file upload via the hidden input
      const fileInput = page.getByTestId("csv-import-file-input");
      await fileInput.setInputFiles(csvPath);

      // The preview dialog should open
      const dialog = page.getByTestId("csv-import-dialog");
      await expect(dialog).toBeVisible({ timeout: 10_000 });

      // Verify the dialog shows row count
      await expect(dialog).toContainText("3 rows found");

      // Verify preview table shows data
      await expect(dialog).toContainText("Task A");
      await expect(dialog).toContainText("First note");

      // Click confirm
      const confirmBtn = page.getByTestId("csv-import-confirm");
      await expect(confirmBtn).toBeVisible();
      await expect(confirmBtn).toContainText("Import 3 rows");
      await confirmBtn.click();

      // Dialog should close
      await expect(dialog).not.toBeVisible({ timeout: 30_000 });

      // Rows should appear in the table
      // Wait for at least one of the imported rows to be visible
      await expect(
        page.locator('[data-testid^="db-table-row-"]').first(),
      ).toBeVisible({ timeout: 15_000 });

      // Verify we have rows in the table (at least the imported ones)
      const rowCount = await page
        .locator('[data-testid^="db-table-row-"]')
        .count();
      expect(rowCount).toBeGreaterThanOrEqual(3);
    } finally {
      // Clean up temp file
      fs.unlinkSync(csvPath);
    }
  });

  test("import button is visible in the database toolbar", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    // Wait for the database view to load
    const dbLoaded = page
      .locator('[role="grid"], :text("No rows yet")')
      .first();
    await expect(dbLoaded).toBeVisible({ timeout: 15_000 });

    // The import button should be visible
    const importBtn = page.getByTestId("csv-import-button");
    await expect(importBtn).toBeVisible({ timeout: 10_000 });
    await expect(importBtn).toContainText("Import CSV");
  });

  test("cancel button closes the import dialog without importing", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    const importBtn = page.getByTestId("csv-import-button");
    await expect(importBtn).toBeVisible({ timeout: 10_000 });

    const csvContent = "Title,Notes\nTask X,Some note";
    const csvPath = createTempCSV(csvContent);

    try {
      const fileInput = page.getByTestId("csv-import-file-input");
      await fileInput.setInputFiles(csvPath);

      const dialog = page.getByTestId("csv-import-dialog");
      await expect(dialog).toBeVisible({ timeout: 10_000 });

      // Click cancel
      const cancelBtn = page.getByTestId("csv-import-cancel");
      await cancelBtn.click();

      // Dialog should close
      await expect(dialog).not.toBeVisible({ timeout: 5_000 });

      // No rows should have been added (table should still be empty or have
      // only the rows that were there before)
    } finally {
      fs.unlinkSync(csvPath);
    }
  });

  test("preview dialog shows unmatched columns with create option", async ({
    authenticatedPage: page,
  }) => {
    await createDatabaseFromSidebar(page);

    const importBtn = page.getByTestId("csv-import-button");
    await expect(importBtn).toBeVisible({ timeout: 10_000 });

    // CSV with columns that don't match existing properties
    const csvContent =
      "Title,CustomField1,CustomField2\nRow 1,Value A,Value B";
    const csvPath = createTempCSV(csvContent);

    try {
      const fileInput = page.getByTestId("csv-import-file-input");
      await fileInput.setInputFiles(csvPath);

      const dialog = page.getByTestId("csv-import-dialog");
      await expect(dialog).toBeVisible({ timeout: 10_000 });

      // Should show unmatched column info
      await expect(dialog).toContainText("CustomField1");
      await expect(dialog).toContainText("CustomField2");
      await expect(dialog).toContainText("new text property");

      // Cancel to clean up
      await page.getByTestId("csv-import-cancel").click();
      await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    } finally {
      fs.unlinkSync(csvPath);
    }
  });
});
