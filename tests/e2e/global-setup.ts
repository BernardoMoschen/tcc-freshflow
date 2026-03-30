import { execSync } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Global setup for E2E tests
 * - Ensures database is seeded before tests run
 */
async function globalSetup() {
  console.log("\n🌱 Seeding database for E2E tests...");

  try {
    // Get the backend directory
    const backendDir = path.resolve(__dirname, "../../backend");

    // Run seed command
    execSync("pnpm prisma:seed", {
      cwd: backendDir,
      stdio: "inherit",
    });

    console.log("✅ Database seeded successfully\n");
  } catch (error) {
    console.error("❌ Failed to seed database:", error);
    // Don't fail completely - user might have intentionally skipped seeding
    // This allows manual setup scenarios
    process.exit(1);
  }
}

export default globalSetup;
