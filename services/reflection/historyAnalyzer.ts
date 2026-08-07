/**
 * History Analyzer (Local Engine Stage 6 — personalization over time).
 *
 * Once a student has several journals, we can surface real patterns from
 * their own history instead of generic sentences, e.g.:
 *   "Over the past three weeks, many of your journals have focused on
 *    academic deadlines. You also tend to feel calmer after writing about
 *    spending time with family."
 */
import type { JournalEntry } from "../journalService";
import { detectTopics, getTopicLabel } from "./topicDetector";

export interface HistoryAnalysis {
  patterns: string[];
}

const POSITIVE_MOODS = new Set(["happy", "calm", "relaxed", "good"]);

const MOOD_WORD: Record<string, string> = {
  happy: "happier",
  calm: "calmer",
  relaxed: "more relaxed",
  good: "better",
};

/** Only report a recurring topic once it covers a meaningful share. */
function recurringThreshold(historyLength: number): number {
  return Math.max(3, Math.ceil(historyLength * 0.3));
}

export function analyzeHistory(history: JournalEntry[]): HistoryAnalysis {
  if (!history || history.length === 0) return { patterns: [] };

  // Newest-first, keep the recent window.
  const window = [...history]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 20);

  const topicCounts = new Map<string, number>();
  const topicMoods = new Map<string, Map<string, number>>();

  for (const entry of window) {
    const topics = detectTopics(entry.thoughts || "");
    if (topics.length === 0) continue;
    const primary = topics[0].topic;
    topicCounts.set(primary, (topicCounts.get(primary) ?? 0) + 1);
    if (!topicMoods.has(primary)) topicMoods.set(primary, new Map());
    const moodMap = topicMoods.get(primary)!;
    moodMap.set(entry.mood, (moodMap.get(entry.mood) ?? 0) + 1);
  }

  const patterns: string[] = [];

  // Recurring topic pattern.
  const threshold = recurringThreshold(window.length);
  const recurring = [...topicCounts.entries()]
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  if (recurring.length > 0) {
    const oldest = window[window.length - 1];
    const now = new Date();
    const diffMs = now.getTime() - new Date(oldest.createdAt).getTime();
    const weeks = Math.max(
      1,
      Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)),
    );
    patterns.push(
      `Over the past ${weeks} week${weeks === 1 ? "" : "s"}, many of your journals have focused on ${getTopicLabel(recurring[0][0]).toLowerCase()}.`,
    );
  }

  // Mood-by-topic association pattern.
  let bestAssociation: { topic: string; mood: string; count: number } | null =
    null;
  for (const [topic, moodMap] of topicMoods.entries()) {
    let positiveTotal = 0;
    let bestMood = "";
    let bestCount = 0;
    for (const [mood, count] of moodMap.entries()) {
      if (POSITIVE_MOODS.has(mood)) positiveTotal += count;
      if (count > bestCount) {
        bestCount = count;
        bestMood = mood;
      }
    }
    const total = [...moodMap.values()].reduce((a, b) => a + b, 0);
    if (
      total >= 2 &&
      positiveTotal >= 2 &&
      bestMood &&
      MOOD_WORD[bestMood]
    ) {
      if (!bestAssociation || positiveTotal > bestAssociation.count) {
        bestAssociation = { topic, mood: bestMood, count: positiveTotal };
      }
    }
  }

  if (bestAssociation && patterns.length < 2) {
    patterns.push(
      `You also tend to feel ${MOOD_WORD[bestAssociation.mood]} after writing about ${getTopicLabel(bestAssociation.topic).toLowerCase()}.`,
    );
  }

  return { patterns };
}
