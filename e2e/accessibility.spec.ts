import { test as baseTest, expect as baseExpect } from "@playwright/test";
import { test as authTest, expect as authExpect } from "./fixtures/auth";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/** Subset of axe-core Result used for filtering and formatting. */
interface AxeViolation {
  id: string;
  impact?: string | null;
  description: string;
  helpUrl: string;
  nodes: { html: string }[];
}

/**
 * Filter axe results to only critical and serious violations.
 */
function filterSevereViolations(violations: AxeViolation[]): AxeViolation[] {
  return violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
}

/**
 * Format violations into a readable string for assertion messages.
 */
function formatViolations(violations: AxeViolation[]): string {
  return violations
    .map(
      (v) =>
        `[${v.impact}] ${v.id}: ${v.description}\n  Help: ${v.helpUrl}\n  Elements: ${v.nodes.map((n) => n.html).join(", ")}`,
    )
    .join("\n\n");
}

/**
 * Known pre-existing violations excluded from the audit.
 * Each exclusion is documented with the reason and a tracking issue.
 * Empty — all known violations have been resolved.
 */
const KNOWN_VIOLATION_RULES: string[] = [];

/**
 * Create an AxeBuilder with known pre-existing violations excluded.
 */
function createAxeBuilder(page: Page): AxeBuilder {
  return new AxeBuilder({ page }).disableRules(KNOWN_VIOLATION_RULES);
}

function extractWorkspaceSlug(url: string): string {
  const segments = new URL(url).pathname.split("/").filter(Boolean);
  const slug = segments[0];
  if (!slug) {
    throw new Error(`Could not extract workspace slug from URL: ${url}`);
  }
  return slug;
}

// --- Unauthenticated pages ---

baseTest.describe("Accessibility: sign-in page", () => {
  baseTest("has no critical or serious axe violations", async ({ page }) => {
    // Axe analysis can be slow — triple the default timeout.
    baseTest.slow();
    await page.goto("/sign-in");
    await page.locator('input[type="email"]').waitFor({ state: "visible" });

    const results = await createAxeBuilder(page).analyze();
    const severe = filterSevereViolations(results.violations);

    baseExpect(
      severe,
      `Found ${severe.length} accessibility violation(s):\n${formatViolations(severe)}`,
    ).toHaveLength(0);
  });
});

// --- Authenticated pages ---

authTest.describe("Accessibility: workspace home", () => {
  authTest(
    "has no critical or serious axe violations",
    async ({ authenticatedPage: page }) => {
      authTest.slow();
      // authenticatedPage lands on the workspace home after login.
      // Wait for the sidebar page tree to indicate the app has loaded.
      const sidebar = page.getByRole("complementary");
      try {
        await sidebar
          .locator('[role="treeitem"]')
          .first()
          .waitFor({ state: "visible", timeout: 10_000 });
      } catch {
        // Empty workspace — no tree items, but the page is loaded
      }

      const results = await createAxeBuilder(page).analyze();
      const severe = filterSevereViolations(results.violations);

      authExpect(
        severe,
        `Found ${severe.length} accessibility violation(s):\n${formatViolations(severe)}`,
      ).toHaveLength(0);
    },
  );
});

authTest.describe("Accessibility: page editor", () => {
  authTest(
    "has no critical or serious axe violations",
    async ({ authenticatedPage: page }) => {
      authTest.slow();

      // Create a fresh page via the sidebar button to guarantee an editor page
      const sidebar = page.getByRole("complementary");
      try {
        await sidebar
          .locator('[role="treeitem"]')
          .first()
          .waitFor({ state: "visible", timeout: 15_000 });
      } catch {
        // Empty workspace — that's fine, we'll create a page
      }

      const newPageBtn = sidebar.getByRole("button", { name: /new page/i });
      await newPageBtn.waitFor({ state: "visible", timeout: 10_000 });
      await newPageBtn.click();

      // Wait for navigation to the new page
      await page.waitForURL(
        (url) => url.pathname.split("/").filter(Boolean).length >= 2,
        { timeout: 15_000 },
      );
      await page
        .locator('[contenteditable="true"]')
        .waitFor({ state: "visible", timeout: 15_000 });

      const results = await createAxeBuilder(page).analyze();
      const severe = filterSevereViolations(results.violations);

      authExpect(
        severe,
        `Found ${severe.length} accessibility violation(s):\n${formatViolations(severe)}`,
      ).toHaveLength(0);
    },
  );
});

authTest.describe("Accessibility: workspace settings", () => {
  authTest(
    "has no critical or serious axe violations",
    async ({ authenticatedPage: page }) => {
      authTest.slow();
      const slug = extractWorkspaceSlug(page.url());
      await page.goto(`/${slug}/settings`);
      await page
        .getByRole("heading", { name: "Workspace settings" })
        .waitFor({ state: "visible", timeout: 10_000 });

      const results = await createAxeBuilder(page).analyze();
      const severe = filterSevereViolations(results.violations);

      authExpect(
        severe,
        `Found ${severe.length} accessibility violation(s):\n${formatViolations(severe)}`,
      ).toHaveLength(0);
    },
  );
});

authTest.describe("Accessibility: members page", () => {
  authTest(
    "has no critical or serious axe violations",
    async ({ authenticatedPage: page }) => {
      authTest.slow();
      const slug = extractWorkspaceSlug(page.url());
      await page.goto(`/${slug}/settings/members`);
      await page
        .getByRole("heading", { name: /members/i })
        .waitFor({ state: "visible", timeout: 10_000 });

      const results = await createAxeBuilder(page).analyze();
      const severe = filterSevereViolations(results.violations);

      authExpect(
        severe,
        `Found ${severe.length} accessibility violation(s):\n${formatViolations(severe)}`,
      ).toHaveLength(0);
    },
  );
});
