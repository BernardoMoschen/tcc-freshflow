import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  hasRole,
  canAccessTenant,
  canAccessAccount,
  getUserRole,
  isPlatformAdmin,
  getUserMemberships,
  requireRole,
  requireTenantAccess,
  requireAccountAccess,
} from "../rbac.js";
import { mockPrisma } from "./setup.js";
import { RoleType } from "@prisma/client";

describe("RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("hasRole", () => {
    it("should return true for exact role match", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "m-1",
            userId: "user-1",
            role: { name: RoleType.ACCOUNT_OWNER },
          },
        ]),
      };

      const result = await hasRole("user-1", RoleType.ACCOUNT_OWNER);

      expect(result).toBe(true);
    });

    it("should return true for higher role in hierarchy", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "m-1",
            userId: "user-1",
            role: { name: RoleType.PLATFORM_ADMIN },
          },
        ]),
      };

      const result = await hasRole("user-1", RoleType.ACCOUNT_BUYER);

      expect(result).toBe(true); // PLATFORM_ADMIN (100) >= ACCOUNT_BUYER (20)
    });

    it("should return false for lower role in hierarchy", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "m-1",
            userId: "user-1",
            role: { name: RoleType.ACCOUNT_BUYER },
          },
        ]),
      };

      const result = await hasRole("user-1", RoleType.PLATFORM_ADMIN);

      expect(result).toBe(false); // ACCOUNT_BUYER (20) < PLATFORM_ADMIN (100)
    });

    it("should return false when user has no memberships", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([]),
      };

      const result = await hasRole("user-1", RoleType.ACCOUNT_OWNER);

      expect(result).toBe(false);
    });

    it("should respect tenant context", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "m-1",
            userId: "user-1",
            tenantId: "tenant-1",
            role: { name: RoleType.TENANT_OWNER },
          },
        ]),
      };

      const result = await hasRole("user-1", RoleType.TENANT_OWNER, {
        tenantId: "tenant-1",
      });

      expect(result).toBe(true);
      expect(mockPrisma.membership.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          tenantId: "tenant-1",
        },
        include: { role: true },
      });
    });

    it("should respect account context", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "m-1",
            userId: "user-1",
            accountId: "account-1",
            role: { name: RoleType.ACCOUNT_OWNER },
          },
        ]),
      };

      const result = await hasRole("user-1", RoleType.ACCOUNT_OWNER, {
        accountId: "account-1",
      });

      expect(result).toBe(true);
    });
  });

  describe("getUserRole", () => {
    it("should return highest role in hierarchy", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([
          { id: "m-1", role: { name: RoleType.ACCOUNT_OWNER } },
          { id: "m-2", role: { name: RoleType.TENANT_ADMIN } },
        ]),
      };

      const result = await getUserRole("user-1");

      expect(result).toBe(RoleType.TENANT_ADMIN);
    });

    it("should return null when no memberships", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([]),
      };

      const result = await getUserRole("user-1");

      expect(result).toBeNull();
    });
  });

  describe("getUserMemberships", () => {
    it("should return memberships with includes", async () => {
      const memberships = [{ id: "m-1" }];
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue(memberships),
      };

      const result = await getUserMemberships("user-1");

      expect(result).toBe(memberships);
      expect(mockPrisma.membership.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
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
    });
  });

  describe("isPlatformAdmin", () => {
    it("should return true when user has platform admin role", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([
          { id: "m-1", role: { name: RoleType.PLATFORM_ADMIN } },
        ]),
      };

      const result = await isPlatformAdmin("user-1");

      expect(result).toBe(true);
    });
  });

  describe("require access helpers", () => {
    it("requireRole should throw with context", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([
          { id: "m-1", role: { name: RoleType.ACCOUNT_BUYER } },
        ]),
      };

      await expect(
        requireRole("user-1", RoleType.TENANT_ADMIN, {
          tenantId: "tenant-1",
          accountId: "account-1",
        })
      ).rejects.toThrow("tenant tenant-1");
    });

    it("requireTenantAccess should throw when denied", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      };

      await expect(requireTenantAccess("user-1", "tenant-1")).rejects.toThrow(
        "Access denied to tenant tenant-1"
      );
    });

    it("requireAccountAccess should throw when denied", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      };
      mockPrisma.account = {
        findUnique: vi.fn().mockResolvedValue(null),
      };

      await expect(requireAccountAccess("user-1", "account-1")).rejects.toThrow(
        "Access denied to account account-1"
      );
    });
  });
  describe("canAccessTenant", () => {
    it("should allow PLATFORM_ADMIN to access any tenant", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "m-1",
            role: { name: RoleType.PLATFORM_ADMIN },
          },
        ]),
        findFirst: vi.fn(),
      };

      const result = await canAccessTenant("user-1", "any-tenant");

      expect(result).toBe(true);
    });

    it("should allow tenant members to access their tenant", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({
          id: "m-1",
          userId: "user-1",
          tenantId: "tenant-1",
        }),
      };

      const result = await canAccessTenant("user-1", "tenant-1");

      expect(result).toBe(true);
      expect(mockPrisma.membership.findFirst).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          tenantId: "tenant-1",
        },
      });
    });

    it("should deny non-members access to tenant", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      };

      const result = await canAccessTenant("user-1", "tenant-1");

      expect(result).toBe(false);
    });
  });

  describe("canAccessAccount", () => {
    it("should allow PLATFORM_ADMIN to access any account", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "m-1",
            role: { name: RoleType.PLATFORM_ADMIN },
          },
        ]),
        findFirst: vi.fn(),
      };
      mockPrisma.account = {
        findUnique: vi.fn(),
      };

      const result = await canAccessAccount("user-1", "any-account");

      expect(result).toBe(true);
    });

    it("should allow account members to access their account", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            // First call: account membership
            id: "m-1",
            userId: "user-1",
            accountId: "account-1",
          })
          .mockResolvedValueOnce(null), // Second call: no tenant membership needed
      };
      mockPrisma.account = {
        findUnique: vi.fn(),
      };

      const result = await canAccessAccount("user-1", "account-1");

      expect(result).toBe(true);
    });

    it("should allow tenant admins to access accounts in their tenant", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null) // No direct account membership
          .mockResolvedValueOnce({
            // Has tenant membership
            id: "m-2",
            userId: "user-1",
            tenantId: "tenant-1",
            role: { name: RoleType.TENANT_ADMIN },
          }),
      };
      mockPrisma.account = {
        findUnique: vi.fn().mockResolvedValue({
          id: "account-1",
          tenantId: "tenant-1",
        }),
      };

      const result = await canAccessAccount("user-1", "account-1");

      expect(result).toBe(true);
    });

    it("should deny access to accounts in other tenants", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      };
      mockPrisma.account = {
        findUnique: vi.fn().mockResolvedValue({
          id: "account-1",
          tenantId: "tenant-1",
        }),
      };

      const result = await canAccessAccount("user-1", "account-1");

      expect(result).toBe(false);
    });

    it("should return false for non-existent account", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      };
      mockPrisma.account = {
        findUnique: vi.fn().mockResolvedValue(null),
      };

      const result = await canAccessAccount("user-1", "invalid-account");

      expect(result).toBe(false);
    });
  });

  describe("getUserRole", () => {
    it("should return highest role when user has multiple roles", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "m-1",
            role: { name: RoleType.ACCOUNT_BUYER },
          },
          {
            id: "m-2",
            role: { name: RoleType.TENANT_ADMIN },
          },
          {
            id: "m-3",
            role: { name: RoleType.ACCOUNT_OWNER },
          },
        ]),
      };

      const role = await getUserRole("user-1");

      expect(role).toBe(RoleType.TENANT_ADMIN); // Highest in the list
    });

    it("should return null when user has no roles", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([]),
      };

      const role = await getUserRole("user-1");

      expect(role).toBeNull();
    });
  });

  describe("isPlatformAdmin", () => {
    it("should return true for PLATFORM_ADMIN", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "m-1",
            role: { name: RoleType.PLATFORM_ADMIN },
          },
        ]),
      };

      const result = await isPlatformAdmin("user-1");

      expect(result).toBe(true);
    });

    it("should return false for non-admin users", async () => {
      mockPrisma.membership = {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "m-1",
            role: { name: RoleType.ACCOUNT_OWNER },
          },
        ]),
      };

      const result = await isPlatformAdmin("user-1");

      expect(result).toBe(false);
    });
  });
});
