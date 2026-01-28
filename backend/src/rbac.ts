import { RoleType } from "@prisma/client";
import { prisma } from "./db/prisma.js";
import { Errors } from "./lib/errors.js";

/**
 * Role hierarchy (higher = more permissions)
 * PLATFORM_ADMIN can access everything
 */
const roleHierarchy: Record<RoleType, number> = {
  [RoleType.PLATFORM_ADMIN]: 100,
  [RoleType.TENANT_OWNER]: 50,
  [RoleType.TENANT_ADMIN]: 40,
  [RoleType.ACCOUNT_OWNER]: 30,
  [RoleType.ACCOUNT_BUYER]: 20,
};

/**
 * Check if user has a specific role (or higher in hierarchy)
 */
export async function hasRole(
  userId: string,
  requiredRole: RoleType,
  context?: {
    tenantId?: string;
    accountId?: string;
  }
): Promise<boolean> {
  const memberships = await prisma.membership.findMany({
    where: {
      userId,
      ...(context?.tenantId && { tenantId: context.tenantId }),
      ...(context?.accountId && { accountId: context.accountId }),
    },
    include: {
      role: true,
    },
  });

  if (memberships.length === 0) {
    return false;
  }

  const requiredLevel = roleHierarchy[requiredRole];

  return memberships.some((membership) => {
    const userLevel = roleHierarchy[membership.role.name];
    return userLevel >= requiredLevel;
  });
}

/**
 * Check if user can access a tenant
 */
export async function canAccessTenant(userId: string, tenantId: string): Promise<boolean> {
  // Platform admins can access any tenant
  const isPlatformAdmin = await hasRole(userId, RoleType.PLATFORM_ADMIN);
  if (isPlatformAdmin) return true;

  // Check if user has direct tenant-level membership
  const tenantMembership = await prisma.membership.findFirst({
    where: {
      userId,
      tenantId,
    },
  });

  if (tenantMembership) return true;

  // Check if user has account-level membership within this tenant
  const accountMembership = await prisma.membership.findFirst({
    where: {
      userId,
      account: {
        tenantId,
      },
    },
  });

  return !!accountMembership;
}

/**
 * Check if user can access an account
 */
export async function canAccessAccount(userId: string, accountId: string): Promise<boolean> {
  // Platform admins can access any account
  const isPlatformAdmin = await hasRole(userId, RoleType.PLATFORM_ADMIN);
  if (isPlatformAdmin) return true;

  // Check if user has membership in this account
  const accountMembership = await prisma.membership.findFirst({
    where: {
      userId,
      accountId,
    },
  });

  if (accountMembership) return true;

  // Check if user has tenant-level access to the account's tenant
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { tenantId: true },
  });

  if (!account) return false;

  const tenantMembership = await prisma.membership.findFirst({
    where: {
      userId,
      tenantId: account.tenantId,
    },
    include: {
      role: true,
    },
  });

  return !!tenantMembership;
}

/**
 * Get user's role in a specific context
 */
export async function getUserRole(
  userId: string,
  context?: {
    tenantId?: string;
    accountId?: string;
  }
): Promise<RoleType | null> {
  const memberships = await prisma.membership.findMany({
    where: {
      userId,
      ...(context?.tenantId && { tenantId: context.tenantId }),
      ...(context?.accountId && { accountId: context.accountId }),
    },
    include: {
      role: true,
    },
    orderBy: {
      role: {
        name: "asc", // Will be sorted by hierarchy in code
      },
    },
  });

  if (memberships.length === 0) {
    return null;
  }

  // Return highest role in hierarchy
  const highestRole = memberships.reduce((highest, membership) => {
    const currentLevel = roleHierarchy[membership.role.name];
    const highestLevel = roleHierarchy[highest];
    return currentLevel > highestLevel ? membership.role.name : highest;
  }, memberships[0].role.name);

  return highestRole;
}

/**
 * Get all user memberships with details
 */
export async function getUserMemberships(userId: string) {
  return prisma.membership.findMany({
    where: { userId },
    include: {
      role: true,
      tenant: true,
      account: {
        include: {
          tenant: true,
        },
      },
    },
  });
}

/**
 * Check if user is platform admin
 */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  return hasRole(userId, RoleType.PLATFORM_ADMIN);
}

/**
 * Require specific role or throw error
 */
export async function requireRole(
  userId: string,
  requiredRole: RoleType,
  context?: {
    tenantId?: string;
    accountId?: string;
  }
): Promise<void> {
  const hasRequiredRole = await hasRole(userId, requiredRole, context);

  if (!hasRequiredRole) {
    throw Errors.forbidden(
      `Insufficient permissions. Required role: ${requiredRole}${
        context?.tenantId ? ` in tenant ${context.tenantId}` : ""
      }${context?.accountId ? ` in account ${context.accountId}` : ""}`
    );
  }
}

/**
 * Require tenant access or throw error
 */
export async function requireTenantAccess(userId: string, tenantId: string): Promise<void> {
  const hasAccess = await canAccessTenant(userId, tenantId);

  if (!hasAccess) {
    throw Errors.forbidden(`Access denied to tenant ${tenantId}`);
  }
}

/**
 * Require account access or throw error
 */
export async function requireAccountAccess(userId: string, accountId: string): Promise<void> {
  const hasAccess = await canAccessAccount(userId, accountId);

  if (!hasAccess) {
    throw Errors.forbidden(`Access denied to account ${accountId}`);
  }
}
