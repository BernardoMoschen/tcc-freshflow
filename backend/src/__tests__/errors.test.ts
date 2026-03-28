import { describe, it, expect, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { BusinessError, Errors, logError, toTRPCError, withErrorLogging } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

describe("Error Utilities", () => {
  describe("BusinessError", () => {
    it("should create error with message and default code", () => {
      const err = new BusinessError("Something went wrong");
      expect(err.message).toBe("Something went wrong");
      expect(err.code).toBe("BUSINESS_ERROR");
      expect(err.name).toBe("BusinessError");
    });

    it("should create error with custom code", () => {
      const err = new BusinessError("Out of stock", "STOCK_ERROR");
      expect(err.code).toBe("STOCK_ERROR");
    });

    it("should be an instance of Error", () => {
      const err = new BusinessError("test");
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe("Errors factory methods", () => {
    it("notFound - with ID", () => {
      const err = Errors.notFound("Product", "abc-123");
      expect(err).toBeInstanceOf(TRPCError);
      expect(err.code).toBe("NOT_FOUND");
      expect(err.message).toBe("Product with ID abc-123 not found");
    });

    it("notFound - without ID", () => {
      const err = Errors.notFound("Order");
      expect(err.code).toBe("NOT_FOUND");
      expect(err.message).toBe("Order not found");
    });

    it("unauthorized - default message", () => {
      const err = Errors.unauthorized();
      expect(err.code).toBe("UNAUTHORIZED");
      expect(err.message).toContain("logged in");
    });

    it("unauthorized - custom message", () => {
      const err = Errors.unauthorized("Token expired");
      expect(err.message).toBe("Token expired");
    });

    it("forbidden - default message", () => {
      const err = Errors.forbidden();
      expect(err.code).toBe("FORBIDDEN");
      expect(err.message).toContain("permission");
    });

    it("badRequest", () => {
      const err = Errors.badRequest("Invalid input");
      expect(err.code).toBe("BAD_REQUEST");
      expect(err.message).toBe("Invalid input");
    });

    it("conflict", () => {
      const err = Errors.conflict("Duplicate entry");
      expect(err.code).toBe("CONFLICT");
      expect(err.message).toBe("Duplicate entry");
    });

    it("internal - default message", () => {
      const err = Errors.internal();
      expect(err.code).toBe("INTERNAL_SERVER_ERROR");
      expect(err.message).toContain("internal server error");
    });

    it("insufficientStock", () => {
      const err = Errors.insufficientStock("Tomate", 5, 10);
      expect(err.code).toBe("BAD_REQUEST");
      expect(err.message).toContain("Tomate");
      expect(err.message).toContain("Available: 5");
      expect(err.message).toContain("Required: 10");
    });

    it("orderAlreadyFinalized", () => {
      const err = Errors.orderAlreadyFinalized("PED-001");
      expect(err.code).toBe("BAD_REQUEST");
      expect(err.message).toContain("PED-001");
      expect(err.message).toContain("finalized");
    });

    it("cannotWeighFixedItem", () => {
      const err = Errors.cannotWeighFixedItem();
      expect(err.code).toBe("BAD_REQUEST");
      expect(err.message).toContain("fixed-unit");
    });

    it("orderNotReady", () => {
      const err = Errors.orderNotReady("2 items unweighed");
      expect(err.code).toBe("BAD_REQUEST");
      expect(err.message).toContain("2 items unweighed");
    });
  });

  describe("toTRPCError", () => {
    it("should return TRPCError as-is", () => {
      const original = new TRPCError({
        code: "NOT_FOUND",
        message: "test",
      });
      const result = toTRPCError(original);
      expect(result).toBe(original);
    });

    it("should convert BusinessError to BAD_REQUEST TRPCError", () => {
      const biz = new BusinessError("Business rule violated");
      const result = toTRPCError(biz);
      expect(result).toBeInstanceOf(TRPCError);
      expect(result.code).toBe("BAD_REQUEST");
      expect(result.message).toBe("Business rule violated");
    });

    it("should convert generic Error to INTERNAL_SERVER_ERROR", () => {
      const err = new Error("Something broke");
      const result = toTRPCError(err);
      expect(result).toBeInstanceOf(TRPCError);
      expect(result.code).toBe("INTERNAL_SERVER_ERROR");
      expect(result.message).toBe("Something broke");
    });

    it("should convert unknown types to INTERNAL_SERVER_ERROR", () => {
      const result = toTRPCError("string error");
      expect(result).toBeInstanceOf(TRPCError);
      expect(result.code).toBe("INTERNAL_SERVER_ERROR");
      expect(result.message).toBe("string error");
    });
  });

  describe("logError", () => {
    it("should log structured errors", () => {
      const spy = vi.spyOn(logger, "error").mockImplementation(() => undefined);
      logError(new Error("boom"), { operation: "test" });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("withErrorLogging", () => {
    it("should return result when no error", async () => {
      const result = await withErrorLogging(async () => "ok");
      expect(result).toBe("ok");
    });

    it("should log and rethrow errors", async () => {
      const spy = vi.spyOn(logger, "error").mockImplementation(() => undefined);

      await expect(
        withErrorLogging(async () => {
          throw new Error("fail");
        }, { operation: "test" })
      ).rejects.toThrow("fail");

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
