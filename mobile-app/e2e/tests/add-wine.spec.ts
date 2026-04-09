import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "";

test.describe("Add wine flow", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!TEST_EMAIL, "Skipping — no test credentials set");
    await page.goto("/");
    await page.getByPlaceholder("namn@exempel.se").fill(TEST_EMAIL);
    await page.getByLabel("Lösenord").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Logga in" }).click();
    await expect(page.getByText("Min källare")).toBeVisible({ timeout: 15000 });
  });

  test("add a wine and see it in cellar", async ({ page }) => {
    const wineName = `E2E Test Wine ${Date.now()}`;
    await page.getByText("Lägg till").click();
    await page.getByLabel("Namn").fill(wineName);
    await page.getByLabel("Producent").fill("E2E Producer");
    await page.getByRole("button", { name: "Spara i källaren" }).click();
    await page.getByText("Min källare").click();
    await expect(page.getByText(wineName)).toBeVisible({ timeout: 10000 });
  });
});
