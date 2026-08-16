import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { MindCareTheme } from "@/constants/theme";
import { useMindCareTheme } from "@/contexts/ThemeContext";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Local noon keeps the calendar date stable (no UTC/timezone drift). */
function atNoon(d: Date): Date {
  const base = new Date(d);
  base.setHours(12, 0, 0, 0);
  return base;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getCalendarDays(monthDate: Date): { date: Date; isCurrentMonth: boolean }[] {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
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

  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  for (let i = startDay - 1; i >= 0; i--) {
    days.push({
      date: new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, daysInPrevMonth - i),
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
    days.push({
      date: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, days.length - startDay + 1),
      isCurrentMonth: false,
    });
  }

  return days;
}

interface FollowUpDatePickerModalProps {
  visible: boolean;
  /** Currently committed follow-up date used to seed the draft. */
  initialDate: Date | null;
  /** Dates strictly before this (start of day) cannot be chosen. */
  minDate?: Date | null;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
}

export function FollowUpDatePickerModal({
  visible,
  initialDate,
  minDate,
  onCancel,
  onConfirm,
}: FollowUpDatePickerModalProps) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const seed = initialDate ? atNoon(initialDate) : new Date();
  const [draftDate, setDraftDate] = useState<Date>(() => atNoon(seed));
  const [viewMonth, setViewMonth] = useState<Date>(
    () => new Date(seed.getFullYear(), seed.getMonth(), 1),
  );

  const calendarDays = useMemo(() => getCalendarDays(viewMonth), [viewMonth]);

  const minDayMs = minDate ? startOfDay(minDate).getTime() : null;

  const handleDayPress = (date: Date) => {
    setDraftDate(atNoon(date));
  };

  const prevMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  };

  const monthLabel = viewMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>Select Follow-up Date</Text>
            <Pressable style={styles.closeBtn} onPress={onCancel} hitSlop={6}>
              <Ionicons name="close" size={20} color={theme.secondaryText} />
            </Pressable>
          </View>

          <View style={styles.monthRow}>
            <Pressable style={styles.monthBtn} onPress={prevMonth} hitSlop={6}>
              <Ionicons name="chevron-back" size={20} color={theme.primary} />
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable style={styles.monthBtn} onPress={nextMonth} hitSlop={6}>
              <Ionicons name="chevron-forward" size={20} color={theme.primary} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((label, index) => (
              <Text key={label + index} style={styles.weekLabel}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {calendarDays.map((day) => {
              const isSelected = draftDate !== null && sameDay(day.date, draftDate);
              const isToday = sameDay(day.date, new Date());
              const dayStartMs = new Date(
                day.date.getFullYear(),
                day.date.getMonth(),
                day.date.getDate(),
              ).getTime();
              const beforeMin =
                minDayMs !== null &&
                dayStartMs < minDayMs &&
                !(draftDate !== null && sameDay(day.date, draftDate));
              return (
                <Pressable
                  key={dateKey(day.date)}
                  style={[
                    styles.dayBtn,
                    isSelected && styles.dayBtnSelected,
                    isToday && !isSelected && styles.dayBtnToday,
                  ]}
                  disabled={beforeMin}
                  onPress={() => handleDayPress(day.date)}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      !day.isCurrentMonth && styles.dayLabelFaded,
                      beforeMin && styles.dayLabelDisabled,
                      isToday && !isSelected && styles.dayLabelToday,
                      isSelected && styles.dayLabelSelected,
                    ]}
                  >
                    {day.date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.selectBtn, !draftDate && styles.selectBtnDisabled]}
              disabled={!draftDate}
              onPress={() => {
                if (draftDate) onConfirm(draftDate);
              }}
            >
              <Text style={[styles.selectBtnText, !draftDate && styles.selectBtnTextDisabled]}>
                Select
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(17,24,39,0.55)",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    card: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 16,
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    title: {
      flex: 1,
      fontSize: 16,
      fontWeight: "800",
      color: theme.text,
    },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.inputBg,
      alignItems: "center",
      justifyContent: "center",
    },
    monthRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 14,
      marginBottom: 10,
    },
    monthBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.softPurple,
      alignItems: "center",
      justifyContent: "center",
    },
    monthLabel: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.text,
    },
    weekRow: {
      flexDirection: "row",
      marginBottom: 6,
    },
    weekLabel: {
      flex: 1,
      textAlign: "center",
      fontSize: 11,
      fontWeight: "800",
      color: theme.secondaryText,
    },
    daysGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    dayBtn: {
      width: "14.2857%",
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
    },
    dayBtnSelected: {
      backgroundColor: theme.primary,
    },
    dayBtnToday: {
      backgroundColor: theme.softPurple,
    },
    dayLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,
    },
    dayLabelFaded: {
      color: theme.secondaryText,
    },
    dayLabelDisabled: {
      color: theme.secondaryText,
      fontWeight: "500",
    },
    dayLabelToday: {
      color: theme.primary,
      fontWeight: "800",
    },
    dayLabelSelected: {
      color: theme.onPrimary,
      fontWeight: "800",
    },
    footer: {
      flexDirection: "row",
      gap: 10,
      marginTop: 14,
    },
    cancelBtn: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.inputBg,
    },
    cancelBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.secondaryText,
    },
    selectBtn: {
      flex: 2,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
    },
    selectBtnDisabled: {
      backgroundColor: theme.inputBg,
    },
    selectBtnText: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.onPrimary,
    },
    selectBtnTextDisabled: {
      color: theme.secondaryText,
    },
  });
