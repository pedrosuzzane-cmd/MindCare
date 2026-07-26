/**
 * Centralized configuration for application constants.
 */

/**
 * The base URL for your backend API.
 * Replace this with your ngrok forwarding URL when running the backend locally.
 * Example: "https://2ab3-49-144-80-90.ngrok-free.app"
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://mindcare-api-wcqr.onrender.com";

/**
 * Reads the Gemini API key from environment variables.
 */
export function getGeminiApiKey(): string | null {
  return process.env.EXPO_PUBLIC_GEMINI_API_KEY || null;
}
