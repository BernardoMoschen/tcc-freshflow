import { test, expect } from "@playwright/test";

async function loginAsChef(page: import("@playwright/test").Page) {
  // Simple login
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await page.evaluate(() => {
    localStorage.setItem("freshflow:dev-user-email", "chef@chefstable.com");
  });

  // Navigate to dashboard
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  console.log("✓ Logged in as chef");
}

test.describe("Order Flow", () => {
  test("chef can access catalog", async ({ page }) => {
    await loginAsChef(page);

    // Navigate to catalog
    console.log("Navigating to catalog...");
    await page.goto("/chef/catalog", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    // Verify page loaded by checking for heading
    const heading = await page.locator("h1, h2, [role='heading']").first().textContent();
    console.log(`Page heading: ${heading}`);

    expect(heading).toBeTruthy();
    console.log("✓ Chef can access catalog");
  });
});
