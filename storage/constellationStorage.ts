import AsyncStorage from "@react-native-async-storage/async-storage";
import { ConstellationStar } from "../types/constellation";

const getStorageKey = (userId: string) =>
  `@MindCare:constellation_stars_${userId}`;

const getCelebratedKey = (userId: string) =>
  `@MindCare:constellation_celebrated_${userId}`;

const getStars = async (userId: string): Promise<ConstellationStar[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(getStorageKey(userId));
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error("Failed to load constellation stars from storage.", e);
    return [];
  }
};

const saveStars = async (
  userId: string,
  stars: ConstellationStar[],
): Promise<void> => {
  await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(stars));
};

const saveStar = async (
  userId: string,
  star: ConstellationStar,
): Promise<void> => {
  const stars = await getStars(userId);
  const existingIndex = stars.findIndex((s) => s.id === star.id);
  if (existingIndex > -1) {
    stars[existingIndex] = star;
  } else {
    stars.push(star);
  }
  await saveStars(userId, stars);
};

const getCelebratedMilestones = async (userId: string): Promise<number[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(getCelebratedKey(userId));
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error("Failed to load celebrated milestones.", e);
    return [];
  }
};

const markMilestoneCelebrated = async (
  userId: string,
  count: number,
): Promise<void> => {
  const celebrated = await getCelebratedMilestones(userId);
  if (celebrated.includes(count)) return;
  await AsyncStorage.setItem(
    getCelebratedKey(userId),
    JSON.stringify([...celebrated, count]),
  );
};

export const constellationStorage = {
  getStars,
  saveStars,
  saveStar,
  getCelebratedMilestones,
  markMilestoneCelebrated,
};
