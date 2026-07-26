import {
    HydrationState,
    ReminderState,
    RepeatSchedule,
    StandardState,
} from "@/hooks/reminderDefaults";
import { useDebounce } from "@/hooks/useDebounce";
import { useReminderSettings } from "@/hooks/useReminderSettings";
import { requestNotificationPermissions } from "@/services/notificationService";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "expo-datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Alert,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import Animated, {
    Extrapolation,
    interpolate,
    SharedValue,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";

// ── Constants ──
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const PERIODS: ("AM" | "PM")[] = ["AM", "PM"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HYDRATION_INTERVALS = [15, 30, 45, 60, 90, 120];

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const REMINDER_META: Record<
  string,
  { icon: string; color: string; label: string; desc: string }
> = {
  hydration: {
    icon: "water-outline",
    color: "#2196F3",
    label: "Hydration Reminder",
    desc: "Interval-based hydration reminders",
  },
  sleep: {
    icon: "moon-outline",
    color: "#9C27B0",
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
    color: "#4CAF50",
    label: "Task Submission Reminder",
    desc: "Helps remember upcoming deadlines",
  },
};

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

function WheelItem<T>({
  item,
  index,
  scrollY,
  renderItem,
}: {
  item: T;
  index: number;
  scrollY: SharedValue<number>;
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
}) {
  const itemOffset = index * ITEM_HEIGHT;

  const animatedStyle = useAnimatedStyle(() => {
    // Calculate the distance of the item from the center of the picker
    const distance = Math.abs(scrollY.value - itemOffset);

    // Interpolate opacity: fully opaque at the center, fading out towards the edges
    const opacity = interpolate(
      distance,
      [0, PICKER_HEIGHT / 2],
      [1, 0.2],
      Extrapolation.CLAMP,
    );

    // Interpolate scale for a subtle 3D effect
    const scale = interpolate(
      distance,
      [0, PICKER_HEIGHT / 2],
      [1, 0.8],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      {renderItem(item, false)}
    </Animated.View>
  );
}

/**
 * A generic, reusable scroll wheel picker component.
 */
function ScrollWheelPicker<T>({
  items,
  selectedValue,
  onValueChange,
  renderItem,
  width = 60,
  isInfinite = true,
}: {
  items: T[];
  selectedValue: T;
  onValueChange: (value: T) => void;
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  width?: number;
  isInfinite?: boolean;
}) {
  // Create a looped data source for infinite scroll illusion
  const loopedItems = isInfinite ? [...items, ...items, ...items] : items;
  const middleBlockStartIndex = isInfinite ? items.length : 0;

  const scrollRef = useRef<Animated.ScrollView>(null);
  const initialIndex = isInfinite
    ? items.indexOf(selectedValue) + middleBlockStartIndex
    : items.indexOf(selectedValue);
  const [currentIndex, setCurrentIndex] = useState(
    initialIndex >= 0 ? initialIndex : 0,
  );

  useEffect(() => {
    const idx = items.indexOf(selectedValue);
    if (idx >= 0 && idx !== currentIndex) {
      setCurrentIndex(idx);
      scrollRef.current?.scrollTo({
        y: isInfinite
          ? (idx + middleBlockStartIndex) * ITEM_HEIGHT
          : idx * ITEM_HEIGHT,
        animated: true,
      });
    }
  }, [selectedValue, items, currentIndex, isInfinite, middleBlockStartIndex]);

  const scrollY = useSharedValue(initialIndex * ITEM_HEIGHT);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const newIndex = Math.round(y / ITEM_HEIGHT);

    // "Teleport" to the middle block if we're near the edges
    if (isInfinite) {
      if (newIndex < items.length / 2) {
        const targetIndex = newIndex + middleBlockStartIndex;
        scrollRef.current?.scrollTo({
          y: targetIndex * ITEM_HEIGHT,
          animated: false,
        });
      } else if (newIndex >= items.length * 2.5) {
        const targetIndex = newIndex - middleBlockStartIndex;
        scrollRef.current?.scrollTo({
          y: targetIndex * ITEM_HEIGHT,
          animated: false,
        });
      }
    }

    const selectedValueIndex = isInfinite ? newIndex % items.length : newIndex;

    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      onValueChange(items[selectedValueIndex]);
    }
    scrollRef.current?.scrollTo({
      y: newIndex * ITEM_HEIGHT,
      animated: true,
    });
  };

  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / ITEM_HEIGHT);
    const newIndex = Math.max(0, Math.min(idx, loopedItems.length - 1));
    scrollRef.current?.scrollTo({
      y: newIndex * ITEM_HEIGHT,
      animated: true,
    });
  };

  return (
    <View style={[s.wheelColumn, { width }]}>
      <View style={s.wheelHighlight} pointerEvents="none" />
      <Animated.ScrollView
        ref={scrollRef}
        style={s.wheelScroll}
        contentContainerStyle={s.wheelScrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate={0.998}
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollEndDrag={handleScrollEndDrag}
        bounces={false}
        // Set initial scroll position
        contentOffset={{ x: 0, y: initialIndex * ITEM_HEIGHT }}
      >
        <View style={{ height: PICKER_HEIGHT / 2 - ITEM_HEIGHT / 2 }} />
        {loopedItems.map((item, idx) => {
          // The new WheelItem handles its own animation
          return (
            <WheelItem
              key={idx}
              item={item}
              index={idx}
              scrollY={scrollY}
              renderItem={(it) => renderItem(it, idx === currentIndex)}
            />
          );
        })}
        <View style={{ height: PICKER_HEIGHT / 2 - ITEM_HEIGHT / 2 }} />
      </Animated.ScrollView>
    </View>
  );
}

// ── Native Time Picker (Android clock / iOS spinner) ──
function NativeTimePicker({
  val,
  onChange,
}: {
  val: { hour: number; minute: number; period: "AM" | "PM" };
  onChange: (v: { hour: number; minute: number; period: "AM" | "PM" }) => void;
}) {
  const [show, setShow] = useState(false);

  // Convert 12h time to a Date object for the picker
  const toDate = (t: typeof val): Date => {
    let h = t.hour;
    if (t.period === "PM" && h !== 12) h += 12;
    if (t.period === "AM" && h === 12) h = 0;
    const d = new Date();
    d.setHours(h, t.minute, 0, 0);
    return d;
  };

  // Convert Date back to 12h format
  const fromDate = (d: Date): typeof val => {
    const h = d.getHours();
    const m = d.getMinutes();
    const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
    let hour12 = h % 12;
    if (hour12 === 0) hour12 = 12;
    return { hour: hour12, minute: m, period };
  };

  const handleChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      // On Android, the picker closes automatically after any event
      setShow(false);

      // If user pressed Cancel, selectedDate is undefined — keep previous time
      if (!selectedDate) return;

      const newTime = fromDate(selectedDate);
      onChange(newTime);
    },
    [onChange],
  );

  return (
    <View>
      {/* Display current time as a tappable button */}
      <Pressable
        style={s.timeDisplayButton}
        onPress={() => setShow(true)}
      >
        <Ionicons name="time-outline" size={20} color="#4CAF50" />
        <Text style={s.timeDisplayText}>{fmt(val)}</Text>
        <Ionicons name="chevron-down" size={16} color="#999" />
      </Pressable>

      {/* Show native picker on Android (clock) and iOS (spinner) */}
      {show && (
        <DateTimePicker
          value={toDate(val)}
          mode="time"
          display={Platform.OS === "android" ? "clock" : "spinner"}
          onChange={handleChange}
        />
      )}
    </View>
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
          trackColor={{ false: "#E0E0E0", true: "#4CAF50" }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#E0E0E0"
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
              placeholderTextColor="#999"
              value={r.hydrationName}
              // Update local state immediately for responsive UI
              onChangeText={(v) => onUpdate({ hydrationName: v })}
            />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Start Time</Text>
            <NativeTimePicker
              val={r.startTime || { hour: 8, minute: 0, period: "AM" }}
              onChange={(v) => onUpdate({ startTime: v })}
            />
          </View>
          <View style={s.field}>
            <Text style={s.label}>End Time</Text>
            <NativeTimePicker
              val={r.endTime || { hour: 10, minute: 0, period: "PM" }}
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
              placeholderTextColor="#999"
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
          trackColor={{ false: "#E0E0E0", true: "#4CAF50" }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#E0E0E0"
          onValueChange={onToggle}
          value={r.enabled}
        />
      </View>
      {r.enabled && (
        <View style={s.settings}>
          <View style={s.field}>
            <Text style={s.label}>Time</Text>
            <NativeTimePicker
              val={r.time || { hour: 9, minute: 0, period: "AM" }}
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
              placeholderTextColor="#999"
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
                  placeholderTextColor="#999"
                  value={r.taskTitle}
                  onChangeText={(v) => onUpdate({ taskTitle: v })}
                />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Due Date</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g., Dec 15, 5:00 PM"
                  placeholderTextColor="#999"
                  value={r.taskDueDate}
                  onChangeText={(v) => onUpdate({ taskDueDate: v })}
                />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Task Notes</Text>
                <TextInput
                  style={s.noteInput}
                  placeholder="e.g., Finish Chapters 4-6"
                  placeholderTextColor="#999"
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
  const { reminders, loading, updateReminder: update } = useReminderSettings();

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

  return (
    <SafeAreaView style={s.container}>
      <LinearGradient colors={["#4CAF50", "#2E7D32"]} style={s.headerBg}>
        <View style={s.header}>
          <Pressable
            style={s.backBtn}
            onPress={() => router.replace("/dashboard")}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
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
            color="#4CAF50"
          />
          <Text style={s.infoText}>
            Notifications at scheduled times. Enable permissions to receive
            alerts.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadText: { fontSize: 16, color: "#888" },
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
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
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
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#333" },
  cardDesc: { fontSize: 13, color: "#888", marginTop: 2 },
  badge: {
    fontSize: 11,
    color: "#4CAF50",
    fontWeight: "600",
    marginTop: 4,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: "flex-start",
    overflow: "hidden",
  },
  saving: { fontSize: 12, color: "#888", width: 50, textAlign: "center" },
  settings: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingTop: 16,
    gap: 16,
  },
  field: { gap: 8 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hint: { fontSize: 12, color: "#888", fontStyle: "italic" },
  // Scroll Wheel Picker
  scrollWheelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
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
    color: "#999",
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
    color: "#333",
  },
  wheelColumn: {
    height: PICKER_HEIGHT,
    overflow: "hidden",
    position: "relative",
  },
  wheelHighlight: {
    position: "absolute",
    top: PICKER_HEIGHT / 2 - ITEM_HEIGHT / 2,
    left: 2,
    right: 2,
    height: ITEM_HEIGHT,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    borderRadius: 12,
    zIndex: 10,
  },
  wheelScroll: {
    flex: 1,
  },
  wheelScrollContent: {
    alignItems: "center",
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  wheelItemSelected: {},
  wheelItemText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#999",
  },
  wheelItemTextSelected: {
    fontSize: 22,
    fontWeight: "800",
    color: "#2E7D32",
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
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  pillSelected: { backgroundColor: "#4CAF50", borderColor: "#4CAF50" },
  pillText: { color: "#333", fontWeight: "600", fontSize: 13 },
  pillTextSelected: { color: "white" },
  periodRow: { flexDirection: "row", gap: 6 },
  periodPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  periodPillSelected: { backgroundColor: "#9C27B0", borderColor: "#9C27B0" },
  periodPillText: { color: "#333", fontWeight: "700", fontSize: 13 },
  periodPillTextSelected: { color: "white" },
  // Repeat
  repeatRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  repeatPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  repeatPillSelected: { backgroundColor: "#4CAF50", borderColor: "#4CAF50" },
  repeatPillText: { color: "#555", fontWeight: "600", fontSize: 12 },
  repeatPillTextSelected: { color: "white" },
  dayPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    minWidth: 40,
    alignItems: "center",
  },
  dayPillSelected: { backgroundColor: "#4CAF50", borderColor: "#4CAF50" },
  dayPillText: { color: "#555", fontWeight: "600", fontSize: 11 },
  dayPillTextSelected: { color: "white" },
  // Inputs
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#333",
  },
  noteInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#333",
    textAlignVertical: "top",
  },
  // Native Time Picker display button
  timeDisplayButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  timeDisplayText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
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
  infoText: { fontSize: 13, color: "#2E7D32", lineHeight: 20, flex: 1 },
});
