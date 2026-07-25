import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { updateAllSchedules } from "../services/reminderScheduler";
import {
  loadReminderSettings,
  saveReminderSettings,
} from "../services/reminderStorage";
import { defaultReminderState, ReminderState } from "./reminderDefaults";

export function useReminderSettings() {
  const [reminders, setReminders] =
    useState<ReminderState>(defaultReminderState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        const savedSettings = await loadReminderSettings();
        if (savedSettings) {
          // Deep merge saved settings with defaults to ensure all keys exist
          const defaults = defaultReminderState();
          const merged = { ...defaults };
          for (const key in defaults) {
            const k = key as keyof ReminderState;
            merged[k] = { ...defaults[k], ...(savedSettings[k] || {}) } as any;
          }
          setReminders(merged);
        } else {
          // No settings saved yet, use defaults
          setReminders(defaultReminderState());
        }
      } catch (error) {
        console.error("Failed to load reminder settings:", error);
        setReminders(defaultReminderState());
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const updateReminder = useCallback(
    async (newSettings: ReminderState) => {
      setReminders(newSettings);
      await saveReminderSettings(newSettings);

      // Reschedule notifications only on native platforms (Android/iOS)
      // Web browsers do not support native expo-notifications scheduling
      if (Platform.OS !== "web") {
        try {
          await updateAllSchedules(newSettings);
        } catch (schedError) {
          console.warn("Notification scheduling skipped on web or failed:", schedError);
        }
      }
    },
    [],
  );

  return {
    reminders,
    loading,
    updateReminder,
  };
}