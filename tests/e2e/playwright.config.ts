import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: "html",
  globalSetup: path.resolve(__dirname, "./global-setup.ts"),

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  expect: {
    // CI backends are cold on first run — give assertions more time to settle
    timeout: process.env.CI ? 15000 : 5000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command: "pnpm --filter freshflow-backend dev",
      url: "http://localhost:3001/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: "pnpm --filter freshflow-frontend dev -- --host 0.0.0.0 --port 5173",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
