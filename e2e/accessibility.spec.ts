import { test as baseTest, expect as baseExpect } from "@playwright/test";
import { test as authTest, expect as authExpect } from "./fixtures/auth";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
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

// ---------------------------------------------------------------------------
// Database view accessibility tests
// ---------------------------------------------------------------------------

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Use the current month so calendar items appear on the default view
const NOW = new Date();
const YEAR = NOW.getFullYear();
const MONTH = NOW.getMonth();

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateInCurrentMonth(day: number): string {
  return `${YEAR}-${pad(MONTH + 1)}-${pad(day)}`;
}

const SELECT_OPTIONS = [
  { id: crypto.randomUUID(), name: "To Do", color: "blue" },
  { id: crypto.randomUUID(), name: "In Progress", color: "yellow" },
  { id: crypto.randomUUID(), name: "Done", color: "green" },
];

// Shared state across the three database accessibility tests
let dbWorkspaceSlug: string;
let dbPageId: string;
const dbRowPageIds: string[] = [];

authTest.beforeAll(async () => {
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
  if (!testUserId) {
    const { data: profileRows } = await admin
      .from("profiles")
      .select("id")
      .limit(50);
    if (profileRows) {
      for (const p of profileRows) {
        const { data: authUser } = await admin.auth.admin.getUserById(p.id);
        if (authUser?.user?.email === email) {
          testUserId = p.id;
          break;
        }
      }
    }
  }
  if (!testUserId) throw new Error(`Test user ${email} not found`);

  // Get workspace
  const { data: memberships } = await admin
    .from("members")
    .select("workspace_id, workspaces(id, slug, is_personal)")
    .eq("user_id", testUserId)
    .limit(10);

  if (!memberships || memberships.length === 0) {
    throw new Error("No workspace found for test user");
  }

  const ws = memberships[0].workspaces as unknown as {
    id: string;
    slug: string;
  };
  dbWorkspaceSlug = ws.slug;

  // Create a database page
  const { data: dbPage, error: dbErr } = await admin
    .from("pages")
    .insert({
      workspace_id: ws.id,
      title: "A11y Test DB",
      is_database: true,
      position: 9970,
      created_by: testUserId,
    })
    .select()
    .single();

  if (dbErr || !dbPage)
    throw new Error(`Failed to create database: ${dbErr?.message}`);
  dbPageId = dbPage.id;

  // Create a select property for board view grouping
  const { data: selectProp, error: spErr } = await admin
    .from("database_properties")
    .insert({
      database_id: dbPageId,
      name: "Status",
      type: "select",
      config: { options: SELECT_OPTIONS },
      position: 0,
    })
    .select()
    .single();

  if (spErr || !selectProp)
    throw new Error(`Failed to create select property: ${spErr?.message}`);

  // Create a date property for calendar view
  const { data: dateProp, error: dpErr } = await admin
    .from("database_properties")
    .insert({
      database_id: dbPageId,
      name: "Due Date",
      type: "date",
      config: {},
      position: 1,
    })
    .select()
    .single();

  if (dpErr || !dateProp)
    throw new Error(`Failed to create date property: ${dpErr?.message}`);

  // Create the default table view
  const { error: tvErr } = await admin
    .from("database_views")
    .insert({
      database_id: dbPageId,
      name: "Table view",
      type: "table",
      config: {},
      position: 0,
    })
    .select()
    .single();

  if (tvErr) throw new Error(`Failed to create table view: ${tvErr.message}`);

  // Create a board view grouped by Status
  const { error: bvErr } = await admin
    .from("database_views")
    .insert({
      database_id: dbPageId,
      name: "Board view",
      type: "board",
      config: { group_by: selectProp.id },
      position: 1,
    })
    .select()
    .single();

  if (bvErr)
    throw new Error(`Failed to create board view: ${bvErr.message}`);

  // Create a calendar view configured with the date property
  const { error: cvErr } = await admin
    .from("database_views")
    .insert({
      database_id: dbPageId,
      name: "Calendar view",
      type: "calendar",
      config: { date_property: dateProp.id },
      position: 2,
    })
    .select()
    .single();

  if (cvErr)
    throw new Error(`Failed to create calendar view: ${cvErr.message}`);

  // Create rows with select and date values
  const rowData = [
    { title: "Task A", optionId: SELECT_OPTIONS[0].id, day: 5 },
    { title: "Task B", optionId: SELECT_OPTIONS[1].id, day: 12 },
    { title: "Task C", optionId: SELECT_OPTIONS[2].id, day: 19 },
  ];

  for (const row of rowData) {
    const { data: rowPage, error: rowErr } = await admin
      .from("pages")
      .insert({
        workspace_id: ws.id,
        parent_id: dbPageId,
        title: row.title,
        is_database: false,
        position: dbRowPageIds.length,
        created_by: testUserId,
      })
      .select()
      .single();

    if (rowErr || !rowPage)
      throw new Error(`Failed to create row: ${rowErr?.message}`);
    dbRowPageIds.push(rowPage.id);

    // Set select value
    const { error: svErr } = await admin.from("row_values").insert({
      row_id: rowPage.id,
      property_id: selectProp.id,
      value: { option_id: row.optionId },
    });
    if (svErr)
      throw new Error(`Failed to set select value: ${svErr.message}`);

    // Set date value
    const { error: dvErr } = await admin.from("row_values").insert({
      row_id: rowPage.id,
      property_id: dateProp.id,
      value: { date: dateInCurrentMonth(row.day) },
    });
    if (dvErr)
      throw new Error(`Failed to set date value: ${dvErr.message}`);
  }
});

authTest.afterAll(async () => {
  const admin = getAdminClient();

  // Delete all rows
  const { data: allRows } = await admin
    .from("pages")
    .select("id")
    .eq("parent_id", dbPageId);
  if (allRows) {
    for (const row of allRows) {
      await admin.from("row_values").delete().eq("row_id", row.id);
    }
    for (const row of allRows) {
      await admin.from("pages").delete().eq("id", row.id);
    }
  }

  await admin
    .from("database_views")
    .delete()
    .eq("database_id", dbPageId);
  await admin
    .from("database_properties")
    .delete()
    .eq("database_id", dbPageId);
  await admin.from("pages").delete().eq("id", dbPageId);
});

authTest.describe("Accessibility: database table view", () => {
  authTest(
    "has no critical or serious axe violations",
    async ({ authenticatedPage: page }) => {
      authTest.slow();
      await page.goto(`/${dbWorkspaceSlug}/${dbPageId}`);

      // Wait for the table grid to render with data
      await authExpect(page.locator('[role="grid"]')).toBeVisible({
        timeout: 15_000,
      });
      await authExpect(
        page.locator('[role="row"]').first(),
      ).toBeVisible({ timeout: 10_000 });

      const results = await createAxeBuilder(page).analyze();
      const severe = filterSevereViolations(results.violations);

      authExpect(
        severe,
        `Found ${severe.length} accessibility violation(s):\n${formatViolations(severe)}`,
      ).toHaveLength(0);
    },
  );
});

authTest.describe("Accessibility: database board view", () => {
  authTest(
    "has no critical or serious axe violations",
    async ({ authenticatedPage: page }) => {
      authTest.slow();
      await page.goto(`/${dbWorkspaceSlug}/${dbPageId}`);

      // Wait for view tabs to load
      await authExpect(
        page.getByRole("button", { name: /Table view/i }),
      ).toBeVisible({ timeout: 15_000 });

      // Switch to board view
      const boardTab = page.getByRole("button", { name: /Board view/i });
      await boardTab.click();

      // Wait for board cards to render
      await authExpect(
        page.locator("a").filter({ hasText: "Task A" }),
      ).toBeVisible({ timeout: 15_000 });

      const results = await createAxeBuilder(page).analyze();
      const severe = filterSevereViolations(results.violations);

      authExpect(
        severe,
        `Found ${severe.length} accessibility violation(s):\n${formatViolations(severe)}`,
      ).toHaveLength(0);
    },
  );
});

authTest.describe("Accessibility: database calendar view", () => {
  authTest(
    "has no critical or serious axe violations",
    async ({ authenticatedPage: page }) => {
      authTest.slow();
      await page.goto(`/${dbWorkspaceSlug}/${dbPageId}`);

      // Wait for view tabs to load
      await authExpect(
        page.getByRole("button", { name: /Table view/i }),
      ).toBeVisible({ timeout: 15_000 });

      // Switch to calendar view
      const calendarTab = page.getByRole("button", {
        name: /Calendar view/i,
      });
      await calendarTab.click();

      // Wait for the calendar month header to render
      const FULL_MONTHS = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      await authExpect(
        page.locator("h2", {
          hasText: `${FULL_MONTHS[MONTH]} ${YEAR}`,
        }),
      ).toBeVisible({ timeout: 15_000 });

      const results = await createAxeBuilder(page).analyze();
      const severe = filterSevereViolations(results.violations);

      authExpect(
        severe,
        `Found ${severe.length} accessibility violation(s):\n${formatViolations(severe)}`,
      ).toHaveLength(0);
    },
  );
});
