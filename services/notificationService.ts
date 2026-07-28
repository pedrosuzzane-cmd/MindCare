import * as Notifications from "expo-notifications";
import { Platform, PermissionsAndroid } from "react-native";

// Notification handler is set globally in hooks/useReminderNotifications.ts
// and imported at app root layout. No duplicate handler needed here.

export interface NotificationSchedule {
  identifier: string;
  content: {
    title: string;
    body: string;
    data?: Record<string, any>;
    channelId?: "reminders" | "tasks" | "hydration";
    color?: string;
    icon?: string;
    largeIcon?: string;
  };
  trigger: Notifications.NotificationTriggerInput;
}

const CHANNEL_COLORS: Record<string, string> = {
  reminders: "#8A63D2",
  tasks: "#2196F3",
  hydration: "#4CAF50",
};

/**
 * Request exact alarm permission on Android 12+ (API 31+).
 * This reduces the 1-minute latency window for scheduled notifications.
 */
export async function requestExactAlarmPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  try {
    // USE_EXACT_ALARM (API 33+) is auto-granted, no runtime prompt needed.
    // SCHEDULE_EXACT_ALARM (API 31+) requires user to grant via Settings.
    // We check and request only on API 31-32 where SCHEDULE_EXACT_ALARM is needed.
    if (Platform.Version >= 31 && Platform.Version < 33) {
      const granted = await PermissionsAndroid.request(
        "android.permission.SCHEDULE_EXACT_ALARM" as any,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Sets up notification channels for Android. This is required for Android 8.0+.
 * Each channel gets a distinct color, vibration, and light for visual identity.
 */
export async function setupNotificationChannels() {
  if (Platform.OS === "android") {
    await requestExactAlarmPermission();
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Daily Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#8A63D2",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: "default",
    });
    await Notifications.setNotificationChannelAsync("tasks", {
      name: "Task Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2196F3",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: "default",
    });
    await Notifications.setNotificationChannelAsync("hydration", {
      name: "Hydration Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4CAF50",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: "default",
    });
  }
}

/**
 * Checks if notification permissions have already been granted without prompting the user.
 */
export async function checkNotificationPermissions(): Promise<boolean> {
  // Web implementation can be unstable; use the browser's native API.
  if (Platform.OS === "web") {
    return (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    );
  }

  const settings = await Notifications.getPermissionsAsync();
  // The 'granted' property is a convenience boolean in newer SDKs.
  // The 'status' property provides more detail. Checking both provides compatibility.
  const status = (settings as any)?.status ?? (settings as any)?.granted;
  return status === "granted" || status === "authorized" || status === true;
}

/**
 * Prompts the user for notification permissions if they haven't been granted already.
 * @returns {Promise<boolean>} A promise that resolves to true if permissions are granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  // Web implementation can be unstable; use the browser's native API.
  if (Platform.OS === "web") {
    const permission =
      typeof Notification !== "undefined"
        ? await Notification.requestPermission()
        : "denied";
    return permission === "granted";
  }
  const hasPermissions = await checkNotificationPermissions();
  if (hasPermissions) {
    return true;
  }

  const settings = await Notifications.requestPermissionsAsync();
  const status = (settings as any)?.status ?? (settings as any)?.granted;

  return status === "granted" || status === "authorized" || status === true;
}

/**
 * Schedules a single notification based on a schedule object.
 * Includes accent color, Android priority, and channel routing for rich visuals.
 */
export async function scheduleNotification(
  schedule: NotificationSchedule,
): Promise<string | null> {
  try {
    // Ensure channels are created on Android before scheduling
    if (Platform.OS === "android") {
      await setupNotificationChannels();
    }

    const hasPermissions = await checkNotificationPermissions();
    if (!hasPermissions) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        console.warn(
          "Notification permissions not granted. Skipping schedule.",
        );
        return null;
      }
    }

    const accentColor =
      schedule.content.color ||
      CHANNEL_COLORS[schedule.content.channelId || "reminders"] ||
      "#8A63D2";

    await Notifications.scheduleNotificationAsync({
      identifier: schedule.identifier,
      content: {
        title: schedule.content.title,
        body: schedule.content.body,
        data: schedule.content.data,
        sound: true,
        color: accentColor,
        ...(Platform.OS === "android"
          ? {
              icon: schedule.content.icon || "icon",
              channelId: schedule.content.channelId || "reminders",
            }
          : {}),
      },
      trigger: schedule.trigger,
    });
    return schedule.identifier;
  } catch (error) {
    console.error(
      `Failed to schedule notification "${schedule.identifier}":`,
      error,
    );
    return null;
  }
}

/**
 * Cancels a single scheduled notification by its identifier.
 */
export async function cancelNotification(identifier: string): Promise<void> {
  if (Platform.OS === "web") {
    return; // Not supported on web
  }
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

/**
 * Cancels all scheduled notifications that start with a given prefix (e.g., 'hydration').
 */
export async function cancelReminderType(type: string): Promise<void> {
  if (Platform.OS === "web") {
    return; // Not supported on web
  }
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled.filter((n) => n.identifier.startsWith(type));
  await Promise.all(
    toCancel.map((n) =>
      Notifications.cancelScheduledNotificationAsync(n.identifier),
    ),
  );
}

/**
 * Cancels all scheduled notifications for the app.
 */
export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === "web") {
    return; // Not supported on web
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Checks if a notification with a specific identifier is already scheduled.
 * @param {string} identifier The notification identifier.
 * @returns {Promise<boolean>} True if the notification exists.
 */
export async function notificationExists(identifier: string): Promise<boolean> {
  if (Platform.OS === "web") {
    return false; // Not supported on web
  }
  const notifications = await Notifications.getAllScheduledNotificationsAsync();
  return notifications.some((n) => n.identifier === identifier);
}

/**
 * A debug helper to log all currently scheduled notifications to the console.
 */
export async function logScheduledNotifications() {
  try {
    if (Platform.OS === "web") {
      console.log("logScheduledNotifications: Not available on web.");
      return;
    }
    const notifications =
      await Notifications.getAllScheduledNotificationsAsync();
    console.log("--- Scheduled Notifications ---");
    if (notifications.length === 0) {
      console.log("No notifications scheduled.");
    } else {
      notifications.forEach((n) => {
        console.log(`ID: ${n.identifier}, Trigger:`, n.trigger);
      });
    }
    console.log("-----------------------------");
  } catch (error) {
    console.error("Failed to get scheduled notifications:", error);
  }
}

/**
 * Adds a listener that fires when a user interacts with a notification.
 */
export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
) {
  const subscription =
    Notifications.addNotificationResponseReceivedListener(handler);
  return () => subscription.remove();
}
