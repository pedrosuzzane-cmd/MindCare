/**
 * Centralized configuration for application constants.
 */

/**
 * The base URL for your backend API.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://mindcare-api-wcqr.onrender.com";

/**
 * Reads the Gemini API key from environment variables.
 */
export function getGeminiApiKey(): string | null {
  return process.env.EXPO_PUBLIC_GEMINI_API_KEY || null;
}
