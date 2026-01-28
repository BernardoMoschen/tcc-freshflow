/**
 * Input sanitization utilities for user-provided text.
 * Prevents XSS and other injection attacks.
 */

/**
 * Sanitize text input by removing potentially dangerous characters.
 * Preserves basic punctuation and formatting while removing HTML/script content.
 */
export function sanitizeText(input: string): string {
  if (!input || typeof input !== "string") return "";

  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, "")
    // Remove script-like content
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    // Remove null bytes
    .replace(/\0/g, "")
    // Trim whitespace
    .trim();
}

/**
 * Sanitize notes/comments that may contain newlines and basic formatting.
 * More permissive than sanitizeText but still safe.
 */
export function sanitizeNotes(input: string): string {
  if (!input || typeof input !== "string") return "";

  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, "")
    // Remove script-like content
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    // Remove null bytes
    .replace(/\0/g, "")
    // Normalize line endings
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Collapse multiple newlines
    .replace(/\n{3,}/g, "\n\n")
    // Trim whitespace while preserving internal structure
    .trim();
}

/**
 * Sanitize search query input.
 * Removes special characters that could cause issues with search.
 */
export function sanitizeSearchQuery(input: string): string {
  if (!input || typeof input !== "string") return "";

  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, "")
    // Remove regex special characters that could cause issues
    .replace(/[\\^$.*+?()[\]{}|]/g, "")
    // Remove null bytes
    .replace(/\0/g, "")
    // Collapse multiple spaces
    .replace(/\s+/g, " ")
    // Trim
    .trim();
}

/**
 * Escape HTML entities for safe display.
 * Use when you need to display user input as text.
 */
export function escapeHtml(input: string): string {
  if (!input || typeof input !== "string") return "";

  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  return input.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

/**
 * Validate and limit string length.
 * Returns truncated string if over maxLength.
 */
export function limitLength(input: string, maxLength: number): string {
  if (!input || typeof input !== "string") return "";
  return input.slice(0, maxLength);
}

/**
 * Combined sanitization for typical text fields.
 * Sanitizes, limits length, and returns clean output.
 */
export function sanitizeInput(
  input: string,
  options: {
    maxLength?: number;
    allowNewlines?: boolean;
    trimWhitespace?: boolean;
  } = {}
): string {
  const { maxLength = 500, allowNewlines = false, trimWhitespace = true } = options;

  let result = allowNewlines ? sanitizeNotes(input) : sanitizeText(input);

  if (!allowNewlines) {
    result = result.replace(/\n/g, " ");
  }

  if (trimWhitespace) {
    result = result.replace(/\s+/g, " ").trim();
  }

  return limitLength(result, maxLength);
}
