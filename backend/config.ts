/**
 * Centralized configuration for application constants.
 */

/**
 * The base URL for your backend API.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://mindcare-api-wcqr.onrender.com";

/**
 * Emails that are always treated as Super Admins (mirrors the backend's
 * SUPER_ADMIN_EMAILS list). Keeps the Super Admin UI available even before
 * the custom claims have been set on the account.
 */
export const SUPER_ADMIN_EMAILS: string[] = (
  process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAILS || "mindcare932@gmail.com"
)
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * Reads the Gemini API key from environment variables.
 */
export function getGeminiApiKey(): string | null {
  return process.env.EXPO_PUBLIC_GEMINI_API_KEY || null;
}
