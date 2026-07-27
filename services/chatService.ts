/**
 * Chat service for Mindy.
 * All Gemini requests are routed through the backend at /api/chat.
 * The API key never touches the mobile frontend.
 */

import { API_URL } from "@/backend/config";

export interface ChatResponse {
  text: string;
}

const BASE_URL = API_URL.replace(/\/+$/, "");
const COLD_START_TIMEOUT = 90_000;
const RETRY_DELAY = 2_000;
const MAX_RETRIES = 1;

/**
 * Sends a message to Mindy via the backend proxy.
 * The backend handles Gemini initialization, system instruction, and multi-turn history.
 * Includes timeout, retry, and robust error handling for Render cold starts.
 */
export async function sendMessage(
  message: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[],
): Promise<ChatResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), COLD_START_TIMEOUT);

    try {
      const res = await fetch(`${BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: conversationHistory,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      let data: Record<string, unknown>;
      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (!res.ok) {
          throw new Error(
            `Server returned ${res.status}: ${text.slice(0, 200)}`,
          );
        }
        throw new Error(
          `Unexpected response format from server (${contentType.slice(0, 50)})`,
        );
      }

      if (!res.ok) {
        throw new Error(
          (data.error as string) || `Server error (${res.status})`,
        );
      }

      const reply = data.reply;
      if (typeof reply !== "string" || !reply.trim()) {
        throw new Error("Server returned an empty response.");
      }

      return { text: reply };
    } catch (err: unknown) {
      clearTimeout(timer);

      if (err instanceof Error && err.name === "AbortError") {
        lastError = new Error(
          "Request timed out. The server may be starting up — please try again in a moment.",
        );
      } else if (
        err instanceof Error &&
        (err.name === "TypeError" || err.message.toLowerCase().includes("network"))
      ) {
        lastError = new Error(
          "Network error. Please check your internet connection and try again.",
        );
      } else {
        lastError =
          err instanceof Error ? err : new Error("Unknown error occurred.");
      }

      if (__DEV__) console.warn(`Chat attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  throw lastError;
}
