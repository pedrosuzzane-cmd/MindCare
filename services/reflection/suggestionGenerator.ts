/**
 * Suggestion Generator (Local Engine Stage 7).
 *
 * Produces the wellness suggestion tips paired with a reflection, drawing on
 * the detected topic, the student's mood, and general well-being suggestions.
 */
import type { MoodProfile } from "./moods";
import type { TopicProfile } from "./reflectionGenerator";
import { GENERAL_TIPS } from "./flavor";

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

export function generateWellnessTips(
  rng: () => number,
  opts: {
    moodProfile: MoodProfile;
    primaryProfile?: TopicProfile;
    secondaryProfile?: TopicProfile;
  },
): string[] {
  const { moodProfile, primaryProfile, secondaryProfile } = opts;
  const pool = [
    ...(primaryProfile ? primaryProfile.tips : []),
    ...(primaryProfile ? [] : moodProfile.tips),
    ...(secondaryProfile ? secondaryProfile.tips : []),
    ...shuffle(rng, GENERAL_TIPS),
  ];
  return dedupe(pool).slice(0, 3);
}
