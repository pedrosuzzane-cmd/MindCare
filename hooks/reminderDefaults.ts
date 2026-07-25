/**
 * This file contains the centralized type definitions and default state for the reminder system.
 */

export type ReminderType = "hydration" | "breakTime" | "sleep" | "task";

export type RepeatSchedule = "every-day" | "weekdays" | "weekends" | "custom";

export interface ReminderTime {
  hour: number; // 1-12
  minute: number; // 0-59
  period: "AM" | "PM";
}

export interface BaseState {
  enabled: boolean;
  repeat: RepeatSchedule;
  customDays: number[];
  note: string;
}

export interface HydrationState extends BaseState {
  hydrationName: string;
  startTime: ReminderTime;
  endTime: ReminderTime;
  intervalMinutes: number;
}

export interface StandardState extends BaseState {
  time: ReminderTime;
  taskTitle: string;
  taskDueDate: string;
  taskNotes: string;
}

export type ReminderState = {
  hydration: HydrationState;
  sleep: StandardState;
  breakTime: StandardState;
  task: StandardState;
};

export function defaultReminderState(): ReminderState {
  return {
    hydration: {
      enabled: false,
      repeat: "every-day",
      customDays: [],
      note: "",
      hydrationName: "",
      startTime: { hour: 8, minute: 0, period: "AM" },
      endTime: { hour: 8, minute: 0, period: "PM" },
      intervalMinutes: 60,
    },
    sleep: {
      enabled: false,
      repeat: "every-day",
      customDays: [],
      note: "",
      time: { hour: 10, minute: 0, period: "PM" },
      taskTitle: "",
      taskDueDate: "",
      taskNotes: "",
    },
    breakTime: {
      enabled: false,
      repeat: "every-day",
      customDays: [],
      note: "",
      time: { hour: 3, minute: 0, period: "PM" },
      taskTitle: "",
      taskDueDate: "",
      taskNotes: "",
    },
    task: {
      enabled: false,
      repeat: "every-day",
      customDays: [],
      note: "",
      time: { hour: 5, minute: 0, period: "PM" },
      taskTitle: "",
      taskDueDate: "",
      taskNotes: "",
    },
  };
}