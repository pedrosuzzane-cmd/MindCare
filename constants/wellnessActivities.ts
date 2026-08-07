export interface WellnessActivity {
  title: string;
  icon: string;
}

export const MOOD_WELLNESS_ACTIVITIES: Record<string, WellnessActivity[]> = {
  happy: [
    { title: "Celebrate today's achievement", icon: "🎉" },
    { title: "Share gratitude with someone", icon: "🙏" },
    { title: "Pay your joy forward with a small kindness", icon: "💝" },
  ],
  calm: [
    { title: "Read for ten minutes", icon: "📚" },
    { title: "Sit quietly and follow your breath", icon: "🧘" },
    { title: "Sip a warm drink mindfully", icon: "🍵" },
  ],
  relaxed: [
    { title: "Enjoy a cozy, screen-free moment", icon: "🛋️" },
    { title: "Listen to music you love", icon: "🎶" },
    { title: "Take a gentle walk outside", icon: "🚶" },
  ],
  good: [
    { title: "Build on it — set one small intention", icon: "🌱" },
    { title: "Send a kind message to a friend", icon: "💬" },
    { title: "Use the energy for light movement", icon: "🏃" },
  ],
  neutral: [
    { title: "Check in with your energy levels", icon: "🔍" },
    { title: "Start one small task you've been avoiding", icon: "✅" },
    { title: "Try something slightly new today", icon: "🎯" },
  ],
  worried: [
    { title: "Try 4-7-8 breathing", icon: "🫁" },
    { title: "Write your worries down", icon: "✍️" },
    { title: "Ground yourself with your five senses", icon: "🌍" },
  ],
  sad: [
    { title: "Listen to relaxing music", icon: "🎧" },
    { title: "Contact someone you trust", icon: "📞" },
    { title: "Be gentle with yourself today", icon: "🫂" },
  ],
  overwhelmed: [
    { title: "Pause and take ten slow breaths", icon: "⏸️" },
    { title: "Break one task into tiny steps", icon: "📋" },
    { title: "Ask someone to help with one thing", icon: "🤲" },
  ],
  exhausted: [
    { title: "Rest for 20 minutes without guilt", icon: "😴" },
    { title: "Drink water and eat something nourishing", icon: "💧" },
    { title: "Step outside for fresh air", icon: "🌬️" },
  ],
  stressed: [
    { title: "Deep breathing for two minutes", icon: "🫁" },
    { title: "Drink a glass of water", icon: "💧" },
    { title: "Stretch for 60 seconds", icon: "🤸" },
  ],
  burnout: [
    { title: "Take a short walk", icon: "🚶" },
    { title: "Rest for 20 minutes", icon: "😴" },
    { title: "Step away from screens for an hour", icon: "📵" },
  ],
  "very-upset": [
    { title: "Reach out to someone you trust", icon: "📞" },
    { title: "Breathe slowly and name how you feel", icon: "🌬️" },
    { title: "Move to a quiet, safe space", icon: "🏠" },
  ],
};

const DEFAULT_ACTIVITIES: WellnessActivity[] = [
  { title: "Take a short walk", icon: "🚶" },
  { title: "Drink a glass of water", icon: "💧" },
  { title: "Practice slow breathing for two minutes", icon: "🌬️" },
];

/** Deterministic shuffle seeded by a string (stable within a day + mood). */
function seededShuffle<T>(arr: T[], seedStr: string): T[] {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  const a = [...arr];
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Returns a stable, randomized selection of wellness activities for a mood.
 * Seeded per day + mood so the list doesn't change on every refresh.
 */
export function getWellnessActivities(
  mood: string | undefined,
  count = 3,
): WellnessActivity[] {
  const pool =
    (mood && MOOD_WELLNESS_ACTIVITIES[mood]) || DEFAULT_ACTIVITIES;
  const seed = `${new Date().toDateString()}:${mood ?? "default"}`;
  return seededShuffle(pool, seed).slice(0, count);
}
