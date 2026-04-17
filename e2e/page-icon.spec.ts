import { test, expect } from "./fixtures/auth";
import { navigateToEditorPage } from "./fixtures/editor-helpers";

test.describe("Page Icon Emoji Picker", () => {
  test("user can set a page icon via emoji picker", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    // Find the page icon button (either shows an emoji or the "Add page icon" label)
    const iconButton = page.getByRole("button", { name: /page icon|add page icon/i });
    await expect(iconButton).toBeVisible({ timeout: 5_000 });

    // Click to open the emoji picker
    await iconButton.click();

    // The emoji picker dialog should appear
    const picker = page.getByRole("dialog", { name: /emoji picker/i });
    await expect(picker).toBeVisible({ timeout: 3_000 });

    // Filter input should be focused
    const filterInput = picker.getByRole("textbox", { name: /filter/i });
    await expect(filterInput).toBeVisible();

    // Select an emoji (the rocket emoji from Symbols category)
    const rocketButton = picker.getByRole("button", { name: /select 🚀/i });
    await rocketButton.click();

    // Picker should close
    await expect(picker).not.toBeVisible({ timeout: 2_000 });

    // The icon button should now show the selected emoji
    const updatedButton = page.getByRole("button", { name: /page icon: 🚀/i });
    await expect(updatedButton).toBeVisible({ timeout: 3_000 });
  });

  test("user can remove a page icon", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    // First set an icon
    const iconButton = page.getByRole("button", { name: /page icon|add page icon/i });
    await expect(iconButton).toBeVisible({ timeout: 5_000 });
    await iconButton.click();

    const picker = page.getByRole("dialog", { name: /emoji picker/i });
    await expect(picker).toBeVisible({ timeout: 3_000 });

    // Select a star emoji
    const starButton = picker.getByRole("button", { name: /select ⭐/i });
    await starButton.click();
    await expect(picker).not.toBeVisible({ timeout: 2_000 });

    // Now reopen the picker
    const iconWithEmoji = page.getByRole("button", { name: /page icon: ⭐/i });
    await expect(iconWithEmoji).toBeVisible({ timeout: 3_000 });
    await iconWithEmoji.click();

    const picker2 = page.getByRole("dialog", { name: /emoji picker/i });
    await expect(picker2).toBeVisible({ timeout: 3_000 });

    // Click "Remove icon"
    const removeButton = picker2.getByRole("button", { name: /remove icon/i });
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    // Picker should close and icon should be removed
    await expect(picker2).not.toBeVisible({ timeout: 2_000 });

    // The button should revert to "Add page icon"
    const addIconButton = page.getByRole("button", { name: /add page icon/i });
    await expect(addIconButton).toBeVisible({ timeout: 3_000 });
  });

  test("emoji picker closes on Escape", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const iconButton = page.getByRole("button", { name: /page icon|add page icon/i });
    await expect(iconButton).toBeVisible({ timeout: 5_000 });
    await iconButton.click();

    const picker = page.getByRole("dialog", { name: /emoji picker/i });
    await expect(picker).toBeVisible({ timeout: 3_000 });

    // Press Escape to close
    await page.keyboard.press("Escape");
    await expect(picker).not.toBeVisible({ timeout: 2_000 });
  });

  test("emoji picker can filter by category", async ({
    authenticatedPage: page,
  }) => {
    await navigateToEditorPage(page);

    const iconButton = page.getByRole("button", { name: /page icon|add page icon/i });
    await expect(iconButton).toBeVisible({ timeout: 5_000 });
    await iconButton.click();

    const picker = page.getByRole("dialog", { name: /emoji picker/i });
    await expect(picker).toBeVisible({ timeout: 3_000 });

    // Type a filter term
    const filterInput = picker.getByRole("textbox", { name: /filter/i });
    await filterInput.fill("Animals");

    // Animals category should be visible
    await expect(picker.getByText("Animals")).toBeVisible();

    // Other categories should not be visible
    await expect(picker.getByText("Smileys")).not.toBeVisible();
    await expect(picker.getByText("Objects")).not.toBeVisible();
  });
});
