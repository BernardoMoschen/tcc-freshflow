import { execSync } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Global setup for E2E tests
 * - Ensures database is seeded before tests run
 */
async function globalSetup() {
  // Skip seeding when E2E_SEEDED=true — useful when running against a pre-seeded DB
  if (process.env.E2E_SEEDED === "true") {
    console.log("\n⏭️  Skipping seed (E2E_SEEDED=true)\n");
    return;
  }

  console.log("\n🌱 Seeding database for E2E tests...");

  try {
    const backendDir = path.resolve(__dirname, "../../backend");

    execSync("pnpm prisma:seed", {
      cwd: backendDir,
      stdio: "inherit",
    });

    console.log("✅ Database seeded successfully\n");
  } catch (error) {
    console.error("❌ Failed to seed database:", error);
    process.exit(1);
  }
}

export default globalSetup;
