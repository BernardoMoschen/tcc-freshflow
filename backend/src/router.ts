import { router } from "./trpc.js";
import { authRouter } from "./routers/auth.router.js";
import { productsRouter } from "./routers/products.router.js";
import { ordersRouter } from "./routers/orders.router.js";
import { stockRouter } from "./routers/stock.router.js";
import { customersRouter } from "./routers/customers.router.js";
import { tenantsRouter } from "./routers/tenants.router.js";
import { analyticsRouter } from "./routers/analytics.router.js";

/**
 * Root tRPC router
 * Combines all feature routers
 */
export const appRouter = router({
  auth: authRouter,
  products: productsRouter,
  orders: ordersRouter,
  stock: stockRouter,
  customers: customersRouter,
  tenants: tenantsRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
