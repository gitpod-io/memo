import { test, expect } from "./fixtures/auth";

test.describe("Sidebar page tree drag-and-drop", () => {
  test("drag handle appears on sidebar page item hover", async ({
    authenticatedPage: page,
  }) => {
    // Wait for the page tree to load
    const treeItem = page.locator('[role="treeitem"]').first();
    await expect(treeItem).toBeVisible({ timeout: 10_000 }).catch(() => {
      // no-op: tree may be empty
    });

    const pageItems = page.locator('[role="treeitem"]');
    if ((await pageItems.count()) < 1) {
      test.skip(true, "Need at least 1 page in sidebar");
      return;
    }

    await pageItems.first().hover();
    await page.waitForTimeout(300);

    // The sidebar drag handle should be visible (GripVertical icon)
    const gripIcon = page.locator("svg.lucide-grip-vertical").first();
    await expect(gripIcon).toBeVisible({ timeout: 2_000 });
  });

  test("pages can be reordered in sidebar via drag-and-drop", async ({
    authenticatedPage: page,
  }) => {
    // Wait for the page tree to load
    const treeItem = page.locator('[role="treeitem"]').first();
    await expect(treeItem).toBeVisible({ timeout: 10_000 }).catch(() => {
      // no-op: tree may be empty
    });

    const pageItems = page.locator('[role="treeitem"]');
    if ((await pageItems.count()) < 2) {
      test.skip(true, "Need at least 2 pages in sidebar to test reorder");
      return;
    }

    // Get initial order — read the page title button text inside each tree item
    const secondText = await pageItems.nth(1).locator("button").last().textContent();

    // Hover first item to reveal drag handle
    await pageItems.first().hover();
    await page.waitForTimeout(300);

    const gripIcon = page.locator("svg.lucide-grip-vertical").first();
    if ((await gripIcon.count()) === 0) {
      test.skip(true, "Drag handle not found");
      return;
    }

    const gripBox = await gripIcon.boundingBox();
    const secondBox = await pageItems.nth(1).boundingBox();

    if (!gripBox || !secondBox) {
      test.skip(true, "Could not get element positions");
      return;
    }

    // Drag first item below second
    await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      secondBox.x + secondBox.width / 2,
      secondBox.y + secondBox.height + 5,
      { steps: 10 }
    );
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Verify order changed
    const updatedItems = page.locator('[role="treeitem"]');
    const newFirstText = await updatedItems.nth(0).locator("button").last().textContent();

    // The first item should now be what was previously second
    expect(newFirstText).toBe(secondText);
  });
});
