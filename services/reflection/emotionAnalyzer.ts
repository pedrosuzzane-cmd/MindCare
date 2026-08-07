/**
 * Emotion Analysis (Layer 1 - Stage 2).
 *
 * Combines the SELECTED MOOD with emotional cues in the journal text to
 * produce a finer-grained emotion label and intensity (low / medium / high).
 */

export type EmotionIntensity = "low" | "medium" | "high";

export interface EmotionResult {
  emotion: string; // display label, e.g. "Frustrated"
  intensity: EmotionIntensity;
  /** true when text cues overrode the mood's base emotion */
  override: boolean;
}

/** Base emotion label for each selectable mood. */
const MOOD_EMOTION: Record<string, string> = {
  happy: "Happy",
  calm: "Calm",
  relaxed: "Relaxed",
  good: "Content",
  neutral: "Neutral",
  worried: "Worried",
  sad: "Sad",
  overwhelmed: "Overwhelmed",
  exhausted: "Exhausted",
  stressed: "Stressed",
  burnout: "Burnt Out",
  "very-upset": "Very Upset",
};

interface CueCategory {
  label: string;
  keywords: { pattern: string; weight: number }[];
}

const CUE_CATEGORIES: CueCategory[] = [
  {
    label: "Angry",
    keywords: [
      { pattern: "furious", weight: 5 },
      { pattern: "rage", weight: 5 },
      { pattern: "enraged", weight: 5 },
      { pattern: "angry", weight: 4 },
      { pattern: "mad", weight: 4 },
      { pattern: "resentful", weight: 4 },
      { pattern: "resentment", weight: 4 },
      { pattern: "hate", weight: 2 },
      { pattern: "annoyed", weight: 3 },
    ],
  },
  {
    label: "Frustrated",
    keywords: [
      { pattern: "infuriating", weight: 5 },
      { pattern: "fed up", weight: 5 },
      { pattern: "can't stand", weight: 5 },
      { pattern: "frustrating", weight: 4 },
      { pattern: "frustrated", weight: 4 },
      { pattern: "frustration", weight: 4 },
      { pattern: "annoying", weight: 3 },
      { pattern: "irritated", weight: 3 },
      { pattern: "irritating", weight: 3 },
      { pattern: "bothered", weight: 2 },
      { pattern: "unfair", weight: 3 },
      { pattern: "stuck", weight: 2 },
      { pattern: "tired of", weight: 2 },
    ],
  },
  {
    label: "Disappointed",
    keywords: [
      { pattern: "let down", weight: 5 },
      { pattern: "disappointed", weight: 4 },
      { pattern: "disappointing", weight: 4 },
      { pattern: "disappointment", weight: 4 },
      { pattern: "failed", weight: 3 },
      { pattern: "failure", weight: 3 },
      { pattern: "didn't work out", weight: 4 },
      { pattern: "didn't go as planned", weight: 4 },
      { pattern: "ruined", weight: 3 },
      { pattern: "cancelled", weight: 2 },
      { pattern: "canceled", weight: 2 },
    ],
  },
  {
    label: "Anxious",
    keywords: [
      { pattern: "terrified", weight: 5 },
      { pattern: "panicking", weight: 4 },
      { pattern: "panicked", weight: 4 },
      { pattern: "anxious", weight: 4 },
      { pattern: "anxiety", weight: 4 },
      { pattern: "dreading", weight: 4 },
      { pattern: "nervous", weight: 3 },
      { pattern: "on edge", weight: 4 },
      { pattern: "uneasy", weight: 3 },
      { pattern: "scared", weight: 3 },
      { pattern: "worried", weight: 2 },
      { pattern: "worries", weight: 2 },
    ],
  },
  {
    label: "Sad",
    keywords: [
      { pattern: "heartbroken", weight: 5 },
      { pattern: "devastated", weight: 5 },
      { pattern: "crying", weight: 3 },
      { pattern: "cried", weight: 3 },
      { pattern: "lonely", weight: 4 },
      { pattern: "loneliness", weight: 4 },
      { pattern: "miss", weight: 2 },
      { pattern: "missing", weight: 2 },
      { pattern: "hurt", weight: 2 },
      { pattern: "sad", weight: 2 },
      { pattern: "empty", weight: 2 },
      { pattern: "heartache", weight: 4 },
    ],
  },
  {
    label: "Overwhelmed",
    keywords: [
      { pattern: "overwhelmed", weight: 4 },
      { pattern: "overwhelming", weight: 4 },
      { pattern: "too much", weight: 3 },
      { pattern: "can't handle", weight: 4 },
      { pattern: "burnout", weight: 4 },
      { pattern: "burnt out", weight: 4 },
      { pattern: "burned out", weight: 4 },
      { pattern: "drowning", weight: 4 },
      { pattern: "stretched thin", weight: 4 },
    ],
  },
  {
    label: "Exhausted",
    keywords: [
      { pattern: "exhausted", weight: 4 },
      { pattern: "exhaustion", weight: 4 },
      { pattern: "so tired", weight: 4 },
      { pattern: "drained", weight: 4 },
      { pattern: "worn out", weight: 4 },
      { pattern: "fatigued", weight: 4 },
      { pattern: "no energy", weight: 4 },
    ],
  },
  {
    label: "Relieved",
    keywords: [
      { pattern: "relieved", weight: 5 },
      { pattern: "relief", weight: 4 },
      { pattern: "weight lifted", weight: 5 },
      { pattern: "finally over", weight: 4 },
      { pattern: "glad it's over", weight: 5 },
      { pattern: "what a relief", weight: 5 },
    ],
  },
  {
    label: "Excited",
    keywords: [
      { pattern: "thrilled", weight: 5 },
      { pattern: "can't wait", weight: 5 },
      { pattern: "so excited", weight: 5 },
      { pattern: "excited", weight: 4 },
      { pattern: "hyped", weight: 4 },
      { pattern: "looking forward", weight: 3 },
      { pattern: "pumped", weight: 4 },
      { pattern: "amazing", weight: 2 },
      { pattern: "awesome", weight: 3 },
      { pattern: "incredible", weight: 3 },
    ],
  },
  {
    label: "Grateful",
    keywords: [
      { pattern: "grateful", weight: 4 },
      { pattern: "thankful", weight: 4 },
      { pattern: "blessed", weight: 3 },
      { pattern: "appreciated", weight: 3 },
      { pattern: "appreciate", weight: 2 },
      { pattern: "so lucky", weight: 4 },
      { pattern: "can't thank", weight: 4 },
    ],
  },
];

const cueRegexCache: Record<string, RegExp> = {};
const cueWeightCache: Record<string, Map<string, number>> = {};

function cueRegex(label: string): RegExp {
  if (!cueRegexCache[label]) {
    const cat = CUE_CATEGORIES.find((c) => c.label === label)!;
    cueRegexCache[label] = new RegExp(
      `\\b(?:${cat.keywords.map((k) => k.pattern).join("|")})\\b`,
      "gi",
    );
  }
  return cueRegexCache[label];
}

function cueWeights(label: string): Map<string, number> {
  if (!cueWeightCache[label]) {
    const cat = CUE_CATEGORIES.find((c) => c.label === label)!;
    const map = new Map<string, number>();
    for (const k of cat.keywords) map.set(k.pattern.toLowerCase(), k.weight);
    cueWeightCache[label] = map;
  }
  return cueWeightCache[label];
}

/** Positive-ish base emotions that a weaker text cue can still refine. */
const LIGHT_BASE = new Set([
  "Happy",
  "Calm",
  "Relaxed",
  "Content",
  "Neutral",
]);

export function detectEmotion(mood: string, text: string): EmotionResult {
  const base = MOOD_EMOTION[mood] ?? "Neutral";

  const totals: { label: string; total: number }[] = [];
  for (const cat of CUE_CATEGORIES) {
    const regex = cueRegex(cat.label);
    const weights = cueWeights(cat.label);
    let total = 0;
    for (const match of text.matchAll(regex)) {
      total += weights.get(match[0].toLowerCase()) ?? 0;
    }
    if (total > 0) totals.push({ label: cat.label, total });
  }
  totals.sort((a, b) => b.total - a.total);

  let emotion = base;
  let override = false;

  const top = totals[0];
  if (top) {
    // A light base (positive/neutral) can be overridden by a moderate cue;
    // a stronger base emotion needs a strong cue to be overridden.
    const threshold = LIGHT_BASE.has(base) ? 3 : 5;
    if (top.total >= threshold) {
      emotion = top.label;
      override = true;
    }
  }

  // Intensity: cues + punctuation + caps + how much was written.
  let points = 0;
  if (top && top.total >= 8) points += 2;
  else if (top && top.total >= 5) points += 1;
  if (totals[1] && totals[1].total >= 3) points += 1;
  const exclaims = (text.match(/!/g) || []).length;
  if (exclaims >= 2) points += 1;
  if (/\b[A-Z]{2,}\b/.test(text)) points += 1;
  if (text.length > 200) points += 1;

  const intensity: EmotionIntensity =
    points >= 3 ? "high" : points >= 1 ? "medium" : "low";

  return { emotion, intensity, override };
}

/** Empathy sentence used when the text cue changed the emotion. */
export function empathyFor(emotion: string): string {
  return `It's completely understandable to feel ${emotion.toLowerCase()} in this situation.`;
}

export type StressLevel = "low" | "medium" | "high";

/** Emotions that inherently point to pressure. */
const STRESS_EMOTIONS = new Set([
  "Stressed",
  "Overwhelmed",
  "Anxious",
  "Burnt Out",
  "Exhausted",
  "Frustrated",
]);

const STRESS_KEYWORDS = [
  "deadline", "deadlines", "exam", "exams", "midterm", "midterms", "finals",
  "final exam", "pressure", "workload", "too much", "can't handle",
  "burnout", "boss", "meeting", "meetings", "due", "grades", "gpa",
  "money", "bills", "rent", "tuition", "loan", "loans", "debt", "debts",
  "interview", "interviews", "thesis", "project due", "presentation",
  "all-nighter", "panic", "overwhelmed",
];

const stressRegex = new RegExp(
  `\\b(?:${STRESS_KEYWORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "gi",
);

/**
 * Determines a coarse stress level from the analyzed emotion, sentiment
 * strength, and pressure-related keywords in the text.
 */
export function detectStressLevel(input: {
  emotion: string;
  intensity: EmotionIntensity;
  sentiment: "positive" | "negative" | "neutral";
  sentimentScore: number;
  text: string;
}): StressLevel {
  let points = 0;

  if (STRESS_EMOTIONS.has(input.emotion)) points += 2;
  if (input.intensity === "high") points += 1;
  if (input.sentiment === "negative" && Math.abs(input.sentimentScore) >= 3) {
    points += 1;
  }

  const hits = new Set<string>();
  for (const m of input.text.matchAll(stressRegex)) {
    hits.add(m[0].toLowerCase());
  }
  if (hits.size >= 6) points += 2;
  else if (hits.size >= 3) points += 1;

  if (points >= 4) return "high";
  if (points >= 2) return "medium";
  return "low";
}
