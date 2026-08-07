/**
 * Keyword analysis utilities for the local safety scanner.
 *
 * Text is normalized to lowercase, stripped of punctuation, and whitespace
 * collapsed before matching so phrases like "I want to die!!" or "No one
 * cares..." are still detected.
 */

/** Normalize text: lowercase, strip punctuation, collapse whitespace. */
export function normalizeRiskText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize a keyword phrase the same way as the input text. */
export function normalizeKeyword(keyword: string): string {
  return keyword
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns the list of keyword phrases (in the order they were provided) that
 * appear in the normalized text. Matches are case-insensitive and account for
 * punctuation because both sides are normalized.
 */
export function matchKeywords(
  text: string,
  keywords: string[],
): string[] {
  const normalized = normalizeRiskText(text);
  if (!normalized) return [];
  const seen = new Set<string>();
  const matches: string[] = [];
  for (const keyword of keywords) {
    const key = normalizeKeyword(keyword);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (normalized.includes(` ${key} `) || normalized.startsWith(`${key} `) || normalized.endsWith(` ${key}`) || normalized === key) {
      matches.push(keyword);
    }
  }
  return matches;
}
