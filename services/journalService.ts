import { journalStorage } from "@/storage/journalStorage";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import type { JournalRiskLevel } from "./reflection/riskDetection";

export type SyncStatus = "synced" | "pending" | "syncing" | "failed";

/**
 * Structured reflection with four sections. Each section is a short,
 * human-friendly paragraph. Empty strings mean "no content" for that section.
 * Topic/emotion fields describe what the engine detected, so each reflection
 * version is self-describing.
 */
export interface ReflectionSections {
  summary: string;
  positive: string;
  suggestion: string;
  encouragement: string;
  topic?: string;
  topicLabel?: string;
  topicConfidence?: number; // 0..100
  secondaryTopic?: string;
  secondaryTopicLabel?: string;
  secondaryTopicConfidence?: number; // 0..100
  emotion?: string;
  emotionIntensity?: "low" | "medium" | "high";
  sentiment?: "positive" | "negative" | "neutral";
  stressLevel?: "low" | "medium" | "high";
  patterns?: string[]; // long-term personalization sentences from history
}

export type ReflectionSource = "local" | "gemini" | "none";

export interface JournalEntry {
  id: string; // UUID, local identifier
  firestoreId?: string; // ID from Firestore after sync
  userId: string;
  title: string;
  thoughts: string;
  mood: string;
  category: string;
  reflection?: string; // Legacy single-string reflection (kept for backwards compatibility)
  reflectionLocal?: ReflectionSections; // Instant local engine output (Layer 1)
  reflectionAI?: ReflectionSections; // Reserved for background Gemini enhancement (Layer 3)
  reflectionStatus?: ReflectionSource; // Which reflection version is active
  reflectionSource?: ReflectionSource; // Where the active reflection came from
  generatedAt?: string; // ISO 8601 string of when the reflection was generated
  wellnessTips?: string[]; // Suggested activities paired with the reflection
  // ── Safety scanner metadata (computed locally on save) ─────────────────
  riskLevel?: JournalRiskLevel; // "low" | "moderate" | "high"
  riskScore?: number; // weighted count of risk phrases matched
  riskDetected?: boolean; // true when any risk phrase matched
  riskKeywords?: string[]; // matched phrases (never shown to admins as content)
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
  entryDate: string; // ISO 8601 string
  syncStatus: SyncStatus;
}

const getJournalEntries = async (userId: string): Promise<JournalEntry[]> => {
  const entries = await journalStorage.getEntries(userId);
  // Sort by date, newest first
  return entries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
};

const addJournalEntry = async (
  userId: string,
  data: Omit<JournalEntry, "id" | "syncStatus" | "userId" | "updatedAt">,
): Promise<JournalEntry> => {
  const now = new Date().toISOString();
  const newEntry: JournalEntry = {
    ...data,
    id: uuidv4(),
    userId,
    createdAt: now,
    updatedAt: now,
    syncStatus: "pending",
  };
  await journalStorage.saveEntry(userId, newEntry);
  return newEntry;
};

const updateJournalEntry = async (
  userId: string,
  updatedEntry: JournalEntry,
): Promise<JournalEntry> => {
  // Preserve the entry's updatedAt timestamp for accurate conflict resolution.
  // The caller (e.g., syncService) is responsible for managing timestamps.
  await journalStorage.saveEntry(userId, updatedEntry);
  return updatedEntry;
};

const updateEntries = async (
  userId: string,
  entries: JournalEntry[],
): Promise<void> => {
  await journalStorage.saveAllEntries(userId, entries);
};

const deleteJournalEntry = async (
  userId: string,
  entryId: string,
): Promise<void> => {
  await journalStorage.deleteEntry(userId, entryId);
};

export const journalService = {
  getJournalEntries,
  addJournalEntry,
  updateJournalEntry,
  updateEntries,
  deleteJournalEntry,
};
