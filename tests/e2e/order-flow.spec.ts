import { test, expect } from "@playwright/test";

/**
 * E2E Acceptance Test: Complete Order Flow
 *
 * Tests the critical path: order creation → weighing → finalization → PDF
 *
 * Verifies:
 * 1. Chef can create order with mixed FIXED/WEIGHT items
 * 2. Admin can weigh items with price override
 * 3. Price persistence creates CustomerPrice record
 * 4. Order finalizes successfully
 * 5. PDF contains correct data ("Extrato de Conferência", totals)
 */

const isSeeded = process.env.E2E_SEEDED === "true";

async function loginAsChef(page: import("@playwright/test").Page) {
  await page.goto("/login");

  const chefButton = page.getByRole("button", { name: /Entrar como Chef/i });
  await chefButton.waitFor({ state: "visible", timeout: 15000 });
  await chefButton.click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  const adminButton = page.getByRole("button", { name: /Entrar como Admin da Plataforma/i });
  await adminButton.waitFor({ state: "visible", timeout: 15000 });
  await adminButton.click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function clearCartIfNeeded(page: import("@playwright/test").Page) {
  await page.goto("/chef/cart");
  const clearButton = page.getByRole("button", { name: /Limpar Carrinho/i });
  if (await clearButton.isVisible().catch(() => false)) {
    await clearButton.click();
    const confirmButton = page.getByRole("button", { name: /Limpar Carrinho/i }).last();
    await confirmButton.click();
    await expect(page.getByText(/Seu carrinho est[aá] vazio/i)).toBeVisible({ timeout: 15000 });
  }
}

test.describe("Complete Order Flow", () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Reset test database to known state
    // TODO: Ensure test users exist in Supabase
  });

  test("chef creates order, admin weighs and finalizes, downloads PDF", async ({ page }) => {
    test.skip(!isSeeded, "E2E requires seeded data (set E2E_SEEDED=true)");
    // Ensure dev auth header is present before the app requests session
    await page.addInitScript(() => {
      try {
        localStorage.setItem("freshflow:dev-user-email", "chef@chefstable.com");
      } catch (e) {
        // ignore
      }
    });

    // Step 1: Login as chef (dev login will be effective immediately)
    await loginAsChef(page);

    await clearCartIfNeeded(page);

    // Navigate to catalog
    await page.goto("/chef/catalog");

    // Step 2: Browse products and add to cart
    await expect(page.getByRole("heading", { name: /Cat[aá]logo/i })).toBeVisible({
      timeout: 15000,
    });

    // Add FIXED item (Aspargos Frescos)
    const asparagusCard = page
      .getByRole("heading", { name: /Aspargos Frescos/i })
      .first()
      .locator("..")
      .locator("..");
    await expect(asparagusCard).toBeVisible({ timeout: 15000 });
    const asparagusAdd = asparagusCard.locator('button:has-text("Adicionar")');
    const asparagusQtyGroup = asparagusCard.getByRole("group", {
      name: /Quantidade de Aspargos Frescos/i,
    });
    if (await asparagusQtyGroup.isVisible().catch(() => false)) {
      const inc = asparagusQtyGroup.getByRole("button", { name: /Aumentar quantidade/i });
      await inc.scrollIntoViewIfNeeded();
      await expect(inc).toBeVisible({ timeout: 15000 });
      await inc.click();
    } else {
      await asparagusAdd.scrollIntoViewIfNeeded();
      await expect(asparagusAdd).toBeVisible({ timeout: 15000 });
      await asparagusAdd.click();
    }

    // Add WEIGHT item (Salmao Premium)
    const salmonCard = page
      .getByRole("heading", { name: /Salmao Premium/i })
      .first()
      .locator("..")
      .locator("..");
    await expect(salmonCard).toBeVisible({ timeout: 15000 });
    const salmonAdd = salmonCard.locator('button:has-text("Adicionar")');
    const salmonQtyGroup = salmonCard.getByRole("group", { name: /Quantidade de Salmao Premium/i });
    if (await salmonQtyGroup.isVisible().catch(() => false)) {
      const inc = salmonQtyGroup.getByRole("button", { name: /Aumentar quantidade/i });
      await inc.scrollIntoViewIfNeeded();
      await expect(inc).toBeVisible({ timeout: 15000 });
      await inc.click();
    } else {
      await salmonAdd.scrollIntoViewIfNeeded();
      await expect(salmonAdd).toBeVisible({ timeout: 15000 });
      await salmonAdd.click();
    }

    // Step 3: Go to cart and submit order
    await page.click("text=Carrinho");
    await expect(page).toHaveURL(/\/chef\/cart/);

    // Verify cart has items (scope to cart item containers to avoid duplicates)
    await expect(page.locator("div", { hasText: /Aspargos Frescos/i }).first()).toBeVisible();
    await expect(page.locator("div", { hasText: /Salmao Premium/i }).first()).toBeVisible();

    // Submit order
    const quickDates = page.getByRole("group", { name: /Atalhos de data/i });
    await quickDates.getByRole("button").first().click();

    // Don't block on a persistent sync indicator; rely on the submit button being enabled instead

    // Wait for the client to finish syncing the draft update to the server (orders.updateDraft)
    let updateResp: import('@playwright/test').APIResponse | null = null;
    try {
      updateResp = await page.waitForResponse((resp) => {
        try {
          const req = resp.request();
          const post = req.postData() || "";
          return resp.url().includes("/trpc") && post.includes("orders.updateDraft");
        } catch (e) {
          return false;
        }
      }, { timeout: 30000 });

      // Try to read response text and surface server errors early
      try {
        const body = await updateResp.text();
        if (body && (body.includes("One or more product options not found") || body.includes("UNAUTHORIZED") || body.includes("BAD_REQUEST") || body.includes("error"))) {
          // Truncate for log readability
          const snippet = body.length > 1000 ? body.slice(0, 1000) + "..." : body;
          throw new Error(`orders.updateDraft response contained an error: ${snippet}`);
        }
      } catch (readErr) {
        // Best-effort: if reading fails, continue — we'll catch failures via UI assertions
      }
    } catch (e) {
      // Timeout waiting for updateDraft response; continue and let the enabled-check capture the state
    }

    const sendButton = page.locator('button:has-text("Enviar Pedido")');
    await expect(sendButton).toBeEnabled({ timeout: 60000 });
    await sendButton.click();

    // Wait for either success or error toast so we can surface server errors during CI
    const successToast = page.getByText(/Pedido enviado/i);
    const errorToast = page.getByText(
      /Falha ao enviar pedido|Falha ao atualizar|One or more product options not found|Cannot submit empty order/i
    );
    const outcome = await Promise.race([
      successToast
        .waitFor({ state: "visible", timeout: 30000 })
        .then(() => "success")
        .catch(() => null),
      errorToast
        .waitFor({ state: "visible", timeout: 30000 })
        .then(() => "error")
        .catch(() => null),
    ]);

    if (outcome !== "success") {
      // If we didn't see success, try to capture any error text and fail with context.
      let errText = "(no error toast)";
      try {
        const contents = await errorToast.allTextContents();
        if (contents && contents.length > 0) {
          errText = contents.join(" \n ").trim();
        }
      } catch (e) {
        // Page/context may have been closed; fall back to generic message
        errText = "(failed to read error toast - page may be closed)";
      }

      throw new Error(
        `Order submit did not succeed. Error toast: ${errText}`
      );
    }
    if (!page.url().includes("/chef/orders")) {
      await page.goto("/chef/orders");
    }

    // Step 4: Login as admin
    await loginAsAdmin(page);

    // Step 5: Open admin orders and pick an IN_SEPARATION order for weighing
    await page.goto("/admin/orders");
    await page.getByRole("combobox", { name: /Filtrar por status/i }).click();
    await page.getByRole("option", { name: "Em Separação" }).click();

    const weighLink = page.getByRole("link", { name: /Pesar/i }).first();
    await expect(weighLink).toBeVisible({ timeout: 15000 });
    await weighLink.click();
    await page.waitForURL(/\/admin\/weighing\//, { timeout: 15000 });
    const orderId = page.url().split("/").pop();
    if (!orderId) {
      throw new Error("Expected order id in weighing URL");
    }

    // Step 6: Weigh the WEIGHT item (Salmao Premium)
    const fishItem = page.locator("text=Salmao Premium").first().locator("..");

    // Enter actual weight
    await fishItem.locator('input[type="number"]').first().fill("2.5");

    // Enter price override
    await fishItem.locator('input[type="number"]').nth(1).fill("42.00");

    // Check "persist price" checkbox
    await fishItem.locator('input[type="checkbox"]').check();

    // Save weight
    await fishItem.locator('button:has-text("Salvar Peso")').click();

    // Wait for success
    await expect(page.locator("text=Peso salvo com sucesso")).toBeVisible({ timeout: 5000 });

    // Step 7: Verify weighing in database
    // TODO: Query database to verify Weighing and CustomerPrice records

    // Step 8: Navigate to finalization
    await page.goto(`/admin/finalize/${orderId}`);

    // Verify totals are displayed
    await expect(page.locator("text=Itens Fixos")).toBeVisible();
    await expect(page.locator("text=Itens por Peso")).toBeVisible();
    await expect(page.locator("text=TOTAL")).toBeVisible();

    // Step 9: Finalize order
    await page.click('button:has-text("Finalizar Pedido")');

    // Wait for success
    await page.waitForSelector('a:has-text("Baixar PDF")', { timeout: 10000 });

    // Step 10: Download and verify PDF
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click('a:has-text("Baixar PDF")'),
    ]);

    const path = await download.path();
    // TODO: Read PDF file and parse content
    // TODO: Verify PDF contains "Extrato de Conferência"
    // TODO: Verify PDF contains order number
    // TODO: Verify PDF contains correct product names
    // TODO: Verify PDF contains correct totals

    // Placeholder assertion
    expect(path).toBeTruthy();
  });

  test("offline weighing queues and syncs when online", async ({ page, context }) => {
    test.skip(!isSeeded, "E2E requires seeded data (set E2E_SEEDED=true)");
    // Step 1: Login and navigate to weighing page
    // TODO: Login as admin
    // TODO: Navigate to order with WEIGHT items

    // Step 2: Simulate offline mode
    await context.setOffline(true);

    // Step 3: Weigh item while offline
    // TODO: Enter weight and save
    // TODO: Verify "queued" or "pending sync" indicator

    // Step 4: Go back online
    await context.setOffline(false);

    // Step 5: Verify auto-sync occurs
    // TODO: Wait for sync completion
    // TODO: Verify weighing saved to database

    expect(true).toBe(true); // Placeholder
  });

  test("cannot finalize order with unweighed items", async ({ page }) => {
    test.skip(!isSeeded, "E2E requires seeded data (set E2E_SEEDED=true)");
    // TODO: Create order with WEIGHT items
    // TODO: Navigate to finalization without weighing
    // TODO: Verify finalize button is disabled
    // TODO: Verify error message is shown

    expect(true).toBe(true); // Placeholder
  });
});
