import type { JournalEntry } from "../../services/journalService";
import { MOOD_PROFILES } from "./moods";
import type { MoodProfile } from "./moods";
import { THEME_PROFILES, THEME_KEYWORDS } from "./themes";
import type { ThemeProfile } from "./themes";
import {
  CATEGORY_ANGLE,
  TIME_OPENERS,
  LENGTH_FLAVOR,
  PREVIOUS_MOOD_CLAUSES,
  GENERAL_TIPS,
} from "./flavor";

export interface ReflectionSections {
  summary: string;
  positive: string;
  suggestion: string;
  encouragement: string;
}

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

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** --- rules: theme detection, part of day, length --- */

export function detectThemes(thoughts: string, limit = 2): string[] {
  const hits: { theme: string; count: number }[] = [];
  for (const theme of Object.keys(THEME_KEYWORDS)) {
    const matches = thoughts.match(THEME_KEYWORDS[theme]);
    if (matches) hits.push({ theme, count: matches.length });
  }
  hits.sort((a, b) => b.count - a.count);
  return hits.slice(0, limit).map((h) => h.theme);
}

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

/** --- main engine: never throws, always returns a usable reflection --- */

export function generateLocalReflection(input: ReflectionInput): LocalReflection {
  const now = input.now ? new Date(input.now) : new Date();
  const day = partOfDay(now);
  const seedBase = `${input.mood}|${input.category ?? ""}|${input.title ?? ""}|${(input.thoughts || "").slice(0, 200)}`;
  const rng = makeRng(hashSeed(seedBase));

  const moodProfile: MoodProfile = MOOD_PROFILES[input.mood] ?? MOOD_PROFILES.good;
  const themes = detectThemes(input.thoughts || "", 2);
  const primary = themes[0];
  const themeProfile: ThemeProfile | undefined = primary ? THEME_PROFILES[primary] : undefined;
  const fallbackTheme = themes[1] ? THEME_PROFILES[themes[1]] : undefined;

  const opener = TIME_OPENERS[day] ?? TIME_OPENERS.night;
  const flavor = lengthFlavor(input.thoughts || "");

  const summaryPool = [
    ...(themeProfile ? themeProfile.summary : []),
    ...moodProfile.summary,
  ];
  const summary = `${opener} ${pick(rng, summaryPool)} ${flavor}`;

  const positivePool = [
    ...(themeProfile ? themeProfile.positive : []),
    ...moodProfile.positive,
  ];
  const positive = pick(rng, positivePool);

  const themeAngle = themeProfile ? pick(rng, themeProfile.suggestion) : undefined;
  const moodAngle = pick(rng, moodProfile.suggestion);
  const categoryAngle = input.category ? pick(rng, CATEGORY_ANGLE[input.category] ?? []) : undefined;
  const fallbackAngle = fallbackTheme ? pick(rng, fallbackTheme.suggestion) : undefined;

  const suggestion = dedupe(
    [themeAngle, moodAngle, categoryAngle, fallbackAngle].filter((s): s is string => !!s)
  )
    .slice(0, 2)
    .join(" ");

  const encouragementPool = [
    ...(themeProfile ? themeProfile.encouragement : []),
    ...moodProfile.encouragement,
  ];
  const previousClause =
    input.previousMood && input.previousMood !== input.mood
      ? PREVIOUS_MOOD_CLAUSES.different
      : input.previousMood
        ? PREVIOUS_MOOD_CLAUSES.same
        : PREVIOUS_MOOD_CLAUSES.none;
  const encouragement = `${pick(rng, encouragementPool)}${previousClause ? ` ${previousClause}` : ""}`;

  const tipsPool = [
    ...(themeProfile ? themeProfile.tips : []),
    ...moodProfile.tips,
    ...(categoryAngle ? [categoryAngle] : []),
    ...shuffle(rng, GENERAL_TIPS),
  ];
  const wellnessTips = dedupe(tipsPool).slice(0, 3);

  return {
    sections: {
      summary: sentence(summary),
      positive: sentence(positive),
      suggestion: suggestion.trim(),
      encouragement: sentence(encouragement),
    },
    wellnessTips,
  };
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
