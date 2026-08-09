import AsyncStorage from "@react-native-async-storage/async-storage";

const getStorageKey = (userId: string) =>
  `@MindCare:constellation_celebrated_${userId}`;

/**
 * Tracks which constellation milestones have already been celebrated for a
 * user, so the unlock celebration appears once per milestone instead of on
 * every screen visit. This is separate from the achievements system — the
 * milestone progression (First Light, Growing Sky, …) is its own reward layer
 * and deliberately never writes achievement records.
 */
const getCelebratedMilestones = async (userId: string): Promise<number[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(getStorageKey(userId));
    const parsed = jsonValue != null ? JSON.parse(jsonValue) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to load celebrated constellation milestones.", e);
    return [];
  }
};

const markMilestoneCelebrated = async (
  userId: string,
  count: number,
): Promise<void> => {
  try {
    const current = new Set(await getCelebratedMilestones(userId));
    if (current.has(count)) return;
    current.add(count);
    await AsyncStorage.setItem(
      getStorageKey(userId),
      JSON.stringify([...current]),
    );
  } catch (e) {
    console.error("Failed to mark constellation milestone celebrated.", e);
  }
};

const getMonthStorageKey = (userId: string) =>
  `@MindCare:constellation_months_celebrated_${userId}`;

/**
 * Tracks which monthly constellations ("2026-08") have already shown their
 * completion celebration, so a finished month is announced exactly once.
 */
const getCelebratedMonths = async (userId: string): Promise<string[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(getMonthStorageKey(userId));
    const parsed = jsonValue != null ? JSON.parse(jsonValue) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to load celebrated constellation months.", e);
    return [];
  }
};

const markMonthCelebrated = async (
  userId: string,
  monthKey: string,
): Promise<void> => {
  try {
    const current = new Set(await getCelebratedMonths(userId));
    if (current.has(monthKey)) return;
    current.add(monthKey);
    await AsyncStorage.setItem(
      getMonthStorageKey(userId),
      JSON.stringify([...current]),
    );
  } catch (e) {
    console.error("Failed to mark constellation month celebrated.", e);
  }
};

export const constellationCelebrationStorage = {
  getCelebratedMilestones,
  markMilestoneCelebrated,
  getCelebratedMonths,
  markMonthCelebrated,
};
