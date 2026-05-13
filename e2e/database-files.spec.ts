import path from "node:path";
import { test, expect } from "./fixtures/auth";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Admin client for setup and cleanup
// ---------------------------------------------------------------------------

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

let databasePageId: string;
let workspaceSlug: string;
let filesPropertyId: string;
let rowId: string;

// ---------------------------------------------------------------------------
// Setup: create a database with a files property and one row
// ---------------------------------------------------------------------------

test.beforeAll(async () => {
  const admin = getAdminClient();
  const email = process.env.TEST_USER_EMAIL!;

  // Find the test user
  const { data: userList } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  let testUserId: string | undefined;
  if (userList?.users) {
    testUserId = userList.users.find((u) => u.email === email)?.id;
  }
  if (!testUserId) throw new Error(`Test user ${email} not found`);

  // Get workspace
  const { data: memberships } = await admin
    .from("members")
    .select("workspace_id, workspaces(id, slug)")
    .eq("user_id", testUserId)
    .limit(10);

  if (!memberships || memberships.length === 0) {
    throw new Error("No workspace found for test user");
  }

  const ws = memberships[0].workspaces as unknown as {
    id: string;
    slug: string;
  };
  workspaceSlug = ws.slug;

  // Create a database page
  const { data: dbPage, error: dbErr } = await admin
    .from("pages")
    .insert({
      workspace_id: ws.id,
      title: "Files Test DB",
      is_database: true,
      position: 9981,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  databasePageId = dbPage.id;

  // Create a files property
  const { data: filesProp, error: filesErr } = await admin
    .from("database_properties")
    .insert({
      database_id: databasePageId,
      name: "Attachments",
      type: "files",
      config: {},
      position: 0,
    })
    .select()
    .single();

  if (filesErr || !filesProp)
    throw new Error(
      `Failed to create files property: ${filesErr?.message}`,
    );
  filesPropertyId = filesProp.id;

  // Create a default table view
  const { error: tvErr } = await admin
    .from("database_views")
    .insert({
      database_id: databasePageId,
      name: "Table view",
      type: "table",
      config: {},
      position: 0,
    })
    .select()
    .single();

  if (tvErr) throw new Error(`Failed to create table view: ${tvErr.message}`);

  // Create a row
  const { data: rowPage, error: rowErr } = await admin
    .from("pages")
    .insert({
      workspace_id: ws.id,
      parent_id: databasePageId,
      title: "File Row",
      is_database: false,
      position: 0,
      created_by: testUserId,
    })
    .select()
    .single();

  if (rowErr || !rowPage)
    throw new Error(`Failed to create row: ${rowErr?.message}`);
  rowId = rowPage.id;

  // Upload a test file to Supabase Storage via admin client
  const fs = await import("node:fs");
  const testImagePath = path.resolve(__dirname, "fixtures/test-image.png");
  const fileBuffer = fs.readFileSync(testImagePath);
  const filePath = `uploads/test-e2e-${Date.now()}.png`;

  const { error: uploadErr } = await admin.storage
    .from("page-images")
    .upload(filePath, fileBuffer, {
      contentType: "image/png",
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadErr)
    throw new Error(`Failed to upload test file: ${uploadErr.message}`);

  const { data: urlData } = admin.storage
    .from("page-images")
    .getPublicUrl(filePath);

  // Pre-populate the row with a file value
  const { error: rvErr } = await admin.from("row_values").insert({
    row_id: rowId,
    property_id: filesPropertyId,
    value: {
      files: [{ name: "test-image.png", url: urlData.publicUrl }],
    },
  });

  if (rvErr)
    throw new Error(`Failed to set row value: ${rvErr.message}`);
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

test.afterAll(async () => {
  const admin = getAdminClient();

  // Delete row values
  await admin.from("row_values").delete().eq("row_id", rowId);

  // Delete rows
  await admin.from("pages").delete().eq("parent_id", databasePageId);

  // Delete views, properties, and the database page
  await admin
    .from("database_views")
    .delete()
    .eq("database_id", databasePageId);
  await admin
    .from("database_properties")
    .delete()
    .eq("database_id", databasePageId);
  await admin.from("pages").delete().eq("id", databasePageId);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function navigateToDatabase(page: import("@playwright/test").Page) {
  await page.goto(`/${workspaceSlug}/${databasePageId}`);
  await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Files property type", () => {
  test("file thumbnail renders on the row detail page", async ({
    authenticatedPage: page,
  }) => {
    // Navigate to the row detail page where FilesRenderer is used
    await page.goto(`/${workspaceSlug}/${rowId}`);

    // Wait for the properties header to load
    const attachmentsLabel = page.getByTestId(`db-row-property-name-${filesPropertyId}`);
    await expect(attachmentsLabel).toBeVisible({ timeout: 15_000 });

    // The FilesRenderer should show the file thumbnail (img for image files)
    const thumbnail = page.locator('img[alt="test-image.png"]');
    await expect(thumbnail).toBeVisible({ timeout: 10_000 });
  });

  test("file editor opens and shows existing files when cell is clicked", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Click the files cell to open the editor
    const filesCell = page.locator('[role="gridcell"][data-col]').first();
    await expect(filesCell).toBeVisible({ timeout: 10_000 });
    await filesCell.click();

    // The files editor should appear with the "Upload file" button
    const uploadBtn = page.locator("button", { hasText: "Upload file" });
    await expect(uploadBtn).toBeVisible({ timeout: 5_000 });

    // The existing file should be listed with its name and remove button
    const removeBtn = page.locator(
      'button[aria-label="Remove test-image.png"]',
    );
    await expect(removeBtn).toBeVisible({ timeout: 5_000 });

    // Close the editor
    await page.keyboard.press("Escape");
  });

  test("file can be removed from the cell editor", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // Click the cell to open the editor
    const filesCell = page.locator('[role="gridcell"][data-col]').first();
    await expect(filesCell).toBeVisible({ timeout: 10_000 });
    await filesCell.click();

    // Wait for the file to appear in the editor
    const removeBtn = page.locator(
      'button[aria-label="Remove test-image.png"]',
    );
    await expect(removeBtn).toBeVisible({ timeout: 10_000 });

    // Click the remove button — this triggers onChange which closes the editor
    await removeBtn.click();

    // The editor closes after onChange. Wait for it to close.
    await expect(removeBtn).not.toBeVisible({ timeout: 5_000 });

    // Re-open the editor to verify the file was removed
    const filesCellAgain = page
      .locator('[role="gridcell"][data-col]')
      .first();
    await expect(filesCellAgain).toBeVisible({ timeout: 5_000 });
    await filesCellAgain.click();

    // The upload button should be visible but no file listed
    const uploadBtn = page.locator("button", { hasText: "Upload file" });
    await expect(uploadBtn).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('button[aria-label="Remove test-image.png"]'),
    ).not.toBeVisible({ timeout: 3_000 });

    // Close the editor
    await page.keyboard.press("Escape");

    // Restore the file for other tests by re-inserting via admin
    const admin = getAdminClient();
    const { data: urlData } = admin.storage
      .from("page-images")
      .getPublicUrl("uploads/placeholder.png");

    await admin
      .from("row_values")
      .upsert({
        row_id: rowId,
        property_id: filesPropertyId,
        value: {
          files: [
            { name: "test-image.png", url: urlData.publicUrl },
          ],
        },
      });
  });

  test("upload a file via the cell editor using file chooser", async ({
    authenticatedPage: page,
  }) => {
    await navigateToDatabase(page);

    // First remove existing files to start clean
    const admin = getAdminClient();
    await admin
      .from("row_values")
      .update({ value: { files: [] } })
      .eq("row_id", rowId)
      .eq("property_id", filesPropertyId);

    // Reload to get clean state
    await page.reload();
    await expect(page.locator('[role="grid"]')).toBeVisible({
      timeout: 15_000,
    });

    // Click the files cell to open the editor
    const filesCell = page.locator('[role="gridcell"][data-col]').first();
    await expect(filesCell).toBeVisible({ timeout: 10_000 });
    await filesCell.click();

    // The files editor should appear with an "Upload file" button
    const uploadBtn = page.locator("button", { hasText: "Upload file" });
    await expect(uploadBtn).toBeVisible({ timeout: 5_000 });

    // Listen for the file chooser event before clicking the upload button
    const fileChooserPromise = page.waitForEvent("filechooser");
    await uploadBtn.click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(
      path.resolve(__dirname, "fixtures/test-image.png"),
    );

    // The upload triggers onChange which closes the editor.
    // Wait for the editor to close (upload button disappears).
    await expect(uploadBtn).not.toBeVisible({ timeout: 15_000 });

    // Re-open the editor to verify the file was uploaded
    const filesCellAgain = page
      .locator('[role="gridcell"][data-col]')
      .first();
    await expect(filesCellAgain).toBeVisible({ timeout: 5_000 });
    await filesCellAgain.click();

    // The uploaded file should appear with a remove button
    const removeBtn = page.locator(
      'button[aria-label="Remove test-image.png"]',
    );
    await expect(removeBtn).toBeVisible({ timeout: 10_000 });

    // Close the editor
    await page.keyboard.press("Escape");
  });
});
