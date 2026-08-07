export const ENCOURAGEMENTS: string[] = [
  "Progress is made one day at a time.",
  "Every journal is a step toward understanding yourself.",
  "It's okay to have difficult days.",
  "Your feelings deserve to be heard.",
  "Celebrate every small victory.",
  "Small steps still move you forward.",
  "Be as kind to yourself as you would be to a friend.",
  "Noticing how you feel is a superpower.",
  "You are stronger than you think.",
  "Growth happens quietly, day by day.",
];

/**
 * Returns one encouragement, randomized once per calendar day.
 * Seeded by the date so it stays stable across re-renders.
 */
export function getTodaysEncouragement(now: Date = new Date()): string {
  const seed = now.toDateString();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return ENCOURAGEMENTS[hash % ENCOURAGEMENTS.length];
}
