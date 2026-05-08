import { test, expect } from "./fixtures/auth";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function resolveTestUserId(): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("email", process.env.TEST_USER_EMAIL!)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      `Test user ${process.env.TEST_USER_EMAIL} not found: ${error?.message ?? "no match"}`,
    );
  }
  return data.id;
}

async function getProfileDisplayName(userId: string): Promise<string> {
  const admin = getAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();
  return data?.display_name ?? "";
}

test.describe("Account settings page", () => {
  test.describe.configure({ mode: "serial" });

  let userId: string;
  let originalDisplayName: string;

  test.beforeAll(async () => {
    userId = await resolveTestUserId();
    originalDisplayName = await getProfileDisplayName(userId);
  });

  test.afterAll(async () => {
    // Restore the original display name after tests
    const admin = getAdminClient();
    await admin
      .from("profiles")
      .update({ display_name: originalDisplayName })
      .eq("id", userId);
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: { display_name: originalDisplayName },
    });
  });

  test("navigate to account page via user menu", async ({
    authenticatedPage: page,
  }) => {
    // Open the user menu in the sidebar
    const sidebar = page.locator("aside, [data-sidebar]").first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // The user menu trigger contains the display name
    const userMenuTrigger = sidebar.locator("button").filter({
      has: page.locator('svg.lucide-user'),
    });
    await userMenuTrigger.click();

    // Click the "Account" menu item
    const accountItem = page.getByRole("menuitem", { name: "Account" });
    await expect(accountItem).toBeVisible({ timeout: 3_000 });
    await accountItem.click();

    // Should navigate to /account
    await page.waitForURL("**/account", { timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: "Account settings" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("account page shows current display name and email", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/account");
    await expect(
      page.getByRole("heading", { name: "Account settings" }),
    ).toBeVisible({ timeout: 10_000 });

    // Display name input should have the current name
    const nameInput = page.getByTestId("account-display-name-input");
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    const nameValue = await nameInput.inputValue();
    expect(nameValue.length).toBeGreaterThan(0);

    // Email input should be disabled
    const emailInput = page.locator("#account-email");
    await expect(emailInput).toBeDisabled();
  });

  test("update display name and verify it persists", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/account");
    await expect(
      page.getByRole("heading", { name: "Account settings" }),
    ).toBeVisible({ timeout: 10_000 });

    const nameInput = page.getByTestId("account-display-name-input");
    await expect(nameInput).toBeVisible({ timeout: 5_000 });

    // Change the display name
    const newName = `E2E Test ${Date.now()}`;
    await nameInput.clear();
    await nameInput.fill(newName);

    // Save
    const saveButton = page.getByTestId("account-save-button");
    await saveButton.click();

    // Wait for success message
    await expect(page.getByText("Settings saved.")).toBeVisible({
      timeout: 10_000,
    });

    // Reload and verify the name persisted
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Account settings" }),
    ).toBeVisible({ timeout: 10_000 });

    const updatedInput = page.getByTestId("account-display-name-input");
    await expect(updatedInput).toHaveValue(newName, { timeout: 5_000 });

    // Verify the sidebar user menu also shows the updated name
    const sidebar = page.locator("aside, [data-sidebar]").first();
    await expect(sidebar).toBeVisible({ timeout: 5_000 });
    await expect(sidebar.getByText(newName)).toBeVisible({ timeout: 10_000 });
  });

  test("empty display name shows validation error", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/account");
    await expect(
      page.getByRole("heading", { name: "Account settings" }),
    ).toBeVisible({ timeout: 10_000 });

    const nameInput = page.getByTestId("account-display-name-input");
    await expect(nameInput).toBeVisible({ timeout: 5_000 });

    // Clear the name and fill with spaces only, then save.
    // The HTML required attribute blocks empty submits, but whitespace-only
    // passes native validation and triggers our custom check.
    await nameInput.clear();
    await nameInput.fill("   ");
    const saveButton = page.getByTestId("account-save-button");
    await saveButton.click();

    // Should show validation error
    await expect(
      page.getByText("Display name is required."),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("account page shows change password and delete account sections", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/account");
    await expect(
      page.getByRole("heading", { name: "Account settings" }),
    ).toBeVisible({ timeout: 10_000 });

    // Change password section
    await expect(page.getByText("Change password")).toBeVisible({
      timeout: 5_000,
    });

    // Danger zone / delete account section
    await expect(page.getByText("Danger zone")).toBeVisible({
      timeout: 5_000,
    });
    await expect(
      page.getByRole("button", { name: "Delete account", exact: true }),
    ).toBeVisible();
  });
});
