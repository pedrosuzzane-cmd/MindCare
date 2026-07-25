/**
 * Chat service for the AI Wellness Chat.
 * Uses the existing backend proxy at /api/ai-proxy to call Gemini.
 * This keeps the API key secure on the server side.
 */

import { API_URL } from "@/backend/config";

export interface ChatResponse {
  text: string;
}

const SYSTEM_PROMPT = `You are MindCare AI, a supportive wellness companion for university students. Respond with empathy, encouragement, and practical coping strategies. Do not diagnose medical or mental health conditions, prescribe medication, or claim to be a licensed professional. If the user expresses thoughts of self-harm, suicide, or harming others, respond calmly, encourage them to seek immediate help from trusted people or local emergency services, and recommend professional support. Keep responses concise (under 200 words), warm, and conversational.`;

/**
 * Sends a message to the AI chat via the backend proxy.
 * The backend holds the Gemini API key securely.
 */
export async function sendMessage(
  message: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[],
): Promise<ChatResponse> {
  const fullPrompt = buildPrompt(message, conversationHistory);

  const response = await fetch(`${API_URL}/api/ai-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: fullPrompt,
      provider: "gemini",
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `API Error: ${response.status}`);
  }

  const data = await response.json();

  // The proxy returns the parsed JSON or raw text
  // If it's a suggestions object, extract the first suggestion as text
  if (data.suggestions && Array.isArray(data.suggestions)) {
    return { text: data.suggestions.join("\n\n") };
  }

  // If it returned a text field directly
  if (data.text) {
    return { text: data.text };
  }

  // Fallback: stringify whatever we got
  return { text: JSON.stringify(data) };
}

/**
 * Builds the full prompt with system instruction, conversation history, and user message.
 */
function buildPrompt(
  message: string,
  history: { role: "user" | "assistant"; content: string }[],
): string {
  const historyText = history
    .map((msg) => {
      const role = msg.role === "user" ? "Student" : "MindCare AI";
      return `${role}: ${msg.content}`;
    })
    .join("\n\n");

  return `${SYSTEM_PROMPT}

${historyText ? `Previous conversation:\n${historyText}\n\n` : ""}Student: ${message}

MindCare AI:`;
}

/**
 * Generates journal suggestions using the backend proxy.
 * This is a helper function that the Journal Suggestions screen can call.
 */
export async function generateJournalSuggestions(
  journalText: string,
  mood: string,
  assessment?: string,
): Promise<{
  reflection: string;
  encouragement: string;
  suggestions: string[];
}> {
  const assessmentContext = assessment
    ? `\nRecent Self-Assessment: ${assessment}`
    : "";

  const prompt = `You are MindCare AI, a supportive wellness companion for university students. Analyze this journal entry and provide a reflection, encouragement, and self-care suggestions.

Journal Entry:
${journalText}

Mood: ${mood}${assessmentContext}

Respond ONLY with valid JSON. No markdown, no code fences, no extra text.

{
  "reflection": "A 2-3 sentence compassionate reflection on what the student shared.",
  "encouragement": "A warm, uplifting message of encouragement.",
  "suggestions": ["Specific self-care suggestion 1", "Specific self-care suggestion 2", "Specific self-care suggestion 3"]
}`;

  const response = await fetch(`${API_URL}/api/ai-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      provider: "gemini",
    }),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  const data = await response.json();

  return {
    reflection: data.reflection || "Take a moment to reflect on your feelings.",
    encouragement:
      data.encouragement ||
      "You're doing great by taking care of your mental health.",
    suggestions: data.suggestions || [
      "Practice deep breathing for 5 minutes",
      "Take a short walk outside",
      "Write down three things you're grateful for",
    ],
  };
}
