/**
 * Chat service for Mindy.
 * All Gemini requests are routed through the backend at /api/chat.
 * The API key never touches the mobile frontend.
 */

import { API_URL } from "@/backend/config";

export interface ChatResponse {
  text: string;
}

/**
 * Sends a message to Mindy via the backend proxy.
 * The backend handles Gemini initialization, system instruction, and multi-turn history.
 */
export async function sendMessage(
  message: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[],
): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history: conversationHistory,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to get response from Mindy.");
  }

  return { text: data.reply };
}
