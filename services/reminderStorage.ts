import AsyncStorage from "@react-native-async-storage/async-storage";
import { ReminderState } from "../hooks/reminderDefaults";

const KEY = "mindcare-reminder-settings";

/**
 * Saves the complete reminder settings object to AsyncStorage.
 * @param settings The reminder settings to save.
 */
export async function saveReminderSettings(
  settings: ReminderState,
): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
}

/**
 * Loads reminder settings from AsyncStorage.
 * @returns The saved settings, or null if none are found.
 */
export async function loadReminderSettings(): Promise<ReminderState | null> {
  const data = await AsyncStorage.getItem(KEY);
  if (!data) return null;
  // It's a good practice to handle potential parsing errors
  try {
    return JSON.parse(data) as ReminderState;
  } catch (error) {
    console.error(
      "Failed to parse reminder settings from AsyncStorage:",
      error,
    );
    return null;
  }
}

/**
 * Removes the reminder settings from AsyncStorage.
 */
export async function clearReminderSettings(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
