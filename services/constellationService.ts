import { db } from "@/constants/firebase";
import { constellationStorage } from "@/storage/constellationStorage";
import {
  ConstellationStar,
  StarPosition,
  StarSource,
} from "@/types/constellation";
import {
  CONSTELLATION_ID,
  STAR_BRIGHTNESS,
  STAR_SIZE_LABEL,
  nextStarPosition,
  selectJournalStarType,
} from "@/utils/constellationOptions";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";

/** Minimal journal info the constellation needs (journal content stays out). */
export interface StarJournalRef {
  id: string;
  category?: string;
  createdAt?: string;
}

/** Minimal achievement info needed to mint an achievement star. */
export interface StarAchievementRef {
  id: string;
  emoji?: string;
  title?: string;
  category?: string;
  unlockedAt?: Date;
}

const starIdFor = (journalId: string) => `star_${journalId}`;
const achievementStarIdFor = (achievementId: string) =>
  `star_ach_${achievementId}`;
const milestoneStarIdFor = (count: number) => `star_milestone_${count}`;

/**
 * Create a star for a newly saved journal.
 *
 * Idempotent by journalId: if a star already exists for this journal, no
 * duplicate is created. Returns the created star, or null when skipped.
 */
const createStarForJournal = async (
  userId: string,
  journal: StarJournalRef,
): Promise<ConstellationStar | null> => {
  const existing = await constellationStorage.getStars(userId);
  if (existing.some((s) => s.journalId === journal.id)) {
    return null;
  }

  const isGratitude = journal.category === "gratitude";
  const source: StarSource = isGratitude ? "gratitude" : "journal";
  const type = isGratitude
    ? "special"
    : selectJournalStarType(existing.length);
  const position: StarPosition = nextStarPosition(existing.length, journal.id);

  const star: ConstellationStar = {
    id: starIdFor(journal.id),
    studentId: userId,
    journalId: journal.id,
    type,
    size: STAR_SIZE_LABEL[type],
    brightness: STAR_BRIGHTNESS[type],
    position,
    source,
    constellationId: CONSTELLATION_ID[source],
    createdAt: journal.createdAt || new Date().toISOString(),
    syncStatus: "pending",
  };

  await constellationStorage.saveStar(userId, star);
  return star;
};

/**
 * Create a golden special star for an unlocked achievement.
 *
 * Idempotent by achievementId: unlocking the same achievement never creates a
 * duplicate. Achievement stars share the constellationStars subcollection with
 * journal stars, so the existing sync path handles them automatically.
 */
const createAchievementStar = async (
  userId: string,
  achievement: StarAchievementRef,
): Promise<ConstellationStar | null> => {
  const existing = await constellationStorage.getStars(userId);
  const starId = achievementStarIdFor(achievement.id);
  if (existing.some((s) => s.id === starId)) {
    return null;
  }

  const source: StarSource = "achievement";
  const position: StarPosition = nextStarPosition(existing.length, achievement.id);

  const star: ConstellationStar = {
    id: starId,
    studentId: userId,
    journalId: "",
    type: "special",
    size: STAR_SIZE_LABEL.special,
    brightness: STAR_BRIGHTNESS.special,
    position,
    source,
    constellationId: CONSTELLATION_ID[source],
    achievementId: achievement.id,
    createdAt: (achievement.unlockedAt ?? new Date()).toISOString(),
    syncStatus: "pending",
  };

  await constellationStorage.saveStar(userId, star);
  return star;
};

/**
 * Create a bright gold nova for a reached journal-count milestone.
 *
 * Idempotent by milestone count: each milestone mints at most one nova.
 */
const createMilestoneStar = async (
  userId: string,
  milestone: { count: number; createdAt?: string },
): Promise<ConstellationStar | null> => {
  const existing = await constellationStorage.getStars(userId);
  const starId = milestoneStarIdFor(milestone.count);
  if (existing.some((s) => s.id === starId)) {
    return null;
  }

  const source: StarSource = "milestone";
  const position: StarPosition = nextStarPosition(
    existing.length,
    `milestone_${milestone.count}`,
  );

  const star: ConstellationStar = {
    id: starId,
    studentId: userId,
    journalId: "",
    type: "special",
    size: STAR_SIZE_LABEL.special,
    brightness: STAR_BRIGHTNESS.special,
    position,
    source,
    constellationId: CONSTELLATION_ID[source],
    milestoneCount: milestone.count,
    createdAt: milestone.createdAt || new Date().toISOString(),
    syncStatus: "pending",
  };

  await constellationStorage.saveStar(userId, star);
  return star;
};

/**
 * Upload pending stars to Firestore and download any remote stars the local
 * device does not have yet (e.g., created on another device).
 */
const syncConstellationStars = async (userId: string): Promise<void> => {
  let localStars = await constellationStorage.getStars(userId);

  // 1. Upload pending stars
  const pending = localStars.filter((s) => s.syncStatus === "pending");
  if (pending.length > 0) {
    const batch = writeBatch(db);
    for (const star of pending) {
      const { id, studentId, syncStatus, ...firestoreData } = star;
      const docRef = doc(
        collection(db, "users", userId, "constellationStars"),
        id,
      );
      batch.set(docRef, {
        ...firestoreData,
        createdAt: firestoreData.createdAt,
        studentId: userId,
      });
    }
    batch.update(doc(db, "users", userId), {
      lastConstellationSyncAt: serverTimestamp(),
    });

    try {
      await batch.commit();
      for (const star of pending) {
        star.syncStatus = "synced";
        await constellationStorage.saveStar(userId, star);
      }
    } catch (error) {
      console.warn("Failed to upload constellation stars:", error);
      throw error;
    }
  }

  // 2. Download remote stars (best-effort)
  try {
    const remoteQuery = collection(db, "users", userId, "constellationStars");
    const remoteSnapshot = await getDocs(remoteQuery);
    localStars = await constellationStorage.getStars(userId);
    const localMap = new Map(localStars.map((s) => [s.id, s]));

    const merged = [...localStars];
    for (const remoteDoc of remoteSnapshot.docs) {
      const data = remoteDoc.data() as any;
      const local = localMap.get(remoteDoc.id);
      if (local) continue;

      const createdAt =
        typeof data.createdAt?.toDate === "function"
          ? data.createdAt.toDate().toISOString()
          : data.createdAt || new Date().toISOString();

      merged.push({
        id: remoteDoc.id,
        studentId: userId,
        journalId: data.journalId || remoteDoc.id.replace("star_", ""),
        type: data.type || "sparkle",
        size: data.size || "small",
        brightness: data.brightness || "soft",
        position: data.position || { x: 0.5, y: 0.5 },
        source: data.source || "journal",
        constellationId: data.constellationId || "reflection",
        achievementId: data.achievementId,
        milestoneCount: data.milestoneCount,
        createdAt,
        syncStatus: "synced",
      });
    }
    await constellationStorage.saveStars(userId, merged);
  } catch (error) {
    // Download failed (e.g., offline drop) — upload already succeeded.
    console.warn("Failed to download constellation stars:", error);
  }
};

export const constellationService = {
  createStarForJournal,
  createAchievementStar,
  createMilestoneStar,
  syncConstellationStars,
};
