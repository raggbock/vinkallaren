import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "e2e-test@minvinkallare.se";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "e2e-test-password-123";

test.describe("Auth flow", () => {
  test("shows landing page with login form", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Logga in")).toBeVisible({ timeout: 30000 });
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("E-post").fill("invalid@example.com");
    await page.getByPlaceholder("Lösenord").fill("wrongpassword");
    await page.getByText("Logga in").click();
    await expect(page.getByText(/fel|ogilt|invalid/i)).toBeVisible({ timeout: 10000 });
  });

  test("login and logout with valid credentials", async ({ page }) => {
    test.skip(!process.env.E2E_TEST_EMAIL, "Skipping — no test credentials set");
    await page.goto("/");
    await page.getByPlaceholder("E-post").fill(TEST_EMAIL);
    await page.getByPlaceholder("Lösenord").fill(TEST_PASSWORD);
    await page.getByText("Logga in").click();
    await expect(page.getByText("Min källare")).toBeVisible({ timeout: 15000 });
    await page.getByText("Profil").click();
    await page.getByText("Logga ut").click();
    await expect(page.getByText("Logga in")).toBeVisible({ timeout: 10000 });
  });
});
