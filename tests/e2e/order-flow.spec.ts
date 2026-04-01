import { test, expect, type Page } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// CI runners start cold — the first tRPC session query can take 8-12 s.
// Use a longer timeout in CI so ProtectedRoute has time to resolve roles
// before we assert on redirects or page content.
const TIMEOUT = process.env.CI ? 15000 : 8000;

// ─── Auth helper ──────────────────────────────────────────────────────────────
// Sets the dev-mode email before the first navigation so the auth hook picks it
// up on page load. Works because addInitScript runs before every goto().

async function loginAs(page: Page, email: string): Promise<void> {
  // Set dev-mode email before first navigation — addInitScript runs before every goto().
  await page.addInitScript(`localStorage.setItem("freshflow:dev-user-email", ${JSON.stringify(email)})`);
  await page.goto("/dashboard");

  // Wait for the auth + session query to fully settle, including any
  // window.location.reload() triggered by the useAuth hook when it sets
  // tenantId/accountId from the user's memberships on first load.
  // The ProtectedRoute spinner (.animate-spin) is visible while loading and
  // disappears once the session resolves, so this is more reliable than
  // waitForLoadState("networkidle") alone (which can return before the reload).
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".animate-spin").first()).not.toBeVisible({ timeout: 20000 });
  await page.waitForLoadState("networkidle");

  await expect(
    page,
    `loginAs(${email}): auth failed – app redirected to /login. Check that the seed ran successfully.`
  ).not.toHaveURL(/\/login/, { timeout: 10000 });

  // After auth has settled, read the tenant/account context that was set by
  // useAuth from the session memberships and inject it for ALL subsequent
  // page.goto() calls. This prevents the reload cycle on each navigation
  // (useAuth won't need to set context because it's already in localStorage).
  const tenantId = await page.evaluate(`localStorage.getItem("freshflow:tenantId")`) as string | null;
  const accountId = await page.evaluate(`localStorage.getItem("freshflow:accountId")`) as string | null;
  if (tenantId) {
    await page.addInitScript(`localStorage.setItem("freshflow:tenantId", ${JSON.stringify(tenantId)})`);
  }
  if (accountId) {
    await page.addInitScript(`localStorage.setItem("freshflow:accountId", ${JSON.stringify(accountId)})`);
  }

  // Re-navigate to /dashboard now that tenantId/accountId are injected via addInitScript.
  // In CI, useAuth's context-setting effect (which calls window.location.reload()) can fire
  // AFTER the networkidle check above, because React effects are scheduled asynchronously and
  // a slower CI CPU may not flush them within Playwright's 500 ms networkidle window.
  // That reload then races with the first test's page.goto(), producing a hidden body.
  //
  // By navigating again with context already pre-set, isContextValid() returns true on load
  // and no reload fires — loginAs always returns from a clean, stable page.
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
}

// ─── ACCOUNT_OWNER – Buyer portal ────────────────────────────────────────────

test.describe("ACCOUNT_OWNER – Buyer portal", () => {
  test("can view product catalog", async ({ page }) => {
    await loginAs(page, USERS.accountOwner);
    await page.goto("/chef/catalog");
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUT });
    await expect(page.locator("h1, h2, [role='heading']").first()).toBeVisible({ timeout: TIMEOUT });
  });

  test("can access cart (draft order)", async ({ page }) => {
    await loginAs(page, USERS.accountOwner);
    await page.goto("/chef/cart");
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUT });
    await expect(page.locator("body")).toBeVisible();
  });

  test("can view order history", async ({ page }) => {
    await loginAs(page, USERS.accountOwner);
    await page.goto("/chef/orders");
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUT });
    await expect(page.locator("h1, h2, [role='heading']").first()).toBeVisible({ timeout: TIMEOUT });
  });

  test("is redirected away from admin order management", async ({ page }) => {
    await loginAs(page, USERS.accountOwner);
    await page.goto("/admin/orders");
    // ProtectedRoute(requireTenantAdmin) redirects account users to /chef/catalog
    await expect(page).not.toHaveURL(/\/admin\/orders/, { timeout: TIMEOUT });
  });

  test("is redirected away from weighing page", async ({ page }) => {
    await loginAs(page, USERS.accountOwner);
    await page.goto(`/admin/weighing/${NONEXISTENT_ORDER_ID}`);
    await expect(page).not.toHaveURL(/\/admin\/weighing/, { timeout: TIMEOUT });
  });

  test("is redirected away from finalization page", async ({ page }) => {
    await loginAs(page, USERS.accountOwner);
    await page.goto(`/admin/finalize/${NONEXISTENT_ORDER_ID}`);
    await expect(page).not.toHaveURL(/\/admin\/finalize/, { timeout: TIMEOUT });
  });
});

// ─── ACCOUNT_BUYER – Restricted buyer ────────────────────────────────────────

test.describe("ACCOUNT_BUYER – Restricted buyer", () => {
  test("can access product catalog", async ({ page }) => {
    await loginAs(page, USERS.accountBuyer);
    await page.goto("/chef/catalog");
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUT });
    await expect(page.locator("body")).toBeVisible();
  });

  test("can view order history", async ({ page }) => {
    await loginAs(page, USERS.accountBuyer);
    await page.goto("/chef/orders");
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUT });
  });

  test("is redirected away from admin panel", async ({ page }) => {
    await loginAs(page, USERS.accountBuyer);
    await page.goto(`/admin/weighing/${NONEXISTENT_ORDER_ID}`);
    await expect(page).not.toHaveURL(/\/admin\/weighing/, { timeout: TIMEOUT });
  });
});

// ─── TENANT_ADMIN – Warehouse operations ─────────────────────────────────────

test.describe("TENANT_ADMIN – Warehouse operations", () => {
  test("can access order management", async ({ page }) => {
    await loginAs(page, USERS.tenantAdmin);
    await page.goto("/admin/orders");
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUT });
    await expect(page.locator("h1, h2, [role='heading']").first()).toBeVisible({ timeout: TIMEOUT });
  });

  test("can access weighing page", async ({ page }) => {
    await loginAs(page, USERS.tenantAdmin);
    await page.goto(`/admin/weighing/${NONEXISTENT_ORDER_ID}`);
    // ProtectedRoute allows TENANT_ADMIN through — page renders even if order not found
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUT });
    await expect(page.locator("body")).toBeVisible();
  });

  test("can access finalization page", async ({ page }) => {
    await loginAs(page, USERS.tenantAdmin);
    await page.goto(`/admin/finalize/${NONEXISTENT_ORDER_ID}`);
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUT });
    await expect(page.locator("body")).toBeVisible();
  });

  test("can access stock management", async ({ page }) => {
    await loginAs(page, USERS.tenantAdmin);
    await page.goto("/admin/stock");
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUT });
    await expect(page.locator("h1, h2, [role='heading']").first()).toBeVisible({ timeout: TIMEOUT });
  });

  test("is redirected away from buyer cart", async ({ page }) => {
    await loginAs(page, USERS.tenantAdmin);
    await page.goto("/chef/cart");
    // ProtectedRoute(requireAccountUser) redirects tenant admins to /admin/orders
    await expect(page).not.toHaveURL(/\/chef\/cart/, { timeout: TIMEOUT });
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
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUT });
    await expect(page.locator("h1, h2, [role='heading']").first()).toBeVisible({ timeout: TIMEOUT });
  });

  test("can access product management", async ({ page }) => {
    await loginAs(page, USERS.tenantOwner);
    await page.goto("/admin/products");
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUT });
    await expect(page.locator("h1, h2, [role='heading']").first()).toBeVisible({ timeout: TIMEOUT });
  });

  test("can access customer management", async ({ page }) => {
    await loginAs(page, USERS.tenantOwner);
    await page.goto("/admin/customers");
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUT });
    await expect(page.locator("h1, h2, [role='heading']").first()).toBeVisible({ timeout: TIMEOUT });
  });

  test("can access tenant settings", async ({ page }) => {
    await loginAs(page, USERS.tenantOwner);
    await page.goto("/admin/settings");
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUT });
    await expect(page.locator("body")).toBeVisible();
  });

  test("is redirected away from buyer cart", async ({ page }) => {
    await loginAs(page, USERS.tenantOwner);
    await page.goto("/chef/cart");
    await expect(page).not.toHaveURL(/\/chef\/cart/, { timeout: TIMEOUT });
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
      ).not.toHaveURL(/\/login/, { timeout: TIMEOUT });
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
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUT });
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
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUT });

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
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUT });

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
  test.beforeAll(() => {
    // Re-seed before this block so PED-003 WEIGHT items have no actualWeight,
    // regardless of whether a prior run (or a partial run) left them weighed.
    const backendDir = path.resolve(__dirname, "../../backend");
    execSync("pnpm prisma:seed", { cwd: backendDir, stdio: "inherit" });
  });

  test("TENANT_ADMIN navigates from orders list to weighing page for PED-003", async ({ page }) => {
    await loginAs(page, USERS.tenantAdmin);
    await page.goto("/admin/orders");
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUT });

    // Wait for the orders list to load. The page uses cards, not a table.
    // PED-003 is the only IN_SEPARATION order, so "Pesar" appears exactly once.
    const pesarLink = page.getByRole("link", { name: /pesar/i }).first();
    await expect(pesarLink).toBeVisible({ timeout: 10000 });
    await pesarLink.click();

    // Should land on the weighing page for this specific order
    await expect(page).toHaveURL(/\/admin\/weighing\//, { timeout: TIMEOUT });
    await expect(
      page.getByRole("heading", { name: /estação de pesagem/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("TENANT_ADMIN records a weight for a WEIGHT item in PED-003", async ({ page }) => {
    await loginAs(page, USERS.tenantAdmin);
    await page.goto("/admin/orders");
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUT });

    // Navigate to weighing page via the "Pesar" link (PED-003 is the only IN_SEPARATION order)
    const pesarLink = page.getByRole("link", { name: /pesar/i }).first();
    await expect(pesarLink).toBeVisible({ timeout: 10000 });
    await pesarLink.click();
    await expect(page).toHaveURL(/\/admin\/weighing\//, { timeout: TIMEOUT });

    // Wait for the tRPC orders.get request to settle before looking for the weight input.
    // pesarLink.click() causes a client-side React Router navigation — the URL changes
    // immediately, but the weighing page still needs to fetch order data asynchronously.
    // Without this wait, we may check for the input while the skeleton is still showing.
    await page.waitForLoadState("networkidle");

    // Confirm the order data section has rendered (only visible after the query resolves,
    // unlike the heading which appears in both the skeleton and the loaded state).
    await expect(page.getByText(/itens para pesar/i)).toBeVisible({ timeout: TIMEOUT });

    // Find the weight input for the first WEIGHT item and fill it.
    // Inputs are identified by id="weight-{itemId}" and inputMode="decimal".
    const weightInput = page.locator('input[id^="weight-"]').first();
    await expect(weightInput).toBeVisible({ timeout: TIMEOUT });
    await weightInput.fill("2.5");

    // Fill the notes textarea for the same item card.
    // PED-003 has two WEIGHT items (fileMignon requestedQty=3, picanha requestedQty=5).
    // With weight=2.5, picanha has -50% variance which triggers requiresNote.
    // Always providing a note avoids this guard regardless of DB row ordering.
    const notesTextarea = page.locator('textarea[id^="notes-"]').first();
    await notesTextarea.fill("Peso ajustado — teste automatizado");

    // Save the weight
    await page.getByRole("button", { name: /salvar peso/i }).first().click();

    // On success the item card switches from the input form to the "Pesado" (weighed) view.
    // Checking the "Pesado" badge is more robust than asserting on the input value because
    // orderQuery.refetch() runs before setWeights(), so the input disappears from the DOM
    // (replaced by the success section) before it can be read as "".
    await expect(page.getByText(/pesado/i).first()).toBeVisible({ timeout: TIMEOUT });
  });
});
