import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "";

test.describe("Add wine flow", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!TEST_EMAIL, "Skipping — no test credentials set");
    await page.goto("/");
    await page.getByPlaceholder("namn@exempel.se").fill(TEST_EMAIL);
    const passwordInput = page.locator('input[type="password"], input').nth(1);
    await passwordInput.fill(TEST_PASSWORD);
    await page.getByText("Logga in", { exact: true }).first().click();
    await expect(page.getByText("Min källare")).toBeVisible({ timeout: 15000 });
  });

  test("add a wine and see it in cellar", async ({ page }) => {
    const wineName = `E2E Test Wine ${Date.now()}`;
    await page.getByText("Lägg till").click();
    await expect(page.getByText("Om vinet")).toBeVisible({ timeout: 5000 });
    await page.getByText("Namn").locator("..").locator("input").fill(wineName);
    await page.getByText("Producent").locator("..").locator("input").fill("E2E Producer");
    await page.getByText("Spara i källaren").click();
    await page.getByText("Min källare").click();
    await expect(page.getByText(wineName)).toBeVisible({ timeout: 10000 });
  });
});
