import type { JournalEntry, ReflectionSections } from "../journalService";
import { MOOD_PROFILES } from "./moods";
import type { MoodProfile } from "./moods";
import { detectTopics, getTopicLabel } from "./topicDetector";
import type { TopicScore } from "./topicDetector";
import { TOPIC_PROFILES } from "./reflectionGenerator";
import type { TopicProfile } from "./reflectionGenerator";
import { detectEmotion, empathyFor, detectStressLevel } from "./emotionAnalyzer";
import type { EmotionResult } from "./emotionAnalyzer";
import { detectSentiment } from "./sentimentAnalyzer";
import type { SentimentResult } from "./sentimentAnalyzer";
import { analyzeHistory } from "./historyAnalyzer";
import { generateWellnessTips } from "./suggestionGenerator";
import {
  CATEGORY_ANGLE,
  TIME_OPENERS,
  LENGTH_FLAVOR,
  PREVIOUS_MOOD_CLAUSES,
} from "./flavor";

export type { ReflectionSections };

export interface LocalReflection {
  sections: ReflectionSections;
  wellnessTips: string[];
}

export interface ReflectionInput {
  mood: string;
  category?: string | null;
  title?: string | null;
  thoughts: string;
  previousMood?: string | null;
  history?: JournalEntry[];
  now?: Date | string;
}

/** --- deterministic RNG so the same entry always yields the same reflection --- */

function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function sentence(text: string): string {
  const t = text.trim().replace(/[.!\s]+$/, "");
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1) + ".";
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

/** --- rules: part of day + length --- */

function partOfDay(now: Date): "morning" | "afternoon" | "evening" | "night" {
  const h = now.getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function lengthFlavor(text: string): string {
  const n = wordCount(text);
  if (n < 20) return LENGTH_FLAVOR.brief;
  if (n < 60) return LENGTH_FLAVOR.short;
  return LENGTH_FLAVOR.long;
}

/** Only list a secondary topic when it meaningfully shares the entry. */
const SECONDARY_MIN_CONFIDENCE = 0.15;

/**
 * The three-stage local reflection engine:
 *   1. detect topic (scored, with confidence)
 *   2. detect emotion + sentiment + stress (mood + text cues + intensity)
 *   3. generate a topic-led, emotion-aware reflection + wellness suggestions
 * Optionally uses the student's journal history for long-term personalization.
 * Never throws — always returns usable content.
 */
export function generateLocalReflection(input: ReflectionInput): LocalReflection {
  const now = input.now ? new Date(input.now) : new Date();
  const day = partOfDay(now);
  const seedBase = `${input.mood}|${input.category ?? ""}|${input.title ?? ""}|${(input.thoughts || "").slice(0, 200)}`;
  const rng = makeRng(hashSeed(seedBase));

  const moodProfile: MoodProfile = MOOD_PROFILES[input.mood] ?? MOOD_PROFILES.good;
  const topics: TopicScore[] = detectTopics(input.thoughts || "");
  const primary = topics[0];
  const secondary =
    topics[1] && topics[1].confidence >= SECONDARY_MIN_CONFIDENCE
      ? topics[1]
      : undefined;

  const primaryProfile: TopicProfile | undefined = primary
    ? TOPIC_PROFILES[primary.topic]
    : undefined;
  const secondaryProfile: TopicProfile | undefined = secondary
    ? TOPIC_PROFILES[secondary.topic]
    : undefined;

  const emotion: EmotionResult = detectEmotion(input.mood, input.thoughts || "");
  const sentiment: SentimentResult = detectSentiment(input.thoughts || "");
  const stressLevel = detectStressLevel({
    emotion: emotion.emotion,
    intensity: emotion.intensity,
    sentiment: sentiment.sentiment,
    sentimentScore: sentiment.score,
    text: input.thoughts || "",
  });
  const history = analyzeHistory(input.history ?? []);
  const opener = TIME_OPENERS[day] ?? TIME_OPENERS.night;
  const flavor = lengthFlavor(input.thoughts || "");

  // Stage 3a — Observation (topic-led, mood-led when no topic matched).
  const summary = primaryProfile
    ? `${opener} ${pick(rng, primaryProfile.observation)} ${flavor}`
    : `${opener} ${pick(rng, moodProfile.summary)} ${flavor}`;

  // Stage 3b — Positive observation (+ empathy when the text shifted emotion).
  const positiveBase = primaryProfile
    ? pick(rng, primaryProfile.positive)
    : pick(rng, moodProfile.positive);
  const positive = emotion.override
    ? `${positiveBase} ${empathyFor(emotion.emotion)}`
    : positiveBase;

  // Stage 3c — Gentle suggestion (topic-led, category + secondary + mood backfill).
  const suggestionParts = dedupe(
    [
      primaryProfile ? pick(rng, primaryProfile.suggestion) : undefined,
      input.category ? pick(rng, CATEGORY_ANGLE[input.category] ?? []) : undefined,
      secondaryProfile ? pick(rng, secondaryProfile.suggestion) : undefined,
      !primaryProfile ? pick(rng, moodProfile.suggestion) : undefined,
    ].filter((s): s is string => !!s),
  );
  const suggestion = suggestionParts.slice(0, 2).join(" ");

  // Stage 3d — Encouragement (+ patterns + secondary nod + previous-mood).
  const encouragementBase = primaryProfile
    ? pick(rng, primaryProfile.encouragement)
    : pick(rng, moodProfile.encouragement);
  const secondaryClause = secondary
    ? ` You also touched on ${getTopicLabel(secondary.topic).toLowerCase()} today — noticing both shows real self-awareness.`
    : "";
  const previousClause =
    input.previousMood && input.previousMood !== input.mood
      ? PREVIOUS_MOOD_CLAUSES.different
      : input.previousMood
        ? PREVIOUS_MOOD_CLAUSES.same
        : PREVIOUS_MOOD_CLAUSES.none;
  const historyClause = history.patterns[0]
    ? ` ${history.patterns[0]}`
    : "";
  const encouragement = `${encouragementBase}${secondaryClause}${
    previousClause ? ` ${previousClause}` : ""
  }${historyClause}`;

  const wellnessTips = generateWellnessTips(rng, {
    moodProfile,
    primaryProfile,
    secondaryProfile,
  });

  const sections: ReflectionSections = {
    summary: sentence(summary),
    positive: sentence(positive),
    suggestion: suggestion.trim(),
    encouragement: sentence(encouragement),
    topic: primary?.topic,
    topicLabel: primary ? getTopicLabel(primary.topic) : undefined,
    topicConfidence: primary
      ? Math.round(primary.confidence * 100)
      : undefined,
    secondaryTopic: secondary?.topic,
    secondaryTopicLabel: secondary
      ? getTopicLabel(secondary.topic)
      : undefined,
    secondaryTopicConfidence: secondary
      ? Math.round(secondary.confidence * 100)
      : undefined,
    emotion: emotion.emotion,
    emotionIntensity: emotion.intensity,
    sentiment: sentiment.sentiment,
    stressLevel,
    patterns: history.patterns,
  };

  return { sections, wellnessTips };
}

/** --- helpers for reading reflection data back out of an entry --- */

export function getActiveReflection(entry: JournalEntry): ReflectionSections | null {
  if (entry.reflectionAI) return entry.reflectionAI;
  if (entry.reflectionLocal) return entry.reflectionLocal;
  if (entry.reflection) {
    return {
      summary: entry.reflection,
      positive: "",
      suggestion: "",
      encouragement: "",
    };
  }
  return null;
}

/** Short one-line preview for cards/lists. */
export function getReflectionSummary(entry: JournalEntry): string | null {
  const active = getActiveReflection(entry);
  return active?.summary ?? null;
}

export function getReflectionStatusLabel(status?: string): string {
  switch (status) {
    case "gemini":
      return "AI Enhanced";
    case "local":
      return "Instant Reflection";
    default:
      return "";
  }
}

/** Deprecated alias kept for compatibility — returns detected topic ids. */
export function detectThemes(text: string, limit = 2): string[] {
  return detectTopics(text)
    .slice(0, limit)
    .map((t) => t.topic);
}

export { detectTopics, getTopicLabel, detectSentiment, analyzeHistory };
export type { SentimentResult } from "./sentimentAnalyzer";
export type { HistoryAnalysis } from "./historyAnalyzer";
export type { StressLevel } from "./emotionAnalyzer";

export {
  detectRisk,
  isHighRisk,
  isModerateOrHigher,
} from "./riskDetection";
export type { RiskResult, JournalRiskLevel } from "./riskDetection";
