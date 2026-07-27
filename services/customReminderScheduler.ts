import { Platform } from "react-native";
import { scheduleNotification } from "@/services/notificationService";
import { CustomReminder } from "@/services/customReminderStorage";
import * as Notifications from "expo-notifications";

function to24Hour(hour: number, period: "AM" | "PM"): number {
  let h = hour;
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h;
}

/**
 * Schedule notifications for a single custom reminder.
 * Returns the list of scheduled notification identifiers for AsyncStorage persistence.
 */
export async function scheduleCustomReminder(
  reminder: CustomReminder,
): Promise<string[]> {
  if (Platform.OS === "web") return [];

  const idPrefix = `custom-${reminder.id}`;
  const hour24 = to24Hour(reminder.hour, reminder.period);

  const days =
    reminder.repeatDays.length > 0
      ? reminder.repeatDays.map((d) => d + 1) // JS 0=Sun -> expo 1=Sun
      : [1, 2, 3, 4, 5, 6, 7]; // every day

  const ids: string[] = [];

  for (const day of days) {
    const identifier = `${idPrefix}-${day}`;
    const result = await scheduleNotification({
      identifier,
      content: {
        title: reminder.title || "Reminder",
        body: reminder.message || "Time for your reminder!",
        data: { type: "custom", reminderId: reminder.id },
        channelId: "reminders",
        color: "#8A63D2",
      },
      trigger: {
        weekday: day,
        hour: hour24,
        minute: reminder.minute,
        repeats: true,
      },
    });
    if (result) ids.push(result);
  }

  return ids;
}

/**
 * Cancel all scheduled notifications for a custom reminder.
 * Matches by prefix since each reminder schedules multiple notifications (one per weekday).
 */
export async function cancelCustomReminder(id: string): Promise<void> {
  if (Platform.OS === "web") return;
  const prefix = `custom-${id}`;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = all.filter((n: { identifier: string }) => n.identifier.startsWith(prefix));
  await Promise.all(
    toCancel.map((n: { identifier: string }) =>
      Notifications.cancelScheduledNotificationAsync(n.identifier),
    ),
  );
}

/**
 * Reschedule a custom reminder: cancel old, schedule new if enabled.
 * Returns the list of scheduled notification identifiers.
 */
export async function rescheduleCustomReminder(
  reminder: CustomReminder,
): Promise<string[]> {
  await cancelCustomReminder(reminder.id);
  if (reminder.enabled) {
    return scheduleCustomReminder(reminder);
  }
  return [];
}
