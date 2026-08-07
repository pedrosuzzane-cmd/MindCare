/**
 * Sentiment Analyzer (Local Engine Stage 4).
 *
 * Lightweight, negation-aware sentiment scoring over the journal text.
 * Produces a simple positive / negative / neutral label plus a numeric score
 * so downstream stages (stress level) can gauge strength.
 */

export type Sentiment = "positive" | "negative" | "neutral";

export interface SentimentResult {
  sentiment: Sentiment;
  score: number; // positive = more positive words, negative = more negative
}

const POSITIVE_WORDS = [
  "good", "great", "happy", "glad", "joy", "joyful", "joyous", "enjoyed",
  "enjoying", "love", "loved", "lovely", "wonderful", "amazing", "awesome",
  "fantastic", "nice", "excited", "exciting", "grateful", "thankful",
  "blessed", "proud", "better", "hopeful", "relieved", "relaxed", "calm",
  "peaceful", "fun", "beautiful", "success", "successful", "win", "won",
  "passed", "achieved", "accomplished", "felt good", "feel good", "content",
  "favorite", "together", "warm", "comforting", "delicious", "cozy",
  "delightful", "cherish", "cherished", "bonding",
];

const NEGATIVE_WORDS = [
  "sad", "bad", "angry", "mad", "frustrated", "frustrating", "frustration",
  "disappointed", "disappointing", "anxious", "anxiety", "scared", "afraid",
  "stressed", "stress", "stressful", "overwhelmed", "overwhelming", "worried",
  "worry", "worries", "tired", "exhausted", "drained", "lonely", "alone",
  "hurt", "cried", "crying", "tears", "terrible", "horrible", "awful",
  "miserable", "depressed", "down", "failed", "failure", "missed", "lost",
  "sick", "hate", "annoyed", "annoying", "irritated", "irritating", "panic",
  "dread", "dreading", "hopeless", "helpless", "nervous", "unfair", "hard",
  "difficult", "upset", "heartbroken", "breakup", "insomnia", "exhaustion",
];

const NEGATOR_WORDS = new Set([
  "not", "never", "no", "dont", "don't", "doesnt", "doesn't", "didnt",
  "didn't", "isnt", "isn't", "wasnt", "wasn't", "werent", "weren't",
  "couldnt", "couldn't", "wouldnt", "wouldn't", "without", "barely",
  "hardly",
]);

function isNegated(text: string, idx: number): boolean {
  const before = text.slice(0, idx).trimEnd();
  if (!before) return false;
  const words = before.split(/\s+/).slice(-3);
  return words.some((w) =>
    NEGATOR_WORDS.has(w.toLowerCase().replace(/[^a-z']/g, "")),
  );
}

function scoreWords(text: string, words: string[], polarity: 1 | -1): number {
  let total = 0;
  const seen = new Set<string>();
  for (const word of words) {
    if (seen.has(word)) continue;
    seen.add(word);
    const re = new RegExp(`\\b${word}\\b`, "gi");
    for (const match of text.matchAll(re)) {
      const negated = isNegated(text, match.index ?? 0);
      total += negated ? -polarity : polarity;
    }
  }
  return total;
}

export function detectSentiment(text: string): SentimentResult {
  const positive = scoreWords(text, POSITIVE_WORDS, 1);
  const negative = scoreWords(text, NEGATIVE_WORDS, -1);
  const score = positive + negative;

  const sentiment: Sentiment =
    score > 0 ? "positive" : score < 0 ? "negative" : "neutral";

  return { sentiment, score };
}
