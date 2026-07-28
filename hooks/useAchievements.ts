import { auth, db } from "@/constants/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    setDoc,
    Timestamp,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  description: string;
  requirement: string;
}

export interface AchievementWithStatus extends Achievement {
  unlocked: boolean;
  unlockedAt?: Date;
  progress?: number; // 0-100 percentage
}

const ALL_ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-reflection",
    emoji: "🌱",
    title: "First Reflection",
    description: "You wrote your very first journal entry",
    requirement: "Write your first journal entry",
  },
  {
    id: "journal-explorer",
    emoji: "📖",
    title: "Journal Explorer",
    description: "You've written 7 journal entries",
    requirement: "Write 7 journal entries",
  },
  {
    id: "seven-day-streak",
    emoji: "🔥",
    title: "7-Day Journal Streak",
    description: "You journaled for 7 days in a row",
    requirement: "Journal 7 consecutive days",
  },
  {
    id: "positive-outlook",
    emoji: "🌞",
    title: "Positive Outlook",
    description: "You had 7 days with mostly positive moods",
    requirement: "7 days with positive moods (happy, calm, relaxed, good)",
  },
  {
    id: "self-care-champion",
    emoji: "💚",
    title: "Self-Care Champion",
    description: "You completed a self-assessment check-in",
    requirement: "Complete a self-assessment",
  },
  {
    id: "one-month-reflection",
    emoji: "🌸",
    title: "One Month of Reflection",
    description: "You've journaled on 30 different days",
    requirement: "Journal on 30 different days",
  },
  {
    id: "consistency-award",
    emoji: "⭐",
    title: "Consistency Award",
    description: "You wrote entries on at least 20 different days",
    requirement: "Journal on 20 different days",
  },
  {
    id: "wellness-goal-achieved",
    emoji: "🎯",
    title: "Wellness Goal Achieved",
    description: "You set and pursued a wellness goal",
    requirement: "Set a wellness goal in your profile survey",
  },
  {
    id: "first-step-forward",
    emoji: "🌱",
    title: "First Step Forward",
    description: "You wrote your very first daily journal entry",
    requirement: "Complete your first daily journal entry",
  },
  {
    id: "consistent-reflector",
    emoji: "🌿",
    title: "Consistent Reflector",
    description: "You completed journal entries for 3 consecutive days",
    requirement: "Journal for 3 consecutive days",
  },
  {
    id: "mindfulness-master",
    emoji: "🌳",
    title: "Mindfulness Master",
    description: "You maintained a 7-day journaling streak",
    requirement: "Maintain a 7-day journaling streak",
  },
  {
    id: "emotional-explorer",
    emoji: "🧭",
    title: "Emotional Explorer",
    description: "You logged entries covering 5 different moods",
    requirement: "Log entries with 5 different moods",
  },
  {
    id: "guardian-of-wellness",
    emoji: "🛡️",
    title: "Self-Care Champion",
    description: "You completed both a journal entry and a self-assessment on the same day",
    requirement: "Complete a journal entry and self-assessment on the same day",
  },
  {
    id: "night-owl-reflector",
    emoji: "🌙",
    title: "Night Owl Reflector",
    description: "You submitted a journal entry past 9:00 PM to unwind before sleep",
    requirement: "Submit a journal entry after 9:00 PM",
  },
  {
    id: "early-bird-growth",
    emoji: "☀️",
    title: "Early Bird Growth",
    description: "You submitted a morning journal entry before 8:00 AM",
    requirement: "Submit a journal entry before 8:00 AM",
  },
];

const POSITIVE_MOODS = ["happy", "calm", "relaxed", "good"];

export function useAchievements() {
  const [achievements, setAchievements] = useState<AchievementWithStatus[]>(
    ALL_ACHIEVEMENTS.map((a) => ({ ...a, unlocked: false, progress: 0 })),
  );
  const [totalEarned, setTotalEarned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const unsubSnapshotRef = useRef<(() => void) | null>(null);
  const unsubAuthRef = useRef<(() => void) | null>(null);

  // Track which achievements have been stored to firestore already
  const storedRef = useRef<Set<string>>(new Set());

  const computeAndUpdate = useCallback(async (uid: string) => {
    try {
      // Get user's journal entries (with fallback on permission error)
      let entries: any[] = [];
      try {
        const entriesSnap = await getDocs(
          collection(db, "users", uid, "journalEntries"),
        );
        entries = entriesSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
      } catch (readErr) {
        console.warn("Could not read journalEntries for achievements:", readErr);
      }

      // Get user's profile/hasWellnessGoal flag (with fallback)
      let userData: Record<string, any> = {};
      try {
        const userDoc = await getDoc(doc(db, "users", uid));
        userData = userDoc.exists() ? userDoc.data() : {};
      } catch (readErr) {
        console.warn("Could not read user doc for achievements:", readErr);
      }

      // Check if user completed a self-assessment (with fallback)
      let assessmentCount = 0;
      const assessmentDates = new Set<string>();
      try {
        const assessmentsSnap = await getDocs(
          collection(db, "users", uid, "selfAssessments"),
        );
        assessmentCount = assessmentsSnap.size;
        assessmentsSnap.forEach((d) => {
          const data = d.data();
          const ts = data.createdAt || data.date;
          if (ts && typeof ts.toDate === "function") {
            assessmentDates.add(ts.toDate().toISOString().slice(0, 10));
          } else if (ts) {
            assessmentDates.add(new Date(ts).toISOString().slice(0, 10));
          }
        });
      } catch (readErr) {
        console.warn("Could not read selfAssessments for achievements:", readErr);
      }

      // Get existing unlocked achievements from Firestore (with fallback)
      const existingBadges = new Map<string, Date>();
      try {
        const existingBadgesSnap = await getDocs(
          collection(db, "users", uid, "achievements"),
        );
        existingBadgesSnap.forEach((d) => {
          const data = d.data();
          existingBadges.set(d.id, data.unlockedAt?.toDate() || new Date());
        });
      } catch (readErr) {
        console.warn("Could not read achievements subcollection:", readErr);
      }

      // --- Compute metrics ---
      const totalEntries = entries.length;

      // Positive mood days
      const daysWithPositiveMood = new Set<string>();
      const daysWithEntries = new Set<string>();
      const datesSorted: Date[] = [];
      const distinctMoods = new Set<string>();
      let nightEntryCount = 0;
      let morningEntryCount = 0;

      entries.forEach((e: any) => {
        let date: Date;
        const ts = e.entryDate || e.createdAt;
        if (ts && typeof ts.toDate === "function") {
          date = ts.toDate();
        } else if (ts) {
          date = new Date(ts);
        } else {
          return;
        }

        const dateKey = date.toISOString().slice(0, 10);
        daysWithEntries.add(dateKey);
        datesSorted.push(date);

        if (e.mood) distinctMoods.add(e.mood);

        const hours = date.getHours();
        if (hours >= 21) nightEntryCount++;
        if (hours < 8) morningEntryCount++;

        if (POSITIVE_MOODS.includes(e.mood)) {
          daysWithPositiveMood.add(dateKey);
        }
      });

      // Sort dates for streak calculation
      datesSorted.sort((a, b) => a.getTime() - b.getTime());

      // Compute longest streak
      let currentStreak = 0;
      let longestStreak = 0;
      if (datesSorted.length > 0) {
        const uniqueDays = Array.from(daysWithEntries).sort();
        currentStreak = 1;
        longestStreak = 1;
        for (let i = 1; i < uniqueDays.length; i++) {
          const prev = new Date(uniqueDays[i - 1]);
          const curr = new Date(uniqueDays[i]);
          const diffDays =
            (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
          if (Math.round(diffDays) === 1) {
            currentStreak++;
            longestStreak = Math.max(longestStreak, currentStreak);
          } else {
            currentStreak = 1;
          }
        }
      }

      const uniqueDayCount = daysWithEntries.size;
      const positiveDayCount = daysWithPositiveMood.size;
      const distinctMoodCount = distinctMoods.size;

      // Count days with both a journal entry and a self-assessment
      let sameDayJournalAndAssessment = 0;
      for (const dayKey of daysWithEntries) {
        if (assessmentDates.has(dayKey)) sameDayJournalAndAssessment++;
      }

      // Has wellness goal from profile survey
      const hasWellnessGoal = Boolean(
        userData?.wellnessGoal || userData?.goals,
      );

      // --- Evaluate each achievement ---
      const results: AchievementWithStatus[] = ALL_ACHIEVEMENTS.map((a) => {
        let unlocked = false;
        let progress = 0;

        switch (a.id) {
          case "first-reflection":
            progress = Math.min(100, totalEntries * 100);
            unlocked = totalEntries >= 1;
            break;

          case "journal-explorer":
            progress = Math.min(100, (totalEntries / 7) * 100);
            unlocked = totalEntries >= 7;
            break;

          case "seven-day-streak":
            progress = Math.min(100, (longestStreak / 7) * 100);
            unlocked = longestStreak >= 7;
            break;

          case "positive-outlook":
            progress = Math.min(100, (positiveDayCount / 7) * 100);
            unlocked = positiveDayCount >= 7;
            break;

          case "self-care-champion":
            progress = Math.min(100, assessmentCount * 100);
            unlocked = assessmentCount >= 1;
            break;

          case "one-month-reflection":
            progress = Math.min(100, (uniqueDayCount / 30) * 100);
            unlocked = uniqueDayCount >= 30;
            break;

          case "consistency-award":
            progress = Math.min(100, (uniqueDayCount / 20) * 100);
            unlocked = uniqueDayCount >= 20;
            break;

          case "wellness-goal-achieved":
            unlocked = hasWellnessGoal;
            progress = hasWellnessGoal ? 100 : 0;
            break;

          case "first-step-forward":
            progress = Math.min(100, totalEntries * 100);
            unlocked = totalEntries >= 1;
            break;

          case "consistent-reflector":
            progress = Math.min(100, (longestStreak / 3) * 100);
            unlocked = longestStreak >= 3;
            break;

          case "mindfulness-master":
            progress = Math.min(100, (longestStreak / 7) * 100);
            unlocked = longestStreak >= 7;
            break;

          case "emotional-explorer":
            progress = Math.min(100, (distinctMoodCount / 5) * 100);
            unlocked = distinctMoodCount >= 5;
            break;

          case "guardian-of-wellness":
            progress = Math.min(100, sameDayJournalAndAssessment * 100);
            unlocked = sameDayJournalAndAssessment >= 1;
            break;

          case "night-owl-reflector":
            progress = Math.min(100, nightEntryCount * 100);
            unlocked = nightEntryCount >= 1;
            break;

          case "early-bird-growth":
            progress = Math.min(100, morningEntryCount * 100);
            unlocked = morningEntryCount >= 1;
            break;

          default:
            break;
        }

        const existing = existingBadges.get(a.id);
        return {
          ...a,
          unlocked: unlocked || existing !== undefined,
          unlockedAt: existing || (unlocked ? new Date() : undefined),
          progress: Math.round(progress),
        };
      });

      setAchievements(results);
      setTotalEarned(results.filter((r) => r.unlocked).length);
      setLoading(false);

      // Store newly unlocked achievements to Firestore
      for (const ach of results) {
        if (ach.unlocked && !storedRef.current.has(ach.id) && uid) {
          try {
            await setDoc(
              doc(db, "users", uid, "achievements", ach.id),
              {
                title: ach.title,
                emoji: ach.emoji,
                description: ach.description,
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
      if (!user) {
        setAchievements(
          ALL_ACHIEVEMENTS.map((a) => ({ ...a, unlocked: false, progress: 0 })),
        );
        setTotalEarned(0);
        setLoading(false);
        return;
      }

      setUserId(user.uid);
      storedRef.current.clear();

      // Compute on mount
      computeAndUpdate(user.uid);

      // Listen for changes to journal entries and re-compute
      const q = query(collection(db, "users", user.uid, "journalEntries"));
      const unsubSnapshot = onSnapshot(
        q,
        () => {
          computeAndUpdate(user.uid);
        },
        (snapshotErr) => {
          // Silently handle permissions errors so the achievements screen still works
          console.warn("onSnapshot error (journalEntries listener):", snapshotErr);
        },
      );

      unsubSnapshotRef.current = unsubSnapshot;
    });

    unsubAuthRef.current = unsubAuth;

    return () => {
      if (unsubSnapshotRef.current) {
        unsubSnapshotRef.current();
      }
      if (unsubAuthRef.current) {
        unsubAuthRef.current();
      }
    };
  }, [computeAndUpdate]);

  return { achievements, totalEarned, loading, userId };
}
