import { test, expect } from "@playwright/test";

interface StoryEntry {
  id: string;
  title: string;
  name: string;
  type: "story" | "docs";
}

const STORYBOOK_URL = process.env.STORYBOOK_URL ?? "http://localhost:6099";

// Baselines are captured in the devcontainer; CI runs on ubuntu-latest.
// Font rendering / antialiasing differences between environments cause small
// pixel diffs (typically ≤1-2%) that are not real regressions.  The default
// threshold accommodates this.  Date-dependent stories (calendars highlighting
// "today") get an even higher allowance.
const DEFAULT_THRESHOLD = 0.02;
const DATE_DEPENDENT_THRESHOLD = 0.05;

const DATE_DEPENDENT_STORY_PATTERNS = [
  "database-filtervalueeditor--date-calendar",
  "database-calendarview--",
];

function isDateDependent(safeName: string): boolean {
  return DATE_DEPENDENT_STORY_PATTERNS.some((pattern) =>
    safeName.startsWith(pattern),
  );
}

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

      // Wait for animations/transitions to settle
      await page.waitForLoadState("networkidle");

      const safeName = `${story.title}--${story.name}`
        .replace(/[^a-zA-Z0-9-]/g, "-")
        .toLowerCase();

      const threshold = isDateDependent(safeName)
        ? DATE_DEPENDENT_THRESHOLD
        : DEFAULT_THRESHOLD;

      await expect(page).toHaveScreenshot(`${safeName}.png`, {
        maxDiffPixelRatio: threshold,
        fullPage: true,
      });
    }
  });
});
