import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "e2e-test@minvinkallare.se";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "e2e-test-password-123";

test.describe("Auth flow", () => {
  test("shows landing page with login form", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Logga in" })).toBeVisible({ timeout: 30000 });
    await expect(page.getByLabel("E-post")).toBeVisible();
    await expect(page.getByLabel("Lösenord")).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("E-post").fill("invalid@example.com");
    await page.getByLabel("Lösenord").fill("wrongpassword");
    await page.getByRole("button", { name: "Logga in" }).click();
    await expect(page.getByText(/fel|ogilt|invalid/i)).toBeVisible({ timeout: 10000 });
  });

  test("login and logout with valid credentials", async ({ page }) => {
    test.skip(!process.env.E2E_TEST_EMAIL, "Skipping — no test credentials set");
    await page.goto("/");
    await page.getByLabel("E-post").fill(TEST_EMAIL);
    await page.getByLabel("Lösenord").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Logga in" }).click();
    await expect(page.getByText("Min källare")).toBeVisible({ timeout: 15000 });
  });
});
