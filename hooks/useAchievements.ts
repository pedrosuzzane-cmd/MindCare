import { auth, db } from "@/constants/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";

export type AchievementCategory =
  | "reflection"
  | "selfcare"
  | "consistency"
  | "wellness"
  | "growth";

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  description: string;
  requirement: string;
  category: AchievementCategory;
  target: number;
  reward: string;
}

export interface AchievementWithStatus extends Achievement {
  unlocked: boolean;
  unlockedAt?: Date;
  current: number; // count toward the target
}

export interface AchievementCategoryMeta {
  id: AchievementCategory | "all";
  label: string;
  emoji: string;
}

export const ACHIEVEMENT_CATEGORIES: AchievementCategoryMeta[] = [
  { id: "all", label: "All", emoji: "✨" },
  { id: "reflection", label: "Reflection", emoji: "📔" },
  { id: "selfcare", label: "Self-Care", emoji: "💜" },
  { id: "consistency", label: "Consistency", emoji: "🌱" },
  { id: "wellness", label: "Wellness", emoji: "🧘" },
  { id: "growth", label: "Growth", emoji: "🎯" },
];

/**
 * Journal-first achievement set. Every metric below is derived from the
 * student's own journal entries and self-assessments, and no achievement
 * rewards a "positive" mood over any other mood. Streak-style achievements
 * count total days journaled — a missed day never resets progress.
 */
const ALL_ACHIEVEMENTS: Achievement[] = [
  // 📔 Reflection — number of journal entries
  {
    id: "first-reflection",
    emoji: "🌱",
    title: "First Reflection",
    description: "You wrote your very first journal entry",
    requirement: "Write your first journal entry",
    category: "reflection",
    target: 1,
    reward: "🌰 Garden Seed",
  },
  {
    id: "journal-explorer",
    emoji: "📖",
    title: "Journal Explorer",
    description: "You wrote 5 journal entries",
    requirement: "Write 5 journal entries",
    category: "reflection",
    target: 5,
    reward: "🌱 Sprout",
  },
  {
    id: "reflective-mind",
    emoji: "🌿",
    title: "Reflective Mind",
    description: "You wrote 10 journal entries",
    requirement: "Write 10 journal entries",
    category: "reflection",
    target: 10,
    reward: "🌼 Wildflower",
  },
  {
    id: "deep-reflection",
    emoji: "🌳",
    title: "Deep Reflection",
    description: "You wrote 25 journal entries",
    requirement: "Write 25 journal entries",
    category: "reflection",
    target: 25,
    reward: "🌳 Tree",
  },
  {
    id: "reflection-journey",
    emoji: "🌸",
    title: "Reflection Journey",
    description: "You wrote 50 journal entries",
    requirement: "Write 50 journal entries",
    category: "reflection",
    target: 50,
    reward: "🪷 Lotus Pond",
  },

  // 💜 Self-Care — check-ins and returning gently
  {
    id: "self-care-champion",
    emoji: "💚",
    title: "Self-Care Champion",
    description: "You completed a self-assessment check-in",
    requirement: "Complete a self-assessment",
    category: "selfcare",
    target: 1,
    reward: "💧 Watering Can",
  },
  {
    id: "calm-moment",
    emoji: "🧘",
    title: "Calm Moment",
    description: "You completed 3 self-assessment check-ins",
    requirement: "Complete 3 self-assessments",
    category: "selfcare",
    target: 3,
    reward: "🪷 Lotus Bloom",
  },
  {
    id: "guardian-of-wellness",
    emoji: "💧",
    title: "Checked In With Myself",
    description: "You journaled and self-assessed on the same day",
    requirement: "Journal and self-assess on the same day",
    category: "selfcare",
    target: 1,
    reward: "🌤️ Sunny Day",
  },
  {
    id: "took-a-break",
    emoji: "🌤️",
    title: "Took a Break",
    description: "You came back to journaling after a week away",
    requirement: "Return to journaling after a 7+ day break",
    category: "selfcare",
    target: 1,
    reward: "🦋 Butterfly",
  },

  // 🌱 Consistency — total days journaled (no streaks, no resets)
  {
    id: "three-day-journey",
    emoji: "🌱",
    title: "3-Day Reflection Journey",
    description: "You journaled on 3 different days",
    requirement: "Journal on 3 different days",
    category: "consistency",
    target: 3,
    reward: "🌰 Seed Packet",
  },
  {
    id: "seven-day-journey",
    emoji: "🌿",
    title: "7-Day Reflection Journey",
    description: "You journaled on 7 different days",
    requirement: "Journal on 7 different days",
    category: "consistency",
    target: 7,
    reward: "🌱 Young Sprout",
  },
  {
    id: "fourteen-day-journey",
    emoji: "🌻",
    title: "14-Day Reflection Journey",
    description: "You journaled on 14 different days",
    requirement: "Journal on 14 different days",
    category: "consistency",
    target: 14,
    reward: "🌻 Sunflower",
  },
  {
    id: "one-month-reflection",
    emoji: "🌟",
    title: "30-Day Reflection Journey",
    description: "You journaled on 30 different days",
    requirement: "Journal on 30 different days",
    category: "consistency",
    target: 30,
    reward: "🌳 Blooming Tree",
  },

  // 🧘 Wellness — mindful habits and self-awareness
  {
    id: "emotional-explorer",
    emoji: "🌈",
    title: "Emotional Explorer",
    description: "You recorded 5 different moods",
    requirement: "Record 5 different moods",
    category: "wellness",
    target: 5,
    reward: "🌈 Rainbow Bridge",
  },
  {
    id: "monthly-reflection",
    emoji: "📅",
    title: "Monthly Reflection",
    description: "You journaled on 15 days in a single month",
    requirement: "Journal on 15 days in one month",
    category: "wellness",
    target: 15,
    reward: "🌙 Moon Gate",
  },
  {
    id: "night-owl-reflector",
    emoji: "🌙",
    title: "Quiet Evening",
    description: "You submitted a journal entry after 9:00 PM",
    requirement: "Submit a journal entry after 9:00 PM",
    category: "wellness",
    target: 1,
    reward: "🌙 Night Lantern",
  },
  {
    id: "early-bird-growth",
    emoji: "☀️",
    title: "Morning Reflection",
    description: "You submitted a journal entry before 8:00 AM",
    requirement: "Submit a journal entry before 8:00 AM",
    category: "wellness",
    target: 1,
    reward: "🌅 Sunrise",
  },

  // 🎯 Personal Growth — exploring different parts of your life
  {
    id: "category-explorer",
    emoji: "🧭",
    title: "Category Explorer",
    description: "You journaled about 3 different parts of your life",
    requirement: "Journal in 3 different categories",
    category: "growth",
    target: 3,
    reward: "🧭 Compass",
  },
  {
    id: "honest-reflection",
    emoji: "💜",
    title: "Honest Reflection",
    description: "You journaled about 5 different parts of your life",
    requirement: "Journal in 5 different categories",
    category: "growth",
    target: 5,
    reward: "🗝️ Golden Key",
  },
  {
    id: "goal-starter",
    emoji: "🎯",
    title: "Goal Starter",
    description: "You journaled about your goals on 3 different days",
    requirement: "Journal in the Goals category on 3 days",
    category: "growth",
    target: 3,
    reward: "🎯 Target Stone",
  },
];

function parseDate(value: any): Date | null {
  if (!value) return null;
  try {
    if (typeof value.toDate === "function") {
      const d = value.toDate();
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function useAchievements() {
  const [achievements, setAchievements] = useState<AchievementWithStatus[]>(
    ALL_ACHIEVEMENTS.map((a) => ({ ...a, unlocked: false, current: 0 })),
  );
  const [totalEarned, setTotalEarned] = useState(0);
  const [loading, setLoading] = useState(true);
  const unsubRefs = useRef<(() => void)[]>([]);
  const storedRef = useRef<Set<string>>(new Set());

  const computeAndUpdate = useCallback(async (uid: string) => {
    try {
      // Journal entries (with fallback on permission error)
      let entries: any[] = [];
      try {
        const entriesSnap = await getDocs(
          collection(db, "users", uid, "journalEntries"),
        );
        entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (readErr) {
        console.warn("Could not read journalEntries for achievements:", readErr);
      }

      // Self-assessments (with fallback on permission error)
      let assessmentCount = 0;
      const assessmentDates = new Set<string>();
      try {
        const assessmentsSnap = await getDocs(
          collection(db, "users", uid, "selfAssessments"),
        );
        assessmentCount = assessmentsSnap.size;
        assessmentsSnap.forEach((d) => {
          const data = d.data();
          const ts = data.createdAt || data.date || data.completedAt;
          const date = parseDate(ts);
          if (date) {
            assessmentDates.add(date.toISOString().slice(0, 10));
          }
        });
      } catch (readErr) {
        console.warn("Could not read selfAssessments for achievements:", readErr);
      }

      // Already-unlocked achievements from Firestore (preserve history)
      const existingBadges = new Map<string, Date>();
      try {
        const existingBadgesSnap = await getDocs(
          collection(db, "users", uid, "achievements"),
        );
        existingBadgesSnap.forEach((d) => {
          const data = d.data();
          const date = parseDate(data.unlockedAt);
          existingBadges.set(d.id, date || new Date());
        });
      } catch (readErr) {
        console.warn("Could not read achievements subcollection:", readErr);
      }

      // ── Metrics from journal entries ────────────────────────────────────
      const totalEntries = entries.length;

      const daysWithEntries = new Set<string>();
      const monthsToDays = new Map<string, Set<string>>();
      const distinctMoods = new Set<string>();
      const distinctCategories = new Set<string>();
      const goalsDays = new Set<string>();
      let nightEntryCount = 0;
      let morningEntryCount = 0;

      entries.forEach((e: any) => {
        const date = parseDate(e.entryDate || e.createdAt);
        if (!date) return;

        const dayKey = date.toISOString().slice(0, 10);
        const monthKey = dayKey.slice(0, 7);
        daysWithEntries.add(dayKey);
        if (!monthsToDays.has(monthKey)) monthsToDays.set(monthKey, new Set());
        monthsToDays.get(monthKey)!.add(dayKey);

        if (e.mood) distinctMoods.add(e.mood);
        if (e.category) distinctCategories.add(e.category);
        if (e.category === "goals") goalsDays.add(dayKey);

        const hours = date.getHours();
        if (hours >= 21) nightEntryCount++;
        if (hours < 8) morningEntryCount++;
      });

      const uniqueDays = daysWithEntries.size;
      const maxMonthDays = Array.from(monthsToDays.values()).reduce(
        (max, set) => Math.max(max, set.size),
        0,
      );

      // A "break" is a gap of 7+ days between two journal days.
      let breakReturns = 0;
      const sortedDays = Array.from(daysWithEntries).sort();
      for (let i = 1; i < sortedDays.length; i++) {
        const diff =
          (new Date(sortedDays[i]).getTime() -
            new Date(sortedDays[i - 1]).getTime()) /
          (1000 * 60 * 60 * 24);
        if (diff > 7) breakReturns++;
      }

      let sameDayJournalAndAssessment = 0;
      for (const dayKey of daysWithEntries) {
        if (assessmentDates.has(dayKey)) sameDayJournalAndAssessment++;
      }

      // ── Evaluate each achievement ───────────────────────────────────────
      const currentFor = (id: string): number => {
        switch (id) {
          case "first-reflection":
          case "journal-explorer":
          case "reflective-mind":
          case "deep-reflection":
          case "reflection-journey":
            return totalEntries;
          case "self-care-champion":
          case "calm-moment":
            return assessmentCount;
          case "guardian-of-wellness":
            return sameDayJournalAndAssessment;
          case "took-a-break":
            return breakReturns;
          case "three-day-journey":
          case "seven-day-journey":
          case "fourteen-day-journey":
          case "one-month-reflection":
            return uniqueDays;
          case "emotional-explorer":
            return distinctMoods.size;
          case "monthly-reflection":
            return maxMonthDays;
          case "night-owl-reflector":
            return nightEntryCount;
          case "early-bird-growth":
            return morningEntryCount;
          case "category-explorer":
          case "honest-reflection":
            return distinctCategories.size;
          case "goal-starter":
            return goalsDays.size;
          default:
            return 0;
        }
      };

      const results: AchievementWithStatus[] = ALL_ACHIEVEMENTS.map((a) => {
        const current = currentFor(a.id);
        const unlocked = current >= a.target;
        const existing = existingBadges.get(a.id);
        return {
          ...a,
          current,
          unlocked: unlocked || existing !== undefined,
          unlockedAt: existing || (unlocked ? new Date() : undefined),
        };
      });

      setAchievements(results);
      setTotalEarned(results.filter((r) => r.unlocked).length);
      setLoading(false);

      // Persist newly unlocked achievements so they survive across devices
      for (const ach of results) {
        if (ach.unlocked && !storedRef.current.has(ach.id) && uid) {
          try {
            await setDoc(
              doc(db, "users", uid, "achievements", ach.id),
              {
                title: ach.title,
                emoji: ach.emoji,
                description: ach.description,
                category: ach.category,
                unlockedAt: existingBadges.has(ach.id)
                  ? Timestamp.fromDate(existingBadges.get(ach.id)!)
                  : Timestamp.fromDate(new Date()),
              },
              { merge: true },
            );
            storedRef.current.add(ach.id);
          } catch (err) {
            console.error("Error storing achievement", err);
          }
        }
      }
    } catch (err) {
      console.error("Error computing achievements", err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Clean up listeners from any previous signed-in user
      unsubRefs.current.forEach((unsub) => unsub());
      unsubRefs.current = [];

      if (!user) {
        setAchievements(
          ALL_ACHIEVEMENTS.map((a) => ({ ...a, unlocked: false, current: 0 })),
        );
        setTotalEarned(0);
        setLoading(false);
        return;
      }

      storedRef.current.clear();
      computeAndUpdate(user.uid);

      // Recompute live when journal entries change
      const unsubEntries = onSnapshot(
        query(collection(db, "users", user.uid, "journalEntries")),
        () => computeAndUpdate(user.uid),
        () => {},
      );
      // Recompute live when self-assessments change
      const unsubAssessments = onSnapshot(
        query(collection(db, "users", user.uid, "selfAssessments")),
        () => computeAndUpdate(user.uid),
        () => {},
      );

      unsubRefs.current = [unsubEntries, unsubAssessments];
    });

    return () => {
      unsubAuth();
      unsubRefs.current.forEach((unsub) => unsub());
    };
  }, [computeAndUpdate]);

  return { achievements, totalEarned, loading };
}
