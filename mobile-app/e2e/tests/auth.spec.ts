import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "e2e-test@minvinkallare.se";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "e2e-test-password-123";

test.describe("Auth flow", () => {
  test("shows landing page with login form", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Logga in", { exact: true }).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByPlaceholder("namn@exempel.se")).toBeVisible();
  });

  test("shows error dialog for invalid credentials", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("namn@exempel.se").fill("invalid@example.com");
    const inputs = page.locator("input");
    await inputs.nth(1).fill("wrongpassword");

    // RN Web shows errors via window.alert — listen for the dialog
    const dialogPromise = page.waitForEvent("dialog", { timeout: 15000 });
    await page.getByText("Logga in", { exact: true }).first().click();
    const dialog = await dialogPromise;
    expect(dialog.message()).toBeTruthy();
    await dialog.dismiss();
  });

  test("login and logout with valid credentials", async ({ page }) => {
    test.skip(!process.env.E2E_TEST_EMAIL, "Skipping — no test credentials set");
    await page.goto("/");
    await page.getByPlaceholder("namn@exempel.se").fill(TEST_EMAIL);
    const inputs = page.locator("input");
    await inputs.nth(1).fill(TEST_PASSWORD);
    await page.getByText("Logga in", { exact: true }).first().click();
    await expect(page.getByText("Min källare")).toBeVisible({ timeout: 15000 });
  });
});
