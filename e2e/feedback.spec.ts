import { test, expect } from "./fixtures/auth";

test.describe("Feedback form", () => {
  /**
   * Helper: open the feedback sheet from the sidebar.
   * Waits for the sidebar to be visible, clicks the "Feedback" button,
   * and waits for the sheet to animate in.
   */
  async function openFeedbackSheet(page: import("@playwright/test").Page) {
    const sidebar = page.locator("aside, [data-sidebar]").first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    const feedbackButton = sidebar.getByRole("button", { name: "Feedback" });
    await expect(feedbackButton).toBeVisible({ timeout: 5_000 });
    await feedbackButton.click();

    // Wait for the sheet to appear — it has the title "Send feedback"
    const sheetTitle = page.getByRole("heading", { name: "Send feedback" });
    await expect(sheetTitle).toBeVisible({ timeout: 5_000 });
  }

  test("open the feedback sheet from the sidebar", async ({
    authenticatedPage: page,
  }) => {
    const sheetTitle = page.getByRole("heading", { name: "Send feedback" });
    await expect(sheetTitle).not.toBeVisible();

    await openFeedbackSheet(page);

    // Verify the sheet content is visible
    await expect(
      page.getByText("Help us improve Memo"),
    ).toBeVisible({ timeout: 3_000 });
    await expect(page.locator("#feedback-message")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Submit feedback" }),
    ).toBeVisible();
  });

  test("select each feedback type", async ({ authenticatedPage: page }) => {
    await openFeedbackSheet(page);

    // "General" should be selected by default (aria-pressed="true")
    const generalBtn = page.getByRole("button", { name: "General", exact: true });
    const bugBtn = page.getByRole("button", { name: "Bug", exact: true });
    const featureBtn = page.getByRole("button", { name: "Feature", exact: true });

    await expect(generalBtn).toHaveAttribute("aria-pressed", "true");
    await expect(bugBtn).toHaveAttribute("aria-pressed", "false");
    await expect(featureBtn).toHaveAttribute("aria-pressed", "false");

    // Select "Bug"
    await bugBtn.click();
    await expect(bugBtn).toHaveAttribute("aria-pressed", "true");
    await expect(generalBtn).toHaveAttribute("aria-pressed", "false");
    await expect(featureBtn).toHaveAttribute("aria-pressed", "false");

    // Select "Feature"
    await featureBtn.click();
    await expect(featureBtn).toHaveAttribute("aria-pressed", "true");
    await expect(bugBtn).toHaveAttribute("aria-pressed", "false");
    await expect(generalBtn).toHaveAttribute("aria-pressed", "false");

    // Select "General" again
    await generalBtn.click();
    await expect(generalBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("type a message and verify character count", async ({
    authenticatedPage: page,
  }) => {
    await openFeedbackSheet(page);

    const textarea = page.locator("#feedback-message");
    const charCount = page.locator("#feedback-char-count");

    // Initially 0/500
    await expect(charCount).toHaveText("0/500");

    // Type a message
    await textarea.fill("This is test feedback");
    await expect(charCount).toHaveText("21/500");

    // Type a longer message and verify count updates
    const longMessage = "A".repeat(450);
    await textarea.fill(longMessage);
    await expect(charCount).toHaveText("450/500");
  });

  test("submit the form and verify success toast", async ({
    authenticatedPage: page,
  }) => {
    // Intercept the feedback API to return a mock success response
    await page.route("**/api/feedback", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });

    await openFeedbackSheet(page);

    // Select "Bug" type
    await page.getByRole("button", { name: "Bug", exact: true }).click();

    // Type a message
    const textarea = page.locator("#feedback-message");
    await textarea.fill("Found a bug in the editor");

    // Submit
    await page.getByRole("button", { name: "Submit feedback" }).click();

    // Verify success toast appears
    const successToast = page.locator("[data-sonner-toast]", {
      hasText: "Feedback submitted",
    });
    await expect(successToast).toBeVisible({ timeout: 10_000 });
  });

  test("form resets after submission", async ({
    authenticatedPage: page,
  }) => {
    // Intercept the feedback API
    await page.route("**/api/feedback", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });

    await openFeedbackSheet(page);

    // Select "Feature" type and type a message
    await page.getByRole("button", { name: "Feature", exact: true }).click();
    const textarea = page.locator("#feedback-message");
    await textarea.fill("Please add dark mode");

    // Submit
    await page.getByRole("button", { name: "Submit feedback" }).click();

    // Wait for success toast
    const successToast = page.locator("[data-sonner-toast]", {
      hasText: "Feedback submitted",
    });
    await expect(successToast).toBeVisible({ timeout: 10_000 });

    // The sheet closes after submission — re-open it to verify reset
    await openFeedbackSheet(page);

    // Type should be reset to "General"
    await expect(
      page.getByRole("button", { name: "General", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    // Message should be empty
    await expect(page.locator("#feedback-message")).toHaveValue("");

    // Character count should be 0/500
    await expect(page.locator("#feedback-char-count")).toHaveText("0/500");
  });

  test("empty message cannot be submitted", async ({
    authenticatedPage: page,
  }) => {
    await openFeedbackSheet(page);

    const submitButton = page.getByRole("button", { name: "Submit feedback" });

    // Submit button should be disabled when message is empty
    await expect(submitButton).toBeDisabled();

    // Type whitespace only — should still be disabled
    const textarea = page.locator("#feedback-message");
    await textarea.fill("   ");
    await expect(submitButton).toBeDisabled();

    // Type a real message — should become enabled
    await textarea.fill("Valid feedback message");
    await expect(submitButton).toBeEnabled();

    // Clear the message — should be disabled again
    await textarea.fill("");
    await expect(submitButton).toBeDisabled();
  });
});
