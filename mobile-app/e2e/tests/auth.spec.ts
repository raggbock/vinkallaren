import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "";

test.describe("Auth flow", () => {
  test("shows landing page with login form", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Logga in", { exact: true }).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByPlaceholder("namn@exempel.se")).toBeVisible();
  });

  test("login with valid credentials", async ({ page }) => {
    test.skip(!TEST_EMAIL, "Skipping — no E2E_TEST_EMAIL set");
    await page.goto("/");
    await page.getByPlaceholder("namn@exempel.se").fill(TEST_EMAIL);
    const inputs = page.locator("input");
    await inputs.nth(1).fill(TEST_PASSWORD);
    await page.getByText("Logga in", { exact: true }).first().click();
    await expect(page.getByText("Min källare")).toBeVisible({ timeout: 15000 });
  });
});
