import { test, expect, type Page } from "@playwright/test";

// ─── Seeded test users (from prisma/seed.ts) ─────────────────────────────────
// These emails must match users created by the seed script.

const USERS = {
  platformAdmin: "admin@freshflow.com",          // PLATFORM_ADMIN – global access
  tenantOwner:   "carlos@verdecampo.com.br",     // TENANT_OWNER   – Verde Campo
  tenantAdmin:   "ana@verdecampo.com.br",        // TENANT_ADMIN   – Verde Campo
  accountOwner:  "roberto@sabordaterra.com.br",  // ACCOUNT_OWNER  – Sabor da Terra
  accountBuyer:  "juliana@sabordaterra.com.br",  // ACCOUNT_BUYER  – Sabor da Terra
} as const;

// A UUID in the correct format but not matching any seeded order
const NONEXISTENT_ORDER_ID = "00000000-0000-0000-0000-000000000999";

// Fix #4 – avoid hardcoding the backend port; override via API_BASE_URL env var if needed
const BACKEND_URL = process.env.API_BASE_URL ?? "http://localhost:3001";

// ─── Auth helper ──────────────────────────────────────────────────────────────
// Sets the dev-mode email before the first navigation so the auth hook picks it
// up on page load. Works because addInitScript runs before every goto().

async function loginAs(page: Page, email: string): Promise<void> {
  // Pass email as a serialised string so TypeScript doesn't type-check
  // browser globals (localStorage) — the content runs in the page context.
  await page.addInitScript(`localStorage.setItem("freshflow:dev-user-email", ${JSON.stringify(email)})`);
  // Fix #1 – waitForLoadState("networkidle") replaces the redundant
  // waitForFunction + waitForTimeout double-wait.
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  // Fix #2 – verify login actually succeeded so that a missing seed user
  // fails here rather than silently letting every subsequent assertion pass
  // for the wrong reason.
  await expect(
    page,
    `loginAs(${email}): auth failed – app redirected to /login. Check that the seed ran successfully.`
  ).not.toHaveURL(/\/login/, { timeout: 10000 });
}

// ─── ACCOUNT_OWNER – Buyer portal ────────────────────────────────────────────

test.describe("ACCOUNT_OWNER – Buyer portal", () => {
  test("can view product catalog", async ({ page }) => {
    await loginAs(page, USERS.accountOwner);
    await page.goto("/chef/catalog");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
    await expect(page.locator("h1, h2, [role='heading']").first()).toBeVisible({ timeout: 8000 });
  });

  test("can access cart (draft order)", async ({ page }) => {
    await loginAs(page, USERS.accountOwner);
    await page.goto("/chef/cart");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
    await expect(page.locator("body")).toBeVisible();
  });

  test("can view order history", async ({ page }) => {
    await loginAs(page, USERS.accountOwner);
    await page.goto("/chef/orders");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
    await expect(page.locator("h1, h2, [role='heading']").first()).toBeVisible({ timeout: 8000 });
  });

  test("is redirected away from admin order management", async ({ page }) => {
    await loginAs(page, USERS.accountOwner);
    await page.goto("/admin/orders");
    // ProtectedRoute(requireTenantAdmin) redirects account users to /chef/catalog
    await expect(page).not.toHaveURL(/\/admin\/orders/, { timeout: 8000 });
  });

  test("is redirected away from weighing page", async ({ page }) => {
    await loginAs(page, USERS.accountOwner);
    await page.goto(`/admin/weighing/${NONEXISTENT_ORDER_ID}`);
    await expect(page).not.toHaveURL(/\/admin\/weighing/, { timeout: 8000 });
  });

  test("is redirected away from finalization page", async ({ page }) => {
    await loginAs(page, USERS.accountOwner);
    await page.goto(`/admin/finalize/${NONEXISTENT_ORDER_ID}`);
    await expect(page).not.toHaveURL(/\/admin\/finalize/, { timeout: 8000 });
  });
});

// ─── ACCOUNT_BUYER – Restricted buyer ────────────────────────────────────────

test.describe("ACCOUNT_BUYER – Restricted buyer", () => {
  test("can access product catalog", async ({ page }) => {
    await loginAs(page, USERS.accountBuyer);
    await page.goto("/chef/catalog");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
    await expect(page.locator("body")).toBeVisible();
  });

  test("can view order history", async ({ page }) => {
    await loginAs(page, USERS.accountBuyer);
    await page.goto("/chef/orders");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
  });

  test("is redirected away from admin panel", async ({ page }) => {
    await loginAs(page, USERS.accountBuyer);
    await page.goto(`/admin/weighing/${NONEXISTENT_ORDER_ID}`);
    await expect(page).not.toHaveURL(/\/admin\/weighing/, { timeout: 8000 });
  });
});

// ─── TENANT_ADMIN – Warehouse operations ─────────────────────────────────────

test.describe("TENANT_ADMIN – Warehouse operations", () => {
  test("can access order management", async ({ page }) => {
    await loginAs(page, USERS.tenantAdmin);
    await page.goto("/admin/orders");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
    await expect(page.locator("h1, h2, [role='heading']").first()).toBeVisible({ timeout: 8000 });
  });

  test("can access weighing page", async ({ page }) => {
    await loginAs(page, USERS.tenantAdmin);
    await page.goto(`/admin/weighing/${NONEXISTENT_ORDER_ID}`);
    // ProtectedRoute allows TENANT_ADMIN through — page renders even if order not found
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
    await expect(page.locator("body")).toBeVisible();
  });

  test("can access finalization page", async ({ page }) => {
    await loginAs(page, USERS.tenantAdmin);
    await page.goto(`/admin/finalize/${NONEXISTENT_ORDER_ID}`);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
    await expect(page.locator("body")).toBeVisible();
  });

  test("can access stock management", async ({ page }) => {
    await loginAs(page, USERS.tenantAdmin);
    await page.goto("/admin/stock");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
    await expect(page.locator("h1, h2, [role='heading']").first()).toBeVisible({ timeout: 8000 });
  });

  test("is redirected away from buyer cart", async ({ page }) => {
    await loginAs(page, USERS.tenantAdmin);
    await page.goto("/chef/cart");
    // ProtectedRoute(requireAccountUser) redirects tenant admins to /admin/orders
    await expect(page).not.toHaveURL(/\/chef\/cart/, { timeout: 8000 });
  });

  test("page remains stable after connectivity change", async ({ page, context }) => {
    await loginAs(page, USERS.tenantAdmin);
    await page.goto("/admin/orders");
    await page.waitForLoadState("networkidle");

    await context.setOffline(true);
    await context.setOffline(false);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5000 });
  });
});

// ─── TENANT_OWNER – Full tenant management ────────────────────────────────────

test.describe("TENANT_OWNER – Full tenant management", () => {
  test("can access analytics dashboard", async ({ page }) => {
    await loginAs(page, USERS.tenantOwner);
    await page.goto("/admin/analytics");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
    await expect(page.locator("h1, h2, [role='heading']").first()).toBeVisible({ timeout: 8000 });
  });

  test("can access product management", async ({ page }) => {
    await loginAs(page, USERS.tenantOwner);
    await page.goto("/admin/products");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
    await expect(page.locator("h1, h2, [role='heading']").first()).toBeVisible({ timeout: 8000 });
  });

  test("can access customer management", async ({ page }) => {
    await loginAs(page, USERS.tenantOwner);
    await page.goto("/admin/customers");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
    await expect(page.locator("h1, h2, [role='heading']").first()).toBeVisible({ timeout: 8000 });
  });

  test("can access tenant settings", async ({ page }) => {
    await loginAs(page, USERS.tenantOwner);
    await page.goto("/admin/settings");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
    await expect(page.locator("body")).toBeVisible();
  });

  test("is redirected away from buyer cart", async ({ page }) => {
    await loginAs(page, USERS.tenantOwner);
    await page.goto("/chef/cart");
    await expect(page).not.toHaveURL(/\/chef\/cart/, { timeout: 8000 });
  });
});

// ─── PLATFORM_ADMIN – Global access ──────────────────────────────────────────

test.describe("PLATFORM_ADMIN – Global platform access", () => {
  test("can access all management pages", async ({ page }) => {
    await loginAs(page, USERS.platformAdmin);

    const adminRoutes = [
      "/admin/orders",
      "/admin/products",
      "/admin/customers",
      "/admin/analytics",
      "/admin/stock",
      "/admin/settings",
    ];

    // Fix #3 – include the failing route in the assertion message so CI logs
    // immediately show which page blocked the admin instead of a generic failure.
    for (const route of adminRoutes) {
      await page.goto(route);
      await expect(
        page,
        `PLATFORM_ADMIN should not be redirected to /login on route: ${route}`
      ).not.toHaveURL(/\/login/, { timeout: 8000 });
    }
  });
});

// ─── PDF delivery note endpoint ───────────────────────────────────────────────

test.describe("PDF delivery note endpoint", () => {
  // Fix #4 – backend URL comes from env so it works in any environment
  test("returns 401 without authorization header", async ({ request }) => {
    const response = await request.get(
      `${BACKEND_URL}/api/v1/delivery-note/${NONEXISTENT_ORDER_ID}.pdf`
    );
    expect(response.status()).toBe(401);
  });
});

// ─── Public catalog – no auth required ───────────────────────────────────────

test.describe("Public catalog – unauthenticated", () => {
  test("is accessible without login", async ({ page }) => {
    await page.goto("/catalog/verde-campo");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
    await expect(page.locator("body")).toBeVisible();
  });
});

// ─── Interaction: buyer adds product and submits order ────────────────────────
// Uses seeded data: roberto (ACCOUNT_OWNER, Sabor da Terra / Verde Campo tenant)
// PED-001 is seeded as a DRAFT with banana, orange, batata, cenoura already added.
// Products not in PED-001 will still show "Adicionar" buttons in the catalog.

test.describe("Buyer interaction – catalog to order submission", () => {
  test("ACCOUNT_OWNER adds an available product to cart from catalog", async ({ page }) => {
    await loginAs(page, USERS.accountOwner);
    await page.goto("/chef/catalog");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });

    // Wait for at least one "Adicionar" button to appear (products not yet in cart)
    const addButton = page.getByRole("button", { name: /^adicionar$/i }).first();
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    // After clicking, the button briefly shows "Adicionado!" then becomes a qty picker.
    // Either state confirms the item was added to the cart.
    const addedFeedback = page
      .getByText(/adicionado/i)
      .or(page.locator('[aria-label*="Diminuir"]'))
      .or(page.getByText(/no carrinho/i))
      .first();
    await expect(addedFeedback).toBeVisible({ timeout: 5000 });
  });

  test("ACCOUNT_OWNER submits seeded draft order (PED-001) from cart", async ({ page }) => {
    await loginAs(page, USERS.accountOwner);
    await page.goto("/chef/cart");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });

    // PED-001 was seeded as DRAFT with items — the submit button should be visible
    const submitButton = page.getByRole("button", { name: /enviar pedido/i });
    await expect(submitButton).toBeVisible({ timeout: 10000 });

    // Wait for the quick-date shortcut buttons to appear (rendered after delivery settings load).
    // Use the SECOND option (2 days ahead) rather than "Amanhã" (tomorrow): date strings like
    // "2026-04-01" are parsed as UTC midnight, which in UTC-3 is only 21 h ahead of local
    // midnight — Math.floor(21/24) = 0, failing the minDaysAhead = 1 check.
    const dateShortcuts = page.getByRole("group", { name: /atalhos de data/i }).getByRole("button");
    await expect(dateShortcuts.first()).toBeVisible({ timeout: 10000 });
    await dateShortcuts.nth(1).click();

    await submitButton.click();

    // Successful submission navigates away from the cart page
    await expect(page).not.toHaveURL(/\/chef\/cart/, { timeout: 10000 });
  });
});

// ─── Interaction: admin weighing flow ────────────────────────────────────────
// Uses seeded data: ana (TENANT_ADMIN, Verde Campo)
// PED-003 is seeded as IN_SEPARATION — the correct status for weighing.

test.describe("Admin interaction – weighing flow", () => {
  test("TENANT_ADMIN navigates from orders list to weighing page for PED-003", async ({ page }) => {
    await loginAs(page, USERS.tenantAdmin);
    await page.goto("/admin/orders");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });

    // Wait for the orders list to load. The page uses cards, not a table.
    // PED-003 is the only IN_SEPARATION order, so "Pesar" appears exactly once.
    const pesarLink = page.getByRole("link", { name: /pesar/i }).first();
    await expect(pesarLink).toBeVisible({ timeout: 10000 });
    await pesarLink.click();

    // Should land on the weighing page for this specific order
    await expect(page).toHaveURL(/\/admin\/weighing\//, { timeout: 8000 });
    await expect(
      page.getByRole("heading", { name: /estação de pesagem/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("TENANT_ADMIN records a weight for a WEIGHT item in PED-003", async ({ page }) => {
    await loginAs(page, USERS.tenantAdmin);
    await page.goto("/admin/orders");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });

    // Navigate to weighing page via the "Pesar" link (PED-003 is the only IN_SEPARATION order)
    const pesarLink = page.getByRole("link", { name: /pesar/i }).first();
    await expect(pesarLink).toBeVisible({ timeout: 10000 });
    await pesarLink.click();
    await expect(page).toHaveURL(/\/admin\/weighing\//, { timeout: 8000 });

    // Find the weight input for the first WEIGHT item and fill it.
    // Inputs are identified by id="weight-{itemId}" and inputMode="decimal".
    const weightInput = page.locator('input[id^="weight-"]').first();
    await expect(weightInput).toBeVisible({ timeout: 8000 });
    await weightInput.fill("2.5");

    // Save the weight
    await page.getByRole("button", { name: /salvar peso/i }).first().click();

    // On success the input is cleared (weight resets to 0, which renders as "")
    await expect(weightInput).not.toHaveValue("2.5", { timeout: 8000 });
  });
});
