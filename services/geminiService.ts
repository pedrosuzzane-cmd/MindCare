/**
 * Gemini AI service for analyzing journal entries and generating wellness suggestions.
 * Uses the @google/generative-ai SDK.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiApiKey } from "@/backend/config";

export interface GeminiAnalysis {
  emotion: string;
  summary: string;
  encouragement: string;
  suggestions: string[];
}

export interface JournalSuggestions {
  suggestions: {
    title: string;
    description: string;
    icon: string;
  }[];
}

const MODEL_NAME = "gemini-2.0-flash";

let genAI: GoogleGenerativeAI | null = null;

function getModel() {
  if (!genAI) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      if (__DEV__) console.warn("EXPO_PUBLIC_GEMINI_API_KEY is not set.");
      return null;
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI.getGenerativeModel({ model: MODEL_NAME });
}

/**
 * Calls Gemini with the given prompt and returns the raw response text.
 * Never throws - returns null on any failure.
 */
async function callGemini(prompt: string): Promise<string | null> {
  const model = getModel();
  if (!model) return null;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text) {
      if (__DEV__) console.warn("Gemini returned empty response");
      return null;
    }
    return text;
  } catch (err) {
    if (__DEV__) console.warn("Gemini API call failed:", err);
    return null;
  }
}

/**
 * Strips markdown code fences from Gemini response text and parses JSON.
 */
function parseJsonFromText<T>(text: string): T | null {
  try {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/```(?:json)?\n?/g, "").trim();
    }
    return JSON.parse(cleaned) as T;
  } catch (err) {
    if (__DEV__) console.warn("Failed to parse Gemini response as JSON:", err);
    return null;
  }
}

/**
 * Analyzes a single journal entry for emotion, summary, encouragement, and suggestions.
 * Used by the background AI analysis after saving a journal.
 */
export async function analyzeJournal(
  journalText: string,
): Promise<GeminiAnalysis | null> {
  const prompt = `Analyze this journal entry and return ONLY valid JSON with no markdown, no explanations, no code fences.

Journal: "${journalText.substring(0, 2000)}"

Required JSON format:
{
  "emotion": "one word describing the dominant emotion",
  "summary": "one sentence summary of the entry",
  "encouragement": "one sentence of encouragement",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}`;

  const text = await callGemini(prompt);
  if (!text) return null;

  const parsed = parseJsonFromText<GeminiAnalysis>(text);
  if (!parsed) return null;

  if (
    typeof parsed.emotion !== "string" ||
    typeof parsed.summary !== "string" ||
    typeof parsed.encouragement !== "string" ||
    !Array.isArray(parsed.suggestions)
  ) {
    if (__DEV__) console.warn("Gemini response missing required fields:", parsed);
    return null;
  }

  return {
    emotion: parsed.emotion || "",
    summary: parsed.summary || "",
    encouragement: parsed.encouragement || "",
    suggestions: parsed.suggestions.slice(0, 3),
  };
}

/**
 * Generates wellness suggestions based on journal entries.
 * This is the main function used by the Journal Suggestions screen.
 * Returns suggestions with title, description, and icon.
 * Never throws - returns null on any failure.
 */
export async function generateJournalSuggestions(
  journalText: string,
  mood: string,
): Promise<JournalSuggestions | null> {
  const prompt = `You are a wellness advisor analyzing a student's journal entries. Based on the following journal entries and mood patterns, provide 4-6 specific, actionable wellness suggestions.

Journal Entries Summary:
${journalText.substring(0, 3000)}

Dominant Mood: ${mood}

IMPORTANT GUIDELINES:
- Do NOT diagnose medical or mental health conditions
- Do NOT prescribe medication
- Do NOT claim to be a licensed professional
- Instead: encourage reflection, provide emotional support, recommend healthy habits, suggest coping techniques, recommend journaling prompts, recommend mindfulness exercises

Please respond in JSON format with this exact structure:
{
  "suggestions": [
    {
      "title": "Brief title",
      "description": "1-2 sentences with specific action",
      "icon": "emoji or icon name"
    }
  ]
}

IMPORTANT: Respond ONLY with valid JSON, no other text.`;

  const text = await callGemini(prompt);
  if (!text) return null;

  const parsed = parseJsonFromText<{ suggestions: { title: string; description: string; icon: string }[] }>(text);
  if (!parsed || !Array.isArray(parsed.suggestions)) {
    if (__DEV__) console.warn("Gemini suggestions response missing suggestions array:", parsed);
    return null;
  }

  return {
    suggestions: parsed.suggestions.slice(0, 6),
  };
}
