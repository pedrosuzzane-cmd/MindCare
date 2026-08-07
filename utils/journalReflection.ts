import { JournalEntry } from "@/services/journalService";

export interface LocalReflection {
  insight: string;
  wellnessTips: string[];
}

interface MoodReflection {
  insight: string;
  tips: string[];
}

/**
 * Local reflection generator used while the Gemini API quota is exhausted.
 * Produces a warm, supportive reflection from the journal's mood and keywords
 * so students always receive feedback immediately after saving.
 */

const MOOD_REFLECTIONS: Record<string, MoodReflection> = {
  happy: {
    insight:
      "It's wonderful that your mood felt bright today. Savoring these good moments makes them last longer.",
    tips: [
      "Share your joy with someone close to you",
      "Write down one thing that made you happy today",
      "Celebrate yourself — you earned this good mood",
    ],
  },
  calm: {
    insight:
      "You found a sense of calm today, and that's a real achievement in a busy student life. Carry it gently into tomorrow.",
    tips: [
      "Notice what helped you feel calm and do more of it",
      "Take five slow breaths to keep the peace going",
      "Protect a few quiet minutes just for yourself",
    ],
  },
  relaxed: {
    insight:
      "Your writing shows a settled, easy energy today. That relaxed feeling is worth protecting.",
    tips: [
      "Keep a slot of unstructured time tomorrow",
      "Enjoy something low-pressure, like music or a favorite show",
      "Notice how relaxation shows up in your body",
    ],
  },
  good: {
    insight:
      "A good day deserves to be acknowledged. You took time to notice it, and that practice deepens your well-being.",
    tips: [
      "Build on this by setting one small positive intention",
      "Connect with someone — good feelings grow when shared",
      "Use the energy for a short walk or movement",
    ],
  },
  worried: {
    insight:
      "Worry takes real energy, and you showed up and wrote anyway — that takes strength. Let's make the worry feel more manageable.",
    tips: [
      "Try box breathing: inhale 4, hold 4, exhale 4, hold 4",
      "Write your worries down — naming them shrinks their power",
      "Focus only on what you can control today",
    ],
  },
  sad: {
    insight:
      "Sadness is a signal that something matters to you. Be gentle with yourself — you don't have to carry it alone.",
    tips: [
      "Let yourself feel without judgment; emotions pass like weather",
      "Reach out to someone who makes you feel safe",
      "Do one small comforting thing just for you",
    ],
  },
  overwhelmed: {
    insight:
      "Feeling overwhelmed means a lot is resting on your shoulders. You don't have to solve everything at once — one small step is enough for now.",
    tips: [
      "Pause and take ten slow breaths before anything else",
      "Write down everything on your mind, then pick ONE small thing",
      "Ask for help or delegate one task today",
    ],
  },
  exhausted: {
    insight:
      "Your energy was clearly running low today. Rest isn't a reward — it's how you refill. Honoring that is self-care.",
    tips: [
      "Give yourself 15–20 minutes of rest without guilt",
      "Drink a full glass of water and eat something nourishing",
      "Plan to sleep a little earlier tonight",
    ],
  },
  stressed: {
    insight:
      "Stress was present today, and naming it is the first step to easing it. Small, deliberate pauses can make today's load feel lighter.",
    tips: [
      "Try 4-7-8 breathing: inhale 4, hold 7, exhale 8",
      "Step away from the stressful situation for 5 minutes",
      "Do one task at a time — multitasking feeds stress",
    ],
  },
  burnout: {
    insight:
      "Burnout asks for recovery, not a quick fix. Taking this seriously and writing about it is a strong, caring choice.",
    tips: [
      "Cancel a non-essential commitment and truly rest",
      "Step away from screens for an hour today",
      "Reconnect with one thing that used to bring you joy",
    ],
  },
  "very-upset": {
    insight:
      "This sounds like it was a really hard day, and you were brave to put it into words. You don't have to face it alone.",
    tips: [
      "Reach out to someone you trust right now",
      "Move to a quiet, comfortable space and breathe slowly",
      "If you need support, a crisis helpline is always available",
    ],
  },
  neutral: {
    insight:
      "Thanks for taking time to reflect today. Every entry, no matter how it feels, helps you understand yourself better.",
    tips: [
      "Write down three small things that went okay today",
      "Take five slow breaths to check in with your body",
      "Set one gentle intention for tomorrow",
    ],
  },
};

interface KeywordPattern {
  test: RegExp;
  insight: string;
  tips: string[];
}

const KEYWORD_PATTERNS: KeywordPattern[] = [
  {
    test: /\b(exam|test|quiz|homework|assignment|deadline|thesis|research|review|study|school|class|grade|pass|fail|semester)\b/i,
    insight:
      "You're carrying a lot around academics right now — naming that is the first step to managing it.",
    tips: [
      "Break one task into a tiny 5-minute step and start there",
      "Plan a short break after each study block to protect your energy",
      "Remind yourself that one assignment doesn't define your worth",
    ],
  },
  {
    test: /\b(friend|friends|family|boyfriend|girlfriend|partner|relationship|roommate|group|alone|lonely|social)\b/i,
    insight:
      "The people in your life are clearly shaping how you feel — it matters that you're noticing that.",
    tips: [
      "Reach out to someone you trust and simply say hello",
      "Write down one small way you'd like to be supported",
      "Spend time with people who leave you feeling lighter",
    ],
  },
  {
    test: /\b(sleep|tired|exhaust|insomnia|wake|rest|fatigue|nap|awake)\b/i,
    insight:
      "Your energy levels came through clearly in your writing — rest is a need, not a luxury.",
    tips: [
      "Put screens away 30 minutes before bed tonight",
      "Drink a glass of water — fatigue often hides dehydration",
      "Give yourself permission to rest without guilt",
    ],
  },
  {
    test: /\b(worried|anxious|anxiety|nervous|afraid|scared|panic|overthink|stress)\b/i,
    insight:
      "Worry is exhausting, and you still showed up to write — that takes real strength.",
    tips: [
      "Try 4-7-8 breathing: inhale 4, hold 7, exhale 8",
      "Write your worries down to see them more clearly",
      "Focus only on what you can control today",
    ],
  },
  {
    test: /\b(sad|down|depress|cry|tears|empty|hopeless|heartbreak|grief|missing|lost)\b/i,
    insight:
      "Sadness is a signal that something matters deeply to you — be gentle with yourself today.",
    tips: [
      "Let yourself feel without judgment; emotions are visitors",
      "Reach out to someone who makes you feel safe",
      "Do one small comforting thing just for you",
    ],
  },
  {
    test: /\b(work|job|boss|colleague|project|meeting|overtime|career|interview)\b/i,
    insight:
      "Work is taking up a lot of mental space right now — that's worth acknowledging rather than pushing away.",
    tips: [
      "Set a firm end-of-day time and honor it",
      "List your top three priorities and let the rest wait",
      "Take a real break away from the screen today",
    ],
  },
  {
    test: /\b(grateful|gratitude|thankful|blessed|appreciat|thank you)\b/i,
    insight:
      "You're practicing gratitude actively — that's a powerful habit that builds resilience over time.",
    tips: [
      "Write down three small things that went well today",
      "Share one thing you're grateful for with someone",
      "Revisit this entry on a harder day",
    ],
  },
  {
    test: /\b(myself|self|courage|strong|proud|accomplish|succeed|achievement|progress)\b/i,
    insight:
      "You recognized something about your own strength or growth — that self-awareness is worth honoring.",
    tips: [
      "Name one thing you did well today and own it",
      "Write a short note of encouragement to yourself",
      "Remember that small progress is still progress",
    ],
  },
];

const GENERAL_TIPS = [
  "Take a short walk to reset your mind",
  "Drink a glass of water",
  "Practice slow breathing for two minutes",
  "Write down three things you're grateful for",
  "Step away from screens for a few minutes",
];

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items));
}

/**
 * Generates a supportive reflection locally using the entry's mood,
 * title, and thoughts. Never throws — always returns usable content.
 */
export function generateLocalReflection(
  entry: Pick<JournalEntry, "mood" | "thoughts" | "title">,
): LocalReflection {
  const mood = MOOD_REFLECTIONS[entry.mood] || MOOD_REFLECTIONS.neutral;
  const text = `${entry.title ?? ""} ${entry.thoughts ?? ""}`;
  const hits = KEYWORD_PATTERNS.filter((p) => p.test.test(text));

  const moodSentence = mood.insight.trim();
  const keywordSentence = hits[0]?.insight?.trim();
  const encouragement =
    "Remember that even small progress is meaningful — keep showing up for yourself.";
  const insight = [moodSentence, keywordSentence, encouragement]
    .filter(Boolean)
    .join(" ");

  const tips = dedupe([...mood.tips, ...hits.flatMap((h) => h.tips)]);
  while (tips.length < 3) {
    const extra = GENERAL_TIPS.filter((t) => !tips.includes(t));
    if (extra.length === 0) break;
    tips.push(extra[0]);
  }

  return {
    insight,
    wellnessTips: tips.slice(0, 3),
  };
}
