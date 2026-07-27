import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  addCustomReminder,
  CustomReminder,
  deleteCustomReminder,
  loadCustomReminders,
  saveCustomReminders,
  toggleCustomReminder,
  updateCustomReminder,
} from "@/services/customReminderStorage";
import { rescheduleCustomReminder } from "@/services/customReminderScheduler";

export function useCustomReminders() {
  const [reminders, setReminders] = useState<CustomReminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomReminders()
      .then(setReminders)
      .catch(() => setReminders([]))
      .finally(() => setLoading(false));
  }, []);

  /** Persist scheduled notification IDs back to AsyncStorage */
  const persistNotifIds = useCallback(
    async (id: string, ids: string[]) => {
      setReminders((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, scheduledNotificationIds: ids } : r,
        ),
      );
      const all = await loadCustomReminders();
      const updated = all.map((r) =>
        r.id === id ? { ...r, scheduledNotificationIds: ids } : r,
      );
      await saveCustomReminders(updated);
    },
    [],
  );

  const add = useCallback(
    async (
      data: Omit<CustomReminder, "id" | "createdAt">,
    ): Promise<CustomReminder> => {
      const created = await addCustomReminder(data);
      setReminders((prev) => [...prev, created]);
      if (Platform.OS !== "web") {
        try {
          const ids = await rescheduleCustomReminder(created);
          if (ids.length > 0) {
            await persistNotifIds(created.id, ids);
          }
        } catch (e) {
          console.warn("Failed to schedule custom reminder:", e);
        }
      }
      return created;
    },
    [persistNotifIds],
  );

  const toggle = useCallback(
    async (id: string): Promise<CustomReminder | null> => {
      const updated = await toggleCustomReminder(id);
      if (updated) {
        setReminders((prev) => prev.map((r) => (r.id === id ? updated : r)));
        if (Platform.OS !== "web") {
          try {
            const ids = await rescheduleCustomReminder(updated);
            if (ids.length > 0) {
              await persistNotifIds(id, ids);
            } else {
              await persistNotifIds(id, []);
            }
          } catch (e) {
            console.warn("Failed to reschedule custom reminder:", e);
          }
        }
      }
      return updated;
    },
    [persistNotifIds],
  );

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const ok = await deleteCustomReminder(id);
    if (ok) {
      setReminders((prev) => prev.filter((r) => r.id !== id));
      if (Platform.OS !== "web") {
        const { cancelCustomReminder } = await import(
          "@/services/customReminderScheduler"
        );
        cancelCustomReminder(id).catch(console.warn);
      }
    }
    return ok;
  }, []);

  const update = useCallback(
    async (
      id: string,
      updates: Partial<Omit<CustomReminder, "id" | "createdAt">>,
    ): Promise<CustomReminder | null> => {
      const updated = await updateCustomReminder(id, updates);
      if (updated) {
        setReminders((prev) => prev.map((r) => (r.id === id ? updated : r)));
        if (Platform.OS !== "web") {
          try {
            const ids = await rescheduleCustomReminder(updated);
            if (ids.length > 0) {
              await persistNotifIds(id, ids);
            } else {
              await persistNotifIds(id, []);
            }
          } catch (e) {
            console.warn("Failed to reschedule custom reminder:", e);
          }
        }
      }
      return updated;
    },
    [persistNotifIds],
  );

  return { reminders, loading, add, toggle, remove, update };
}
