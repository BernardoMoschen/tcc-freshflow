import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import { prisma } from "./db/prisma.js";
import { logger } from "./lib/logger.js";
import { Errors } from "./lib/errors.js";

/**
 * Configuration error - thrown during server startup, not request handling
 */
class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigError";
  }
}

// Supabase JWKS URL (derived from SUPABASE_URL)
const getJWKSUrl = (supabaseUrl: string): URL => {
  return new URL(`${supabaseUrl}/auth/v1/jwks`);
};

// Cache for JWKS
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

/**
 * Verify Supabase JWT token using JWKS
 * Fallback to SUPABASE_JWT_SECRET for development
 */
export async function verifySupabaseToken(token: string): Promise<JWTPayload> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;

  if (!supabaseUrl && !supabaseJwtSecret) {
    throw new AuthConfigError("SUPABASE_URL or SUPABASE_JWT_SECRET must be set");
  }

  try {
    // Try JWKS first (production)
    if (supabaseUrl) {
      if (!jwks) {
        jwks = createRemoteJWKSet(getJWKSUrl(supabaseUrl));
      }

      const { payload } = await jwtVerify(token, jwks, {
        issuer: `${supabaseUrl}/auth/v1`,
        audience: "authenticated",
      });

      return payload;
    }

    // Fallback to secret (development)
    if (supabaseJwtSecret) {
      const secretKey = new TextEncoder().encode(supabaseJwtSecret);
      const { payload } = await jwtVerify(token, secretKey);
      return payload;
    }

    throw new AuthConfigError("No JWT verification method available");
  } catch (error) {
    if (error instanceof AuthConfigError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw Errors.unauthorized(`JWT verification failed: ${message}`);
  }
}

/**
 * Extract auth token from Authorization header
 */
export function extractToken(authHeader?: string): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Auto-provision user from Supabase JWT claims
 * Creates User record if it doesn't exist
 */
export async function provisionUser(payload: JWTPayload): Promise<string> {
  const supabaseId = payload.sub;
  const email = payload.email as string;
  const name = (payload.user_metadata as { full_name?: string })?.full_name;

  if (!supabaseId || !email) {
    throw Errors.unauthorized("Invalid JWT payload: missing sub or email");
  }

  // Find or create user
  let user = await prisma.user.findUnique({
    where: { supabaseId },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        supabaseId,
        email,
        name: name || email.split("@")[0],
      },
    });
    logger.info(`✨ Auto-provisioned user: ${email}`);
  }

  return user.id;
}

/**
 * Authenticate request and return user ID
 * Combines token verification and user provisioning
 */
export async function authenticateRequest(authHeader?: string): Promise<string> {
  const token = extractToken(authHeader);

  if (!token) {
    throw Errors.unauthorized("No authentication token provided");
  }

  const payload = await verifySupabaseToken(token);
  const userId = await provisionUser(payload);

  return userId;
}
