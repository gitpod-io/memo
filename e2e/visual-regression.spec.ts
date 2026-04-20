import { test, expect } from "@playwright/test";

interface StoryEntry {
  id: string;
  title: string;
  name: string;
  type: "story" | "docs";
}

const STORYBOOK_URL = process.env.STORYBOOK_URL ?? "http://localhost:6099";

test.describe("visual regression", () => {
  let stories: StoryEntry[];

  test.beforeAll(async ({ request }) => {
    const res = await request.get(`${STORYBOOK_URL}/index.json`);
    expect(res.ok()).toBe(true);
    const data = (await res.json()) as { entries: Record<string, StoryEntry> };
    stories = Object.values(data.entries).filter((e) => e.type === "story");
    expect(stories.length).toBeGreaterThan(0);
  });

  test("all stories match baselines", async ({ page }) => {
    test.setTimeout(stories.length * 5_000);

    for (const story of stories) {
      const url = `${STORYBOOK_URL}/iframe.html?id=${story.id}&viewMode=story`;
      await page.goto(url, { waitUntil: "networkidle" });

      // Wait for any animations/transitions to settle
      await page.waitForTimeout(300);

      const safeName = `${story.title}--${story.name}`
        .replace(/[^a-zA-Z0-9-]/g, "-")
        .toLowerCase();

      await expect(page).toHaveScreenshot(`${safeName}.png`, {
        maxDiffPixelRatio: 0.001,
        fullPage: true,
      });
    }
  });
});
