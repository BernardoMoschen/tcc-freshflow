import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/lib/**/*.ts", "src/rbac.ts"],
      exclude: [
        "src/__tests__/**",
        "src/docs/**",
        // Infrastructure modules — require integration tests with real services
        "src/lib/audit-logger.ts",
        "src/lib/cache.ts",
        "src/lib/whatsapp.ts",
        "src/lib/stock-manager.ts",
        "src/lib/event-emitter.ts",
        "src/lib/env.ts",
        "src/lib/logger.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
