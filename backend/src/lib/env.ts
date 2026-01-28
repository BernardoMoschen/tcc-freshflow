import { z } from "zod";

/**
 * Environment variable schema validation
 * Validates all required environment variables at startup
 */
const envSchema = z.object({
  // Required for database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL URL"),

  // Supabase authentication (at least one must be set)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_JWT_SECRET: z.string().min(32, "SUPABASE_JWT_SECRET must be at least 32 characters").optional(),

  // Server configuration
  PORT: z.string().regex(/^\d+$/, "PORT must be a number").optional().default("3001"),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),

  // CORS
  ALLOWED_ORIGINS: z.string().optional(),

  // Redis (optional)
  REDIS_URL: z.string().url().optional(),

  // WhatsApp integration (optional)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),

  // API base URL for PDF links (optional)
  API_BASE_URL: z.string().url().optional(),
}).refine(
  (data) => data.SUPABASE_URL || data.SUPABASE_JWT_SECRET,
  {
    message: "Either SUPABASE_URL or SUPABASE_JWT_SECRET must be set for authentication",
  }
);

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables at startup
 * Throws an error with detailed message if validation fails
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map((e) => {
      const path = e.path.join(".");
      return `  - ${path}: ${e.message}`;
    });

    console.error("\n❌ Environment variable validation failed:\n");
    console.error(errors.join("\n"));
    console.error("\nPlease check your .env file or environment configuration.\n");

    // In development, provide helpful hints
    if (process.env.NODE_ENV !== "production") {
      console.error("💡 Hint: Copy .env.example to .env and fill in the required values.\n");
    }

    throw new Error(`Invalid environment configuration: ${errors.length} error(s)`);
  }

  // Log validated config in development (without secrets)
  if (result.data.NODE_ENV === "development") {
    console.log("✅ Environment validated:");
    console.log(`   - NODE_ENV: ${result.data.NODE_ENV}`);
    console.log(`   - PORT: ${result.data.PORT}`);
    console.log(`   - DATABASE_URL: ${result.data.DATABASE_URL.replace(/:[^:@]+@/, ":****@")}`);
    console.log(`   - SUPABASE_URL: ${result.data.SUPABASE_URL ? "✓ set" : "not set"}`);
    console.log(`   - SUPABASE_JWT_SECRET: ${result.data.SUPABASE_JWT_SECRET ? "✓ set" : "not set"}`);
    console.log(`   - REDIS_URL: ${result.data.REDIS_URL ? "✓ set" : "not set (using memory cache)"}`);
    console.log("");
  }

  return result.data;
}

// Export validated environment (call validateEnv() at startup)
let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    _env = validateEnv();
  }
  return _env;
}
