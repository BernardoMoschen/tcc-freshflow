import { beforeAll, afterAll, vi } from "vitest";

// Mock Prisma client for unit tests - use any to allow flexible mocking in tests
export const mockPrisma: any = {
  productOption: {
    findUnique: vi.fn(),
  },
  customerPrice: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  orderItem: {
    findMany: vi.fn(),
  },
  membership: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  account: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
};

// Mock the prisma module
vi.mock("../db/prisma.js", () => ({
  prisma: mockPrisma,
}));

beforeAll(() => {
  // Setup code
});

afterAll(() => {
  // Cleanup code
  vi.clearAllMocks();
});
