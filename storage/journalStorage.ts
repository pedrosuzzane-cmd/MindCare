import AsyncStorage from "@react-native-async-storage/async-storage";
import { JournalEntry } from "../services/journalService";

const getStorageKey = (userId: string) => `@MindCare:journal_entries_${userId}`;

/**
 * Retrieves all journal entries for a specific user from AsyncStorage.
 */
const getEntries = async (userId: string): Promise<JournalEntry[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(getStorageKey(userId));
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error("Failed to load journal entries from storage.", e);
    return [];
  }
};

/**
 * Saves a single journal entry. It adds the entry if it's new,
 * or updates it if it already exists.
 */
const saveEntry = async (
  userId: string,
  entry: JournalEntry,
): Promise<void> => {
  const entries = await getEntries(userId);
  const existingIndex = entries.findIndex((e) => e.id === entry.id);

  if (existingIndex > -1) {
    entries[existingIndex] = entry; // Update existing
  } else {
    entries.push(entry); // Add new
  }

  await saveAllEntries(userId, entries);
};

/**
 * Overwrites all journal entries for a user with the provided array.
 */
const saveAllEntries = async (
  userId: string,
  entries: JournalEntry[],
): Promise<void> => {
  const jsonValue = JSON.stringify(entries);
  await AsyncStorage.setItem(getStorageKey(userId), jsonValue);
};

const deleteEntry = async (userId: string, entryId: string): Promise<void> => {
  const entries = await getEntries(userId);
  const filteredEntries = entries.filter((e) => e.id !== entryId);
  await saveAllEntries(userId, filteredEntries);
};

export const journalStorage = {
  getEntries,
  saveEntry,
  saveAllEntries,
  deleteEntry,
};
