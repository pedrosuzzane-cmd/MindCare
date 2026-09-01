/**
 * Centralized numeric mood scoring and bucketing.
 *
 * The numeric 0–5 "wellness" value and the positive/neutral/distressed
 * classification were previously duplicated in `components/WellnessChart.tsx`
 * and `app/(admin)/analytics/stress-heatmap.tsx`. They are consolidated here so
 * the reporting system, charts, and heatmaps all agree on the same values.
 *
 * Mood is stored by string id; numeric scores are always derived at read time.
 */

/** Numeric wellness score (0–5) per mood id. */
export const MOOD_WELLNESS: Record<string, number> = {
  happy: 5,
  calm: 5,
  relaxed: 5,
  good: 4,
  neutral: 3,
  worried: 2,
  sad: 2,
  overwhelmed: 1,
  exhausted: 1,
  stressed: 0,
  burnout: 0,
  mad: 0,
  fearful: 1,
  flushed: 2,
  "very-upset": 0,
};

export const DEFAULT_MOOD_WELLNESS = 3;

export type MoodBucket = "positive" | "neutral" | "distressed";

const POSITIVE = new Set(["happy", "calm", "relaxed", "good"]);
const NEUTRAL = new Set(["neutral"]);

/** Numeric wellness score for a mood id (defaults to the neutral score). */
export function moodWellnessScore(mood: string | null | undefined): number {
  if (!mood) return DEFAULT_MOOD_WELLNESS;
  return MOOD_WELLNESS[mood.toLowerCase()] ?? DEFAULT_MOOD_WELLNESS;
}

/** Classifies a mood id into positive / neutral / distressed. */
export function moodBucket(mood: string | null | undefined): MoodBucket {
  const m = (mood ?? "").toLowerCase();
  if (POSITIVE.has(m)) return "positive";
  if (NEUTRAL.has(m)) return "neutral";
  return "distressed";
}

/** Average mood wellness score across a list of (possibly empty-weight) moods. */
export function avgMoodScore(moods: { mood?: string | null }[]): number {
  if (moods.length === 0) return 0;
  const sum = moods.reduce((acc, e) => acc + moodWellnessScore(e.mood), 0);
  return +(sum / moods.length).toFixed(2);
}
