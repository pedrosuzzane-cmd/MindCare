import { JournalEntry } from "@/services/journalService";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { shadows } from "@/utils/shadows";

interface JournalCalendarProps {
  journalEntries: JournalEntry[];
  getMoodEmoji: (moodId: string) => string;
  onDayPress: (date: Date) => void;
  selectedDate: Date;
  currentMonth: Date;
  onCurrentMonthChange: (date: Date) => void;
  onSelectedDateChange: (date: Date) => void;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isFutureDate = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime() > today.getTime();
};

const getCalendarDays = (monthDate: Date) => {
  const firstOfMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    1,
  );
  const startDay = firstOfMonth.getDay();
  const daysInMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
  ).getDate();
  const daysInPrevMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    0,
  ).getDate();

  const days = [] as { date: Date; isCurrentMonth: boolean }[];

  for (let i = startDay - 1; i >= 0; i--) {
    days.push({
      date: new Date(
        monthDate.getFullYear(),
        monthDate.getMonth() - 1,
        daysInPrevMonth - i,
      ),
      isCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    days.push({
      date: new Date(monthDate.getFullYear(), monthDate.getMonth(), day),
      isCurrentMonth: true,
    });
  }

  while (days.length % 7 !== 0) {
    const nextDay = days.length - startDay + 1;
    days.push({
      date: new Date(
        monthDate.getFullYear(),
        monthDate.getMonth() + 1,
        nextDay,
      ),
      isCurrentMonth: false,
    });
  }

  return days;
};

const formatMonthYear = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

const getWeekdayShort = (date: Date) =>
  date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);

const getCompactDays = (monthDate: Date, selectedDate: Date) => {
  const daysInMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
  ).getDate();
  const selectedDay =
    selectedDate.getFullYear() === monthDate.getFullYear() &&
    selectedDate.getMonth() === monthDate.getMonth()
      ? selectedDate.getDate()
      : 1;
  const startDay = Math.max(1, Math.min(selectedDay - 3, daysInMonth - 6));

  return Array.from({ length: Math.min(7, daysInMonth) }, (_, index) =>
    new Date(monthDate.getFullYear(), monthDate.getMonth(), startDay + index),
  );
};

export function JournalCalendar({
  journalEntries,
  getMoodEmoji,
  onDayPress,
  selectedDate,
  currentMonth,
  onCurrentMonthChange,
  onSelectedDateChange,
}: JournalCalendarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const calendarDays = useMemo(
    () => getCalendarDays(currentMonth),
    [currentMonth],
  );
  const compactDays = useMemo(
    () => getCompactDays(currentMonth, selectedDate),
    [currentMonth, selectedDate],
  );

  const getEntryForDate = (date: Date) => {
    return journalEntries.find((entry) =>
      sameDay(new Date(entry.entryDate), date),
    );
  };

  const handlePreviousMonth = () => {
    onCurrentMonthChange(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  };

  const handleNextMonth = () => {
    onCurrentMonthChange(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );
  };

  const handleTodayPress = () => {
    const today = new Date();
    onCurrentMonthChange(today);
    onSelectedDateChange(today);
  };

  return (
    <View style={styles.calendarCard}>
      <View style={styles.calendarHeader}>
        <Pressable onPress={handlePreviousMonth} style={styles.monthButton}>
          <Ionicons name="chevron-back" size={20} color="#333" />
        </Pressable>
        <View style={styles.calendarTitleContainer}>
          <Text style={styles.calendarTitle}>
            {formatMonthYear(currentMonth)}
          </Text>
          <Pressable style={styles.todayButton} onPress={handleTodayPress}>
            <Text style={styles.todayButtonText}>Today</Text>
          </Pressable>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setIsExpanded((expanded) => !expanded)}
            style={styles.monthButton}
            accessibilityLabel={isExpanded ? "Minimize calendar" : "Expand calendar"}
          >
            <Ionicons
              name={isExpanded ? "chevron-up" : "calendar-outline"}
              size={19}
              color="#6D28D9"
            />
          </Pressable>
          <Pressable onPress={handleNextMonth} style={styles.monthButton}>
            <Ionicons name="chevron-forward" size={20} color="#6D28D9" />
          </Pressable>
        </View>
      </View>
      {isExpanded ? (
        <>
          <View style={styles.weekDaysRow}>
            {Array.from({ length: 7 }).map((_, index) => {
              const weekday = new Date(1970, 0, index + 4);
              return (
                <Text key={index} style={styles.weekdayLabel}>
                  {getWeekdayShort(weekday)}
                </Text>
              );
            })}
          </View>
          <View style={styles.daysGrid}>
            {calendarDays.map((day) => {
              const isSelected = sameDay(day.date, selectedDate);
              const isToday = sameDay(day.date, new Date());
              const isFuture = isFutureDate(day.date);
              const entry = day.isCurrentMonth
                ? getEntryForDate(day.date)
                : undefined;
              const moodEmoji = entry ? getMoodEmoji(entry.mood) : null;
              return (
                <Pressable
                  key={day.date.toISOString()}
                  style={[
                    styles.dayButton,
                    !day.isCurrentMonth && styles.dayButtonFaded,
                    isFuture && styles.dayButtonDisabled,
                    isSelected && !isFuture && styles.dayButtonSelected,
                  ]}
                  onPress={() => onDayPress(day.date)}
                  disabled={isFuture}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      !day.isCurrentMonth && styles.dayLabelFaded,
                      isSelected && styles.dayLabelSelected,
                      isToday && !isSelected && styles.dayLabelToday,
                    ]}
                  >
                    {day.date.getDate()}
                  </Text>
                  {moodEmoji && <Text style={styles.dayMoodEmoji}>{moodEmoji}</Text>}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <View style={styles.compactDaysRow}>
          {compactDays.map((date) => {
            const isSelected = sameDay(date, selectedDate);
            const isToday = sameDay(date, new Date());
            const isFuture = isFutureDate(date);
            const entry = getEntryForDate(date);
            const moodEmoji = entry ? getMoodEmoji(entry.mood) : null;
            return (
              <Pressable
                key={date.toISOString()}
                style={[
                  styles.compactDay,
                  isFuture && styles.compactDayDisabled,
                  isSelected && !isFuture && styles.compactDaySelected,
                ]}
                onPress={() => onDayPress(date)}
                disabled={isFuture}
              >
                <Text style={[styles.compactWeekday, isSelected && styles.compactTextSelected]}>
                  {getWeekdayShort(date)}
                </Text>
                <Text style={[styles.compactDayNumber, isSelected && styles.compactTextSelected, isToday && !isSelected && styles.dayLabelToday]}>
                  {date.getDate()}
                </Text>
                {moodEmoji ? <Text style={styles.compactMood}>{moodEmoji}</Text> : <View style={styles.compactMoodPlaceholder} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
    ...(shadows.custom(2, 12, 0.1, 4, "#000") as any),
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  monthButton: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#F5F5F5",
  },
  calendarTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerActions: { flexDirection: "row", gap: 8 },
  calendarTitle: { fontSize: 16, fontWeight: "800", color: "#3B0764" },
  todayButton: {
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todayButtonText: { color: "#6D28D9", fontWeight: "700", fontSize: 12 },
  weekDaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    color: "#999",
    fontWeight: "600",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  dayButton: {
    width: "13%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    borderRadius: 12,
  },
  dayButtonFaded: { opacity: 0.35 },
  dayButtonDisabled: { opacity: 0.3 },
  dayButtonSelected: { backgroundColor: "#7C3AED" },
  dayLabel: { fontSize: 14, color: "#4C1D95", fontWeight: "700" },
  dayLabelFaded: { color: "#999" },
  dayLabelSelected: { color: "#FFFFFF" },
  dayMoodEmoji: { fontSize: 12, marginTop: 2 },
  dayLabelToday: {
    color: "#7C3AED",
    fontWeight: "800",
  },
  syncStatusIndicator: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: 6,
  },
  compactDaysRow: { flexDirection: "row", justifyContent: "space-between", gap: 5 },
  compactDay: { flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 10, borderRadius: 15, backgroundColor: "#FAF5FF" },
  compactDayDisabled: { opacity: 0.3 },
  compactDaySelected: { backgroundColor: "#7C3AED" },
  compactWeekday: { color: "#8B5CF6", fontSize: 10, fontWeight: "800" },
  compactDayNumber: { color: "#4C1D95", fontSize: 16, fontWeight: "900", marginTop: 4 },
  compactTextSelected: { color: "#FFFFFF" },
  compactMood: { fontSize: 11, marginTop: 3 },
  compactMoodPlaceholder: { height: 14, marginTop: 3 },
});
