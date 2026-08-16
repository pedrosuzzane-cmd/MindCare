import {
  HydrationState,
  ReminderState,
  RepeatSchedule,
  StandardState,
} from "@/hooks/reminderDefaults";
import { useDebounce } from "@/hooks/useDebounce";
import { useReminderSettings } from "@/hooks/useReminderSettings";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";
import ClockTimePicker from "@/components/ClockTimePicker";
import { requestNotificationPermissions } from "@/services/notificationService";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

// ── Constants ──
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HYDRATION_INTERVALS = [15, 30, 45, 60, 90, 120];

const REMINDER_META: Record<
  string,
  { icon: string; color: string; label: string; desc: string }
> = {
  hydration: {
    icon: "water-outline",
    color: "#9C7EEB",
    label: "Hydration Reminder",
    desc: "Interval-based hydration reminders",
  },
  sleep: {
    icon: "moon-outline",
    color: "#9C7EEB",
    label: "Sleep Schedule Reminder",
    desc: "Encourages a consistent sleep routine",
  },
  breakTime: {
    icon: "cafe-outline",
    color: "#FF9800",
    label: "Break Time Reminder",
    desc: "Reminds you to take short breaks",
  },
  task: {
    icon: "checkmark-circle-outline",
    color: "#8A63D2",
    label: "Task Submission Reminder",
    desc: "Helps remember upcoming deadlines",
  },
};

/**
 * Quick-add wellness templates. These configure one of the existing four
 * reminder types (no new data model / scheduling changes).
 */
const WELLNESS_TEMPLATES: {
  id: string;
  icon: string;
  color: string;
  name: string;
  desc: string;
  target: keyof ReminderState;
  preset: Record<string, any>;
}[] = [
  {
    id: "morning-checkin",
    icon: "sunny-outline",
    color: "#F5A623",
    name: "Morning Check-in",
    desc: "A gentle nudge to start the day",
    target: "breakTime",
    preset: {
      time: { hour: 8, minute: 0, period: "AM" },
      note: "Good morning! Take a moment to set an intention for today.",
    },
  },
  {
    id: "breathing",
    icon: "flower-outline",
    color: "#4CAF50",
    name: "Breathing Break",
    desc: "Pause and take a few deep breaths",
    target: "breakTime",
    preset: {
      time: { hour: 11, minute: 0, period: "AM" },
      note: "Breathe in for 4, hold for 4, out for 6.",
    },
  },
  {
    id: "mindful-pause",
    icon: "leaf-outline",
    color: "#66BB6A",
    name: "Mindful Pause",
    desc: "Step away and ground yourself",
    target: "breakTime",
    preset: {
      time: { hour: 3, minute: 0, period: "PM" },
      note: "Notice your surroundings. Five slow breaths.",
    },
  },
  {
    id: "movement",
    icon: "walk-outline",
    color: "#FF9800",
    name: "Movement Break",
    desc: "Stand up, stretch, and move a little",
    target: "breakTime",
    preset: {
      time: { hour: 5, minute: 0, period: "PM" },
      note: "Stretch or take a short walk to reset.",
    },
  },
  {
    id: "sleep-winddown",
    icon: "moon-outline",
    color: "#7B2CBF",
    name: "Wind-Down Reminder",
    desc: "Start relaxing before bedtime",
    target: "sleep",
    preset: {
      time: { hour: 9, minute: 30, period: "PM" },
      note: "Dim the lights and put screens away.",
    },
  },
];

// ── Helpers ──
function getRepeatLabel(
  repeat: string = "every-day",
  customDays: number[] = [],
): string {
  switch (repeat) {
    case "every-day":
      return "Every day";
    case "weekdays":
      return "Weekdays";
    case "weekends":
      return "Weekends";
    case "custom":
      return (customDays || []).length === 0
        ? "Custom"
        : customDays.map((d) => WEEKDAYS_SHORT[d]).join(", ");
    default:
      return "Every day";
  }
}

function fmt(t?: { hour: number; minute: number; period: string }): string {
  if (!t) {
    return "--:--";
  }
  const hour = t.hour || 12;
  const minute = t.minute || 0;
  return `${hour}:${String(minute).padStart(2, "0")} ${t.period || "AM"}`;
}

function to24h(t?: { hour: number; minute: number; period: string }): number {
  if (!t) return 0;
  let h = t.hour % 12;
  if (t.period === "PM") h += 12;
  return h * 60 + (t.minute || 0);
}

/** Map a RepeatSchedule + custom days to JS getDay() values (0=Sun ... 6=Sat). */
function repeatWeekdays(
  repeat: string = "every-day",
  customDays: number[] = [],
): number[] {
  switch (repeat) {
    case "every-day":
      return [0, 1, 2, 3, 4, 5, 6];
    case "weekdays":
      return [1, 2, 3, 4, 5];
    case "weekends":
      return [0, 6];
    case "custom":
      return (customDays || []).length > 0 ? customDays : [0, 1, 2, 3, 4, 5, 6];
    default:
      return [0, 1, 2, 3, 4, 5, 6];
  }
}

interface NextReminder {
  id: string;
  icon: string;
  color: string;
  label: string;
  time: string;
  dayLabel: string;
  minutes: number;
}

/** Returns epoch-ms of the next occurrence of this reminder within 7 days, or null. */
function nextOccurrenceMs(
  repeat: string = "every-day",
  customDays: number[] = [],
  time?: { hour: number; minute: number; period: string },
): number | null {
  if (!time) return null;
  const days = repeatWeekdays(repeat, customDays);
  const now = new Date();
  const hour24 = Math.floor(to24h(time) / 60);
  const minute = time.minute || 0;
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    if (!days.includes(d.getDay())) continue;
    const candidate = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      hour24,
      minute,
      0,
      0,
    );
    if (candidate.getTime() > now.getTime()) return candidate.getTime();
  }
  return null;
}

function dayLabelFromMs(ms: number): string {
  const diff = Math.round((ms - Date.now()) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(ms).getDay()];
}

/** Compute the single next upcoming reminder across all enabled reminders. */
function getNextReminder(reminders: ReminderState): NextReminder | null {
  const entries: {
    id: string;
    state: { enabled: boolean; repeat: RepeatSchedule; customDays: number[] };
    time?: { hour: number; minute: number; period: string };
  }[] = [
    { id: "hydration", state: reminders.hydration, time: reminders.hydration.startTime },
    { id: "sleep", state: reminders.sleep, time: reminders.sleep.time },
    { id: "breakTime", state: reminders.breakTime, time: reminders.breakTime.time },
    { id: "task", state: reminders.task, time: reminders.task.time },
  ];

  let best: NextReminder | null = null;
  let bestMs = Number.POSITIVE_INFINITY;

  for (const entry of entries) {
    if (!entry.state.enabled || !entry.time) continue;
    const ms = nextOccurrenceMs(entry.state.repeat, entry.state.customDays, entry.time);
    if (ms === null || ms >= bestMs) continue;
    const meta = REMINDER_META[entry.id] || { icon: "ellipse", color: "#888", label: entry.id };
    bestMs = ms;
    best = {
      id: entry.id,
      icon: meta.icon,
      color: meta.color,
      label: meta.label,
      time: fmt(entry.time),
      dayLabel: dayLabelFromMs(ms),
      minutes: to24h(entry.time),
    };
  }

  return best;
}

/** Tappable time field that opens the native OS time dialog. */
function TimeField({
  value,
  onChange,
}: {
  value: { hour: number; minute: number; period: "AM" | "PM" };
  onChange: (v: { hour: number; minute: number; period: "AM" | "PM" }) => void;
}) {
  const { theme } = useMindCareTheme();
  const s = createStyles(theme);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable style={s.timeField} onPress={() => setOpen(true)}>
        <Ionicons name="alarm-outline" size={18} color={theme.primary} />
        <Text style={s.timeFieldText}>{fmt(value)}</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
      </Pressable>
      <ClockTimePicker
        visible={open}
        val={value}
        onChange={onChange}
        onDismiss={() => setOpen(false)}
      />
    </>
  );
}

// ── Sub-components ──
function PillRow({
  items,
  selected,
  onSelect,
}: {
  items: number[];
  selected: number;
  onSelect: (v: number) => void;
}) {
  const { theme } = useMindCareTheme();
  const s = createStyles(theme);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.pillScrollContent}
      style={s.pillScroll}
    >
      {items.map((item) => {
        const sel = item === selected;
        return (
          <Pressable
            key={item}
            onPress={() => onSelect(item)}
            style={[s.pill, sel && s.pillSelected]}
          >
            <Text style={[s.pillText, sel && s.pillTextSelected]}>
              {String(item).padStart(2, "0")}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function RepeatPicker({
  val,
  days,
  onChange,
  onDaysChange,
}: {
  val: RepeatSchedule;
  days: number[];
  onChange: (r: RepeatSchedule) => void;
  onDaysChange: (d: number[]) => void;
}) {
  const { theme } = useMindCareTheme();
  const s = createStyles(theme);
  const opts: { label: string; value: RepeatSchedule }[] = [
    { label: "Every Day", value: "every-day" },
    { label: "Weekdays", value: "weekdays" },
    { label: "Weekends", value: "weekends" },
    { label: "Custom", value: "custom" },
  ];
  const toggleDay = (d: number) => {
    onDaysChange(
      days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort(),
    );
  };
  return (
    <View style={{ gap: 10 }}>
      <View style={s.repeatRow}>
        {opts.map((o) => {
          const sel = val === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              style={[s.repeatPill, sel && s.repeatPillSelected]}
            >
              <Text style={[s.repeatPillText, sel && s.repeatPillTextSelected]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {val === "custom" && (
        <View style={s.repeatRow}>
          {WEEKDAYS_SHORT.map((day, idx) => {
            const sel = days.includes(idx);
            return (
              <Pressable
                key={idx}
                onPress={() => toggleDay(idx)}
                style={[s.dayPill, sel && s.dayPillSelected]}
              >
                <Text style={[s.dayPillText, sel && s.dayPillTextSelected]}>
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Card Renderers ──
function HydrationCard({
  r,
  onToggle,
  onUpdate,
}: {
  r: HydrationState;
  onToggle: () => void;
  onUpdate: (u: Partial<HydrationState>) => void;
}) {
  const { theme } = useMindCareTheme();
  const s = createStyles(theme);
  // Debounce text inputs to avoid excessive Firestore writes
  const debouncedName = useDebounce(r.hydrationName, 1000);
  const debouncedNote = useDebounce(r.note, 1000);

  useEffect(() => {
    const updates: Partial<HydrationState> = {};
    if (debouncedName !== r.hydrationName) {
      updates.hydrationName = debouncedName;
    }
    if (debouncedNote !== r.note) {
      updates.note = debouncedNote;
    }

    if (Object.keys(updates).length === 0) return;

    (async () => {
      await onUpdate(updates);
    })();
  }, [debouncedName, debouncedNote, r.hydrationName, r.note, onUpdate]);

  return (
    <View style={s.card}>
      <View style={s.cardH}>
        <View
          style={[s.icon, { backgroundColor: REMINDER_META.hydration.color }]}
        >
          <Ionicons name="water-outline" size={24} color="white" />
        </View>
        <View style={s.cardT}>
          <Text style={s.cardTitle}>Hydration Reminder</Text>
          <Text style={s.cardDesc}>Interval-based hydration reminders</Text>
          {r.enabled && r.startTime && r.endTime ? (
            <Text style={s.badge}>
              {getRepeatLabel(r.repeat, r.customDays)} &bull; Every
              {r.intervalMinutes} min &bull; {fmt(r.startTime)}&ndash;
              {fmt(r.endTime)}
            </Text>
          ) : null}
        </View>
        <Switch
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={theme.border}
          onValueChange={onToggle}
          value={r.enabled}
        />
      </View>
      {r.enabled && (
        <View style={s.settings}>
          <View style={s.field}>
            <Text style={s.label}>Reminder Name</Text>
            <TextInput
              style={s.input}
              placeholder="e.g., Drink Water"
              placeholderTextColor={theme.secondaryText}
              value={r.hydrationName}
              // Update local state immediately for responsive UI
              onChangeText={(v) => onUpdate({ hydrationName: v })}
            />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Start Time</Text>
            <TimeField
              value={r.startTime || { hour: 8, minute: 0, period: "AM" as const }}
              onChange={(v) => onUpdate({ startTime: v })}
            />
          </View>
          <View style={s.field}>
            <Text style={s.label}>End Time</Text>
            <TimeField
              value={r.endTime || { hour: 10, minute: 0, period: "PM" as const }}
              onChange={(v) => onUpdate({ endTime: v })}
            />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Remind Every</Text>
            <PillRow
              items={HYDRATION_INTERVALS}
              selected={r.intervalMinutes}
              onSelect={(v) => onUpdate({ intervalMinutes: v })}
            />
            <Text style={s.hint}>
              Repeats every {r.intervalMinutes} min between{" "}
              {fmt(r.startTime || { hour: 8, minute: 0, period: "AM" })} and{" "}
              {fmt(r.endTime || { hour: 10, minute: 0, period: "PM" })}
            </Text>
          </View>
          <View style={s.field}>
            <Text style={s.label}>Repeat</Text>
            <RepeatPicker
              val={r.repeat}
              days={r.customDays}
              onChange={(v) => onUpdate({ repeat: v })}
              onDaysChange={(v) => onUpdate({ customDays: v })}
            />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Note (Optional)</Text>
            <TextInput
              style={s.noteInput}
              placeholder="Add a note..."
              placeholderTextColor={theme.secondaryText}
              value={r.note}
              onChangeText={(v) => onUpdate({ note: v })}
              multiline
            />
          </View>
        </View>
      )}
    </View>
  );
}

function StandardCard({
  id,
  r,
  showTask,
  onToggle,
  onUpdate,
}: {
  id: string;
  r: StandardState;
  showTask?: boolean;
  onToggle: () => void;
  onUpdate: (u: Partial<StandardState>) => void;
}) {
  const { theme } = useMindCareTheme();
  const s = createStyles(theme);
  // Debounce text inputs
  const debouncedNote = useDebounce(r.note, 1000);
  const debouncedTaskTitle = useDebounce(r.taskTitle, 1000);
  const debouncedTaskDueDate = useDebounce(r.taskDueDate, 1000);
  const debouncedTaskNotes = useDebounce(r.taskNotes, 1000);

  useEffect(() => {
    const updates: Partial<StandardState> = {};
    if (debouncedNote !== r.note) {
      updates.note = debouncedNote;
    }
    if (showTask) {
      if (debouncedTaskTitle !== r.taskTitle) {
        updates.taskTitle = debouncedTaskTitle;
      }
      if (debouncedTaskDueDate !== r.taskDueDate) {
        updates.taskDueDate = debouncedTaskDueDate;
      }
      if (debouncedTaskNotes !== r.taskNotes) {
        updates.taskNotes = debouncedTaskNotes;
      }
    }

    if (Object.keys(updates).length === 0) return;

    (async () => await onUpdate(updates))();
  }, [
    debouncedNote,
    debouncedTaskTitle,
    debouncedTaskDueDate,
    debouncedTaskNotes,
    r,
    onUpdate,
    showTask,
  ]);
  const meta = REMINDER_META[id] || {
    icon: "ellipse",
    color: "#888",
    label: id,
    desc: "",
  };
  return (
    <View style={s.card}>
      <View style={s.cardH}>
        <View style={[s.icon, { backgroundColor: meta.color }]}>
          <Ionicons name={meta.icon as any} size={24} color="white" />
        </View>
        <View style={s.cardT}>
          <Text style={s.cardTitle}>{meta.label}</Text>
          <Text style={s.cardDesc}>{meta.desc}</Text>
          {r.enabled ? (
            <Text style={s.badge}>
              {getRepeatLabel(r.repeat, r.customDays)} at {fmt(r.time)}
            </Text>
          ) : null}
        </View>
        <Switch
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={theme.border}
          onValueChange={onToggle}
          value={r.enabled}
        />
      </View>
      {r.enabled && (
        <View style={s.settings}>
          <View style={s.field}>
            <Text style={s.label}>Time</Text>
            <TimeField
              value={r.time || { hour: 9, minute: 0, period: "AM" as const }}
              onChange={(v) => onUpdate({ time: v })}
            />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Repeat</Text>
            <RepeatPicker
              val={r.repeat}
              days={r.customDays}
              onChange={(v) => onUpdate({ repeat: v })}
              onDaysChange={(v) => onUpdate({ customDays: v })}
            />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Note (Optional)</Text>
            <TextInput
              style={s.noteInput}
              placeholder="Add a note..."
              placeholderTextColor={theme.secondaryText}
              value={r.note}
              onChangeText={(v) => onUpdate({ note: v })}
              multiline
            />
          </View>
          {showTask && (
            <>
              <View style={s.field}>
                <Text style={s.label}>Task Title</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g., Programming Project"
                  placeholderTextColor={theme.secondaryText}
                  value={r.taskTitle}
                  onChangeText={(v) => onUpdate({ taskTitle: v })}
                />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Due Date</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g., Dec 15, 5:00 PM"
                  placeholderTextColor={theme.secondaryText}
                  value={r.taskDueDate}
                  onChangeText={(v) => onUpdate({ taskDueDate: v })}
                />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Task Notes</Text>
                <TextInput
                  style={s.noteInput}
                  placeholder="e.g., Finish Chapters 4-6"
                  placeholderTextColor={theme.secondaryText}
                  value={r.taskNotes}
                  onChangeText={(v) => onUpdate({ taskNotes: v })}
                  multiline
                />
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ── Main Screen ──
export default function DailyRemindersScreen() {
  const { theme } = useMindCareTheme();
  const s = createStyles(theme);
  const { reminders, loading, updateReminder: update } = useReminderSettings();
  const [customOpen, setCustomOpen] = useState(false);

  const toggle = async (id: string) => {
    const r = reminders[id as keyof ReminderState] as any;
    const newEnabled = !r.enabled;
    const key = id as keyof ReminderState;

    if (newEnabled) {
      const permitted = await requestNotificationPermissions();
      if (!permitted) {
        Alert.alert(
          "Permissions Required",
          "Please enable notification permissions in your device settings.",
        );
        return;
      }
    }
    // Construct the full new settings object before updating
    const newSettings = {
      ...reminders,
      [key]: { ...reminders[key], enabled: newEnabled },
    };
    await update(newSettings);
  };

  // This wrapper is kept for compatibility with the card components,
  // but it now just calls the hook's update function.
  const handleUpdate = async (id: string, updates: any) => {
    const key = id as keyof ReminderState;
    try {
      // Construct the full new settings object before updating
      const newSettings = {
        ...reminders,
        [key]: {
          ...reminders[key],
          ...updates,
        },
      };
      // Pass the complete, updated object to the hook
      await update(newSettings);
    } catch (err) {
      console.error("Error updating:", err);
      Alert.alert(
        "Error",
        "Could not save reminder settings. Please try again.",
      );
    } finally {
    }
  };

  // Applies a wellness template to its target reminder (no new data model).
  const applyTemplate = async (
    tpl: (typeof WELLNESS_TEMPLATES)[number],
  ) => {
    const key = tpl.target;
    if (!reminders[key]?.enabled) {
      const permitted = await requestNotificationPermissions();
      if (!permitted) {
        Alert.alert(
          "Permissions Required",
          "Please enable notification permissions in your device settings.",
        );
        return;
      }
    }
    const newSettings = {
      ...reminders,
      [key]: { ...reminders[key], ...tpl.preset, enabled: true },
    } as ReminderState;
    await update(newSettings);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Text style={s.loadText}>Loading reminders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const h = reminders.hydration;
  const sl = reminders.sleep;
  const br = reminders.breakTime;
  const ts = reminders.task;
  const next = getNextReminder(reminders);

  return (
    <SafeAreaView style={s.container}>
      <LinearGradient colors={theme.headerGradient} style={s.headerBg}>
        <View style={s.header}>
          <View style={{ width: 40 }} />
          <View>
            <Text style={s.headerTitle}>Daily Reminders</Text>
            <Text style={s.subtitle}>Build healthy routines</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Summary ── */}
        <View style={s.summaryCard}>
          <View style={s.summaryHeader}>
            <Ionicons name="today-outline" size={20} color={theme.primary} />
            <Text style={s.summaryTitle}>Routine for Today</Text>
            <View style={s.summaryCountPill}>
              <Text style={s.summaryCountText}>
                {[
                  reminders.hydration,
                  reminders.sleep,
                  reminders.breakTime,
                  reminders.task,
                ].filter((r) => r.enabled).length}{" "}
                active
              </Text>
            </View>
          </View>
          {next ? (
            <View style={s.nextRow}>
              <View
                style={[s.nextIcon, { backgroundColor: next.color }]}
              >
                <Ionicons name={next.icon as any} size={18} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.nextLabel}>Next up</Text>
                <Text style={s.nextName}>{next.label}</Text>
              </View>
              <View style={s.nextTimeWrap}>
                <Text style={s.nextTime}>{next.time}</Text>
                <Text style={s.nextDay}>{next.dayLabel}</Text>
              </View>
            </View>
          ) : (
            <Text style={s.summaryEmpty}>
              No reminders active yet. Tap a quick add below or switch one on.
            </Text>
          )}
        </View>

        {/* ── Quick Add ── */}
        <Text style={s.sectionTitle}>Quick Add</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tplRow}
        >
          {WELLNESS_TEMPLATES.map((t) => {
            const active = reminders[t.target].enabled;
            return (
              <Pressable
                key={t.id}
                style={[s.tplChip, active && s.tplChipActive]}
                onPress={() => applyTemplate(t)}
              >
                <View style={[s.tplChipIcon, { backgroundColor: t.color }]}>
                  <Ionicons name={t.icon as any} size={18} color="white" />
                </View>
                <View>
                  <Text style={[s.tplChipName, active && s.tplChipNameActive]}>
                    {t.name}
                  </Text>
                  <Text
                    style={[s.tplChipDesc, active && s.tplChipDescActive]}
                    numberOfLines={1}
                  >
                    {t.desc}
                  </Text>
                </View>
                {active && (
                  <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable style={s.customBtn} onPress={() => setCustomOpen(true)}>
          <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
          <Text style={s.customBtnText}>Create Custom Reminder</Text>
        </Pressable>

        {/* ── Wellness ── */}
        <Text style={s.sectionTitle}>Wellness</Text>
        <HydrationCard
          r={h}
          onToggle={() => toggle("hydration")}
          onUpdate={(u) => handleUpdate("hydration", u)}
        />
        <StandardCard
          id="sleep"
          r={sl}
          onToggle={() => toggle("sleep")}
          onUpdate={(u) => handleUpdate("sleep", u)}
        />
        <StandardCard
          id="breakTime"
          r={br}
          onToggle={() => toggle("breakTime")}
          onUpdate={(u) => handleUpdate("breakTime", u)}
        />

        {/* ── Academic ── */}
        <Text style={s.sectionTitle}>Academic</Text>
        <StandardCard
          id="task"
          r={ts}
          showTask
          onToggle={() => toggle("task")}
          onUpdate={(u) => handleUpdate("task", u)}
        />

        <View style={s.infoCard}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={theme.primary}
          />
          <Text style={s.infoText}>
            Notifications at scheduled times. Enable permissions to receive
            alerts.
          </Text>
        </View>
      </ScrollView>

      {/* ── Custom Reminder Modal ── */}
      <Modal
        visible={customOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomOpen(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setCustomOpen(false)} />
        <View style={s.modalSheet}>
          <View style={s.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>Create Custom Reminder</Text>
              <Text style={s.modalSubtitle}>
                Pick a template to build a routine.
              </Text>
            </View>
            <Pressable
              style={s.modalClose}
              onPress={() => setCustomOpen(false)}
            >
              <Ionicons name="close" size={22} color={theme.secondaryText} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={s.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {WELLNESS_TEMPLATES.map((t) => {
              const active = reminders[t.target].enabled;
              return (
                <Pressable
                  key={t.id}
                  style={s.modalItem}
                  onPress={() => {
                    applyTemplate(t);
                    setCustomOpen(false);
                  }}
                >
                  <View style={[s.tplChipIcon, { backgroundColor: t.color }]}>
                    <Ionicons name={t.icon as any} size={18} color="white" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalItemName}>{t.name}</Text>
                    <Text style={s.modalItemDesc}>{t.desc}</Text>
                  </View>
                  {active ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={theme.status.success}
                    />
                  ) : (
                    <Ionicons
                      name="add-circle"
                      size={22}
                      color={theme.primary}
                    />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadText: { fontSize: 16, color: theme.secondaryText },
  headerBg: { paddingBottom: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "white" },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 16,
  },
  // Card
  card: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 20,
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 4px 16px " + theme.shadow,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme.borderSoft,
  },
  cardH: { flexDirection: "row", alignItems: "center" },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  cardT: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: theme.text },
  cardDesc: { fontSize: 13, color: theme.secondaryText, marginTop: 2 },
  badge: {
    fontSize: 11,
    color: theme.primary,
    fontWeight: "600",
    marginTop: 4,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: "flex-start",
    overflow: "hidden",
  },
  saving: { fontSize: 12, color: theme.secondaryText, width: 50, textAlign: "center" },
  settings: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 16,
    gap: 16,
  },
  field: { gap: 8 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.secondaryText,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hint: { fontSize: 12, color: theme.secondaryText, fontStyle: "italic" },
  // Scroll Wheel Picker
  scrollWheelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 2,
  },
  scrollWheelLabel: {
    alignItems: "center",
    justifyContent: "center",
    width: 28,
  },
  scrollWheelLabelText: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.secondaryText,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  scrollWheelColon: {
    alignItems: "center",
    justifyContent: "center",
    width: 12,
    paddingTop: 8,
  },
  scrollWheelColonText: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.text,
  },
  // Time (legacy - kept for reference, not used)
  row: { gap: 8 },
  pillScroll: { flexDirection: "row" },
  pillScrollContent: {
    gap: 6,
    alignItems: "center",
    paddingVertical: 4,
    paddingRight: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.inputBg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  pillSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  pillText: { color: theme.text, fontWeight: "600", fontSize: 13 },
  pillTextSelected: { color: theme.onPrimary },
  periodRow: { flexDirection: "row", gap: 6 },
  periodPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.inputBg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  periodPillSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  periodPillText: { color: theme.text, fontWeight: "700", fontSize: 13 },
  periodPillTextSelected: { color: theme.onPrimary },
  // Repeat
  repeatRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  repeatPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: theme.inputBg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  repeatPillSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  repeatPillText: { color: theme.secondaryText, fontWeight: "600", fontSize: 12 },
  repeatPillTextSelected: { color: theme.onPrimary },
  dayPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: theme.inputBg,
    borderWidth: 1,
    borderColor: theme.border,
    minWidth: 40,
    alignItems: "center",
  },
  dayPillSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  dayPillText: { color: theme.secondaryText, fontWeight: "600", fontSize: 11 },
  dayPillTextSelected: { color: theme.onPrimary },
  // Inputs
  input: {
    backgroundColor: theme.inputBg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.text,
  },
  noteInput: {
    backgroundColor: theme.inputBg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.text,
    textAlignVertical: "top",
  },
  // Native Time Picker display button
  timeDisplayButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  timeDisplayText: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.text,
    flex: 1,
  },
  // Info
  infoCard: {
    flexDirection: "row",
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    alignItems: "flex-start",
  },
  infoText: { fontSize: 13, color: theme.status.success, lineHeight: 20, flex: 1 },

  /* ── Time Field + Modal ── */
  timeField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  timeFieldText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: theme.text,
    fontVariant: ["tabular-nums"],
  },

  /* ── Summary ── */
  summaryCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 20,
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 4px 16px " + theme.shadow,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme.borderSoft,
    gap: 14,
  },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.text,
    flex: 1,
  },
  summaryCountPill: {
    backgroundColor: theme.softPurple,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  summaryCountText: { fontSize: 12, fontWeight: "700", color: theme.primary },
  nextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.inputBg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.borderSoft,
  },
  nextIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  nextLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.secondaryText,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  nextName: { fontSize: 15, fontWeight: "700", color: theme.text, marginTop: 2 },
  nextTimeWrap: { alignItems: "flex-end" },
  nextTime: { fontSize: 15, fontWeight: "800", color: theme.primary },
  nextDay: { fontSize: 12, color: theme.secondaryText, marginTop: 2 },
  summaryEmpty: { fontSize: 13, color: theme.secondaryText, lineHeight: 20 },

  /* ── Sections + Templates ── */
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.text,
    marginTop: 6,
  },
  tplRow: { gap: 10, paddingVertical: 4, paddingRight: 8 },
  tplChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.card,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.borderSoft,
    maxWidth: 240,
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 2px 10px " + theme.shadow,
    elevation: 2,
  },
  tplChipActive: {
    backgroundColor: theme.softPurple,
    borderColor: theme.primary,
  },
  tplChipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  tplChipName: { fontSize: 13, fontWeight: "700", color: theme.text },
  tplChipNameActive: { color: theme.primary },
  tplChipDesc: { fontSize: 11, color: theme.secondaryText, marginTop: 1 },
  tplChipDescActive: { color: theme.accent.purple },
  customBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.softPurple,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.primary,
    borderRadius: 16,
    paddingVertical: 14,
  },
  customBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.primary,
  },

  /* ── Custom Reminder Modal ── */
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: theme.text },
  modalSubtitle: { fontSize: 13, color: theme.secondaryText, marginTop: 2 },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.inputBg,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: { padding: 20, gap: 10 },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.inputBg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.borderSoft,
  },
  modalItemName: { fontSize: 14, fontWeight: "700", color: theme.text },
  modalItemDesc: { fontSize: 12, color: theme.secondaryText, marginTop: 2 },
});
