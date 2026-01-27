import { router } from "./trpc.js";
import { authRouter } from "./routers/auth.router.js";
import { productsRouter } from "./routers/products.router.js";
import { ordersRouter } from "./routers/orders.router.js";

/**
 * Root tRPC router
 * Combines all feature routers
 */
export const appRouter = router({
  auth: authRouter,
  products: productsRouter,
  orders: ordersRouter,
});

export type AppRouter = typeof appRouter;
