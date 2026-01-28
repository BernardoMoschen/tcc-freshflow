import { beforeAll, afterAll, vi } from "vitest";

// Mock Prisma client for unit tests
export const mockPrisma = {
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
