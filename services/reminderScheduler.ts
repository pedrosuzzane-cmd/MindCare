import {
  HydrationState,
  ReminderState,
  ReminderTime,
  RepeatSchedule,
  StandardState,
} from "@/hooks/reminderDefaults";
import {
  cancelReminderType,
  scheduleNotification,
} from "@/services/notificationService";
import { Platform } from "react-native";

const REMINDER_CONTENT: Record<
  string,
  { title: string; body: string; color: string; channelId: "reminders" | "tasks" | "hydration" }
> = {
  hydration: {
    title: "💧 Hydration Reminder",
    body: "Time to hydrate! Take a moment to drink a glass of water.",
    color: "#4CAF50",
    channelId: "hydration",
  },
  sleep: {
    title: "🌙 It's Almost Bedtime",
    body: "Getting enough sleep helps improve your focus and emotional well-being.",
    color: "#7B2CBF",
    channelId: "reminders",
  },
  breakTime: {
    title: "🌿 Take a Break",
    body: "You've been working hard. Take a 10–15 minute break to relax and recharge.",
    color: "#FF9800",
    channelId: "reminders",
  },
  task: {
    title: "📚 Assignment Reminder",
    body: "Don't forget to complete your pending tasks.",
    color: "#2196F3",
    channelId: "tasks",
  },
};

const HYDRATION_MESSAGES = [
  "💧 Time to hydrate! Drink a glass of water and keep yourself refreshed.",
  "💙 Staying hydrated helps improve concentration and energy.",
  "🌿 Take a short pause and drink some water.",
];

function to24h(time: ReminderTime): number {
  let h = time.hour;
  if (time.period === "PM" && h !== 12) h += 12;
  if (time.period === "AM" && h === 12) h = 0;
  return h;
}

function getDaysOfWeek(repeat: RepeatSchedule, customDays: number[]): number[] {
  switch (repeat) {
    case "every-day":
      return [1, 2, 3, 4, 5, 6, 7]; // Sun=1...Sat=7
    case "weekdays":
      return [2, 3, 4, 5, 6];
    case "weekends":
      return [1, 7];
    case "custom":
      return customDays.length > 0 ? customDays.map((d) => d + 1) : [];
    default:
      return [];
  }
}

async function scheduleStandard(id: "sleep" | "breakTime", r: StandardState) {
  await cancelReminderType(id);
  if (!r.enabled) return;

  const days = getDaysOfWeek(r.repeat, r.customDays);
  for (const day of days) {
    await scheduleNotification({
      identifier: `${id}-${day}`,
      content: {
        title: REMINDER_CONTENT[id].title,
        body: REMINDER_CONTENT[id].body,
        data: { type: id },
        channelId: REMINDER_CONTENT[id].channelId,
        color: REMINDER_CONTENT[id].color,
      },
      trigger: {
        weekday: day,
        hour: to24h(r.time),
        minute: r.time.minute,
        repeats: true,
      },
    });
  }
}

async function scheduleTask(r: StandardState) {
  await cancelReminderType("task");
  if (!r.enabled) return;

  const body = r.taskTitle
    ? `Don't forget: "${r.taskTitle}"`
    : REMINDER_CONTENT.task.body;
  const days = getDaysOfWeek(r.repeat, r.customDays);

  for (const day of days) {
    await scheduleNotification({
      identifier: `task-${day}`,
      content: {
        title: REMINDER_CONTENT.task.title,
        body,
        data: { type: "task" },
        channelId: "tasks",
        color: REMINDER_CONTENT.task.color,
      },
      trigger: {
        weekday: day,
        hour: to24h(r.time),
        minute: r.time.minute,
        repeats: true,
      },
    });
  }
}

async function scheduleHydration(r: HydrationState) {
  await cancelReminderType("hydration");
  if (!r.enabled) return;

  const days = getDaysOfWeek(r.repeat, r.customDays);
  const title = r.hydrationName || REMINDER_CONTENT.hydration.title;
  const startH = to24h(r.startTime);
  const endH = to24h(r.endTime);

  for (const day of days) {
    // Calculate all interval offsets (in minutes) from startTime
    const startMinutes = startH * 60 + r.startTime.minute;
    const endMinutes = endH * 60 + r.endTime.minute;

    // If endTime <= startTime, skip (invalid range)
    if (endMinutes <= startMinutes) continue;

    let offset = 0;
    let index = 0;
    while (offset <= endMinutes - startMinutes) {
      const absMinutes = startMinutes + offset;
      const h = Math.floor(absMinutes / 60);
      const m = absMinutes % 60;

      const body =
        index === 0
          ? HYDRATION_MESSAGES[0]
          : HYDRATION_MESSAGES[index % HYDRATION_MESSAGES.length];

      await scheduleNotification({
        identifier: `hydration-${day}-${index}`,
        content: {
          title,
          body,
          channelId: "hydration",
          color: "#4CAF50",
          data: {
            type: "hydration",
            hydrationConfig: {
              name: r.hydrationName,
              startTime: r.startTime,
              endTime: r.endTime,
              intervalMinutes: r.intervalMinutes,
            },
          },
        },
        trigger: {
          weekday: day,
          hour: h,
          minute: m,
          repeats: true,
        },
      });

      offset += r.intervalMinutes;
      index++;
    }
  }
}

/**
 * Main scheduler function that updates all notifications based on the current settings.
 * @param settings The complete reminder settings object from Firestore.
 */
export async function updateAllSchedules(settings: ReminderState) {
  if (!settings) return;

  // Web browsers do not support native notification triggers; safely skip scheduling
  if (Platform.OS === "web") {
    return;
  }

  await Promise.all([
    scheduleStandard("sleep", settings.sleep),
    scheduleStandard("breakTime", settings.breakTime),
    scheduleTask(settings.task),
    scheduleHydration(settings.hydration),
  ]);
}
