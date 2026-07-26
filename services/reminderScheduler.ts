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

const REMINDER_CONTENT = {
  hydration: {
    title: "💧 Hydration Reminder",
    body: "Time to hydrate! Take a moment to drink a glass of water.",
  },
  sleep: {
    title: "🌙 It's Almost Bedtime",
    body: "Getting enough sleep helps improve your focus and emotional well-being.",
  },
  breakTime: {
    title: "🌿 Take a Break",
    body: "You've been working hard. Take a 10–15 minute break to relax and recharge.",
  },
  task: {
    title: "📚 Assignment Reminder",
    body: "Don't forget to complete your pending tasks.",
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
        ...REMINDER_CONTENT[id],
        data: { type: id },
        channelId: "reminders",
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

  for (const day of days) {
    await scheduleNotification({
      identifier: `hydration-${day}-start`,
      content: {
        title,
        body: HYDRATION_MESSAGES[0],
        channelId: "hydration",
        data: {
          type: "hydration",
          isChained: true,
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
        hour: to24h(r.startTime),
        minute: r.startTime.minute,
        repeats: true,
      },
    });
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
