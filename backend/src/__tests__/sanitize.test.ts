import { describe, it, expect } from "vitest";
import {
  sanitizeText,
  sanitizeNotes,
  sanitizeSearchQuery,
  escapeHtml,
  limitLength,
  sanitizeInput,
} from "../lib/sanitize.js";

describe("Sanitize Utilities", () => {
  describe("sanitizeText", () => {
    it("should return empty string for empty/null input", () => {
      expect(sanitizeText("")).toBe("");
      expect(sanitizeText(null as any)).toBe("");
      expect(sanitizeText(undefined as any)).toBe("");
    });

    it("should remove HTML tags", () => {
      expect(sanitizeText("<script>alert('xss')</script>")).toBe("alert('xss')");
      expect(sanitizeText("<b>bold</b>")).toBe("bold");
      expect(sanitizeText("<img src=x onerror=alert(1)>")).toBe("");
    });

    it("should remove javascript: protocol", () => {
      expect(sanitizeText("javascript:alert(1)")).toBe("alert(1)");
    });

    it("should remove event handlers", () => {
      expect(sanitizeText("onclick=alert(1)")).toBe("alert(1)");
      expect(sanitizeText("onload=fetch('evil')")).toBe("fetch('evil')");
    });

    it("should remove null bytes", () => {
      expect(sanitizeText("hello\0world")).toBe("helloworld");
    });

    it("should trim whitespace", () => {
      expect(sanitizeText("  hello  ")).toBe("hello");
    });

    it("should preserve normal text", () => {
      expect(sanitizeText("Tomate Italiano - R$ 7,80/kg")).toBe("Tomate Italiano - R$ 7,80/kg");
    });
  });

  describe("sanitizeNotes", () => {
    it("should return empty string for empty input", () => {
      expect(sanitizeNotes("")).toBe("");
    });

    it("should normalize line endings", () => {
      expect(sanitizeNotes("line1\r\nline2\rline3")).toBe("line1\nline2\nline3");
    });

    it("should collapse multiple newlines", () => {
      expect(sanitizeNotes("line1\n\n\n\n\nline2")).toBe("line1\n\nline2");
    });

    it("should remove HTML tags but preserve newlines", () => {
      expect(sanitizeNotes("<b>bold</b>\nnew line")).toBe("bold\nnew line");
    });
  });

  describe("sanitizeSearchQuery", () => {
    it("should return empty string for empty input", () => {
      expect(sanitizeSearchQuery("")).toBe("");
    });

    it("should remove regex special characters", () => {
      expect(sanitizeSearchQuery("tomate.*")).toBe("tomate");
      expect(sanitizeSearchQuery("price[0-9]+")).toBe("price0-9");
    });

    it("should collapse multiple spaces", () => {
      expect(sanitizeSearchQuery("tomate   italiano")).toBe("tomate italiano");
    });

    it("should remove HTML tags", () => {
      expect(sanitizeSearchQuery("<script>search</script>")).toBe("search");
    });

    it("should preserve normal search terms", () => {
      expect(sanitizeSearchQuery("banana nanica")).toBe("banana nanica");
    });
  });

  describe("escapeHtml", () => {
    it("should return empty string for empty input", () => {
      expect(escapeHtml("")).toBe("");
      expect(escapeHtml(null as any)).toBe("");
    });

    it("should escape ampersand", () => {
      expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
    });

    it("should escape angle brackets", () => {
      expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    });

    it("should escape quotes", () => {
      expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
      expect(escapeHtml("it's")).toBe("it&#039;s");
    });

    it("should escape all entities together", () => {
      expect(escapeHtml('<a href="x">&</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
    });
  });

  describe("limitLength", () => {
    it("should return empty string for empty input", () => {
      expect(limitLength("", 10)).toBe("");
      expect(limitLength(null as any, 10)).toBe("");
    });

    it("should not truncate short strings", () => {
      expect(limitLength("hello", 10)).toBe("hello");
    });

    it("should truncate long strings", () => {
      expect(limitLength("hello world", 5)).toBe("hello");
    });
  });

  describe("sanitizeInput", () => {
    it("should sanitize and limit length", () => {
      const long = "a".repeat(600);
      const result = sanitizeInput(long, { maxLength: 500 });
      expect(result).toHaveLength(500);
    });

    it("should remove newlines by default", () => {
      const result = sanitizeInput("line1\nline2");
      expect(result).not.toContain("\n");
      expect(result).toBe("line1 line2");
    });

    it("should allow newlines when option set", () => {
      const result = sanitizeInput("line1\nline2", {
        allowNewlines: true,
        trimWhitespace: false,
      });
      expect(result).toContain("\n");
    });

    it("should remove HTML tags", () => {
      const result = sanitizeInput("<b>bold</b> text");
      expect(result).toBe("bold text");
    });

    it("should use default maxLength of 500", () => {
      const long = "x".repeat(1000);
      const result = sanitizeInput(long);
      expect(result).toHaveLength(500);
    });
  });
});
