import path from "node:path";
import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage } from "./fixtures/editor-helpers";

const TEST_IMAGE_PATH = path.join(__dirname, "fixtures", "test-image.png");

/**
 * Wait for a successful Supabase PATCH to /rest/v1/pages (cover_url save).
 */
function waitForCoverSave(page: import("@playwright/test").Page) {
  return page.waitForResponse(
    (resp) =>
      resp.url().includes("/rest/v1/pages") &&
      resp.request().method() === "PATCH" &&
      resp.status() >= 200 &&
      resp.status() < 300,
    { timeout: 15_000 },
  );
}

/**
 * Add a cover image to the current page by hovering the page header area,
 * clicking "Add cover", and selecting a file via the file chooser.
 */
async function addCoverImage(page: import("@playwright/test").Page) {
  // The "Add cover" button is only visible on hover over the page header group.
  // Hover over the page title area to reveal it.
  const pageHeader = page.locator(".group\\/page-header");
  await pageHeader.hover();

  const addCoverButton = page.getByRole("button", {
    name: /add cover image/i,
  });
  await expect(addCoverButton).toBeVisible({ timeout: 3_000 });

  // The hidden file input is triggered by clicking the button.
  const fileChooserPromise = page.waitForEvent("filechooser");
  await addCoverButton.click();

  const fileChooser = await fileChooserPromise;
  const savePromise = waitForCoverSave(page);
  await fileChooser.setFiles(TEST_IMAGE_PATH);

  // Wait for the cover image to appear
  const coverImage = page.locator(".group\\/cover img");
  await expect(coverImage).toBeVisible({ timeout: 15_000 });

  // Wait for the save to persist
  await savePromise;

  return coverImage;
}

test.describe("Page cover images", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await navigateToEditorPage(page);
  });

  test("user can add a cover image to a page", async ({
    authenticatedPage: page,
  }) => {
    const coverImage = await addCoverImage(page);

    // Verify the image src points to Supabase storage
    const src = await coverImage.getAttribute("src");
    expect(src).toBeTruthy();
    expect(src).toContain("page-images");
  });

  test("cover image is displayed at the top of the page", async ({
    authenticatedPage: page,
  }) => {
    await addCoverImage(page);

    // The cover container should be above the editor content.
    // Verify the cover wrapper exists with the expected structure.
    const coverContainer = page.locator(".group\\/cover");
    await expect(coverContainer).toBeVisible();

    // The cover should have a fixed height container
    const imageWrapper = coverContainer.locator("div").first();
    const box = await imageWrapper.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(180); // ~200px height
  });

  test("user can change the cover image", async ({
    authenticatedPage: page,
  }) => {
    // First add a cover
    const coverImage = await addCoverImage(page);
    const originalSrc = await coverImage.getAttribute("src");

    // Hover over the cover to reveal the dropdown trigger
    const coverContainer = page.locator(".group\\/cover");
    await coverContainer.hover();

    // Click the "Cover" dropdown trigger
    const coverMenuTrigger = coverContainer.getByText("Cover", { exact: true });
    await expect(coverMenuTrigger).toBeVisible({ timeout: 3_000 });
    await coverMenuTrigger.click();

    // Click "Change cover"
    const changeCoverItem = page.getByRole("menuitem", {
      name: /change cover/i,
    });
    await expect(changeCoverItem).toBeVisible({ timeout: 3_000 });

    const fileChooserPromise = page.waitForEvent("filechooser");
    await changeCoverItem.click();

    const fileChooser = await fileChooserPromise;
    const savePromise = waitForCoverSave(page);
    await fileChooser.setFiles(TEST_IMAGE_PATH);

    // Wait for the new image to load and save
    await savePromise;

    // The cover image should still be visible
    const updatedImage = page.locator(".group\\/cover img");
    await expect(updatedImage).toBeVisible({ timeout: 10_000 });

    // The src should have changed (new UUID in the filename)
    const newSrc = await updatedImage.getAttribute("src");
    expect(newSrc).toBeTruthy();
    expect(newSrc).toContain("page-images");
    expect(newSrc).not.toBe(originalSrc);
  });

  test("user can remove the cover image", async ({
    authenticatedPage: page,
  }) => {
    // First add a cover
    await addCoverImage(page);

    // Hover over the cover to reveal the dropdown trigger
    const coverContainer = page.locator(".group\\/cover");
    await coverContainer.hover();

    // Click the "Cover" dropdown trigger
    const coverMenuTrigger = coverContainer.getByText("Cover", { exact: true });
    await expect(coverMenuTrigger).toBeVisible({ timeout: 3_000 });
    await coverMenuTrigger.click();

    // Click "Remove cover"
    const removeCoverItem = page.getByRole("menuitem", {
      name: /remove cover/i,
    });
    await expect(removeCoverItem).toBeVisible({ timeout: 3_000 });

    const savePromise = waitForCoverSave(page);
    await removeCoverItem.click();
    await savePromise;

    // The cover container should no longer be visible
    await expect(coverContainer).not.toBeVisible({ timeout: 5_000 });

    // The "Add cover" button should be available again on hover
    const pageHeader = page.locator(".group\\/page-header");
    await pageHeader.hover();

    const addCoverButton = page.getByRole("button", {
      name: /add cover image/i,
    });
    await expect(addCoverButton).toBeVisible({ timeout: 3_000 });
  });

  test("cover image persists after page reload", async ({
    authenticatedPage: page,
  }) => {
    // Add a cover and capture its src
    const coverImage = await addCoverImage(page);
    const imageSrc = await coverImage.getAttribute("src");
    expect(imageSrc).toBeTruthy();

    // Reload the page
    await page.reload({ waitUntil: "domcontentloaded" });

    // Wait for the page to re-render
    const editor = page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // The cover image should still be visible after reload
    const persistedImage = page.locator(".group\\/cover img");
    await expect(persistedImage).toBeVisible({ timeout: 10_000 });

    // Verify it's the same image URL
    const persistedSrc = await persistedImage.getAttribute("src");
    expect(persistedSrc).toBe(imageSrc);
  });
});
