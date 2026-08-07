/**
 * Category-specific angles: an extra sentence that threads the journal's
 * category into the "Gentle Suggestion" section. Keyed by journal category id.
 */
export const CATEGORY_ANGLE: Record<string, string[]> = {
  personal: [
    "Give yourself permission to keep part of today just for you.",
    "A small personal ritual today can ground the rest of your day.",
  ],
  academic: [
    "Break your next study block into a single five-minute start.",
    "Schedule your hardest subject for when your focus is sharpest.",
  ],
  wellness: [
    "Move your body for even five minutes today — it shifts your mood.",
    "Hydrate and rest well today; wellness builds from small consistent choices.",
  ],
  social: [
    "Reach out to someone you trust — connection is protective.",
    "A short, honest message to a friend can lighten any load.",
  ],
  goals: [
    "Take one tiny action toward your goal before the day ends.",
    "Revisit your goal and write down the very next step.",
  ],
  gratitude: [
    "Name one good thing that happened today and let it land.",
    "Tell someone you appreciate them — even briefly.",
  ],
  work: [
    "Close your work loop with one clear priority and a real break.",
    "Set a firm boundary around your time today.",
  ],
  spiritual: [
    "Carve out a few quiet minutes for reflection or prayer.",
    "Notice one moment of peace today and let it count.",
  ],
};

/** Time-of-day opener that leads the Mood Summary section. */
export const TIME_OPENERS: Record<string, string> = {
  morning: "Starting the day,",
  afternoon: "In the middle of the day,",
  evening: "As the day winds down,",
  night: "Late at night,",
};

/** Mood Summary suffix flavor based on how much the student wrote. */
export const LENGTH_FLAVOR: Record<string, string> = {
  brief: "You kept your reflection short today, and that's perfectly okay.",
  short: "You shared a compact reflection today, and it still counts.",
  long: "You gave today's feelings real space and detail.",
};

/**
 * A clause about the previous mood that appears when we have history:
 * appended to the encouragement to honor continuity.
 */
export const PREVIOUS_MOOD_CLAUSES: Record<string, string> = {
  different: "You noticed a shift from how you felt recently — that awareness is growth.",
  same: "You're staying honest with how you've been feeling — consistency is a form of courage.",
  none: "",
};

export const GENERAL_TIPS: string[] = [
  "Take a short walk outside — fresh air resets your perspective",
  "Drink a glass of water and step away from your screen for a few minutes",
  "Do one small thing you enjoy, even if it's only for ten minutes",
  "Try a few slow, deep breaths to settle your body and mind",
  "Write tomorrow one small, kind note to yourself",
  "Stretch your shoulders and neck — tension lives there",
  "Spend a few minutes in sunlight if you can",
  "Plan something small to look forward to later today or tomorrow",
  "Give your eyes a rest from screens and look at something far away",
  "Tidy one tiny corner of your space — order outside can calm the inside",
];
