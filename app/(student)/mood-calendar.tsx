import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { shadows } from "@/utils/shadows";
import { auth, db } from "@/constants/firebase";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

interface JournalEntry {
  id: string;
  title: string;
  thoughts: string;
  date: Date;
  mood: string;
  category: string;
}

export default function MoodCalendarScreen() {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const moods = [
    { id: "happy", emoji: "😄", color: "#FFD700" },
    { id: "calm", emoji: "😊", color: "#98FB98" },
    { id: "relaxed", emoji: "😌", color: "#87CEEB" },
    { id: "good", emoji: "🙂", color: "#90EE90" },
    { id: "neutral", emoji: "😐", color: "#D3D3D3" },
    { id: "worried", emoji: "😟", color: "#FFA500" },
    { id: "sad", emoji: "😞", color: "#4169E1" },
    { id: "overwhelmed", emoji: "😣", color: "#8B0000" },
    { id: "exhausted", emoji: "😫", color: "#708090" },
    { id: "stressed", emoji: "😓", color: "#FF6347" },
    { id: "burnout", emoji: "😤", color: "#800020" },
    { id: "mad", emoji: "😡", color: "#DC2626" },
    { id: "fearful", emoji: "😰", color: "#2563EB" },
    { id: "flushed", emoji: "😅", color: "#F472B6" },
    { id: "very-upset", emoji: "😢", color: "#000080" },
  ];

  const handleAddEntry = () => {
    router.push("/new-journal-entry");
  };

  const handleViewEntry = (entryId: string) => {
    router.push({ pathname: "/journal-detail", params: { id: entryId } });
  };

  const handleGetSuggestions = () => {
    router.push("/journal-suggestions");
  };

  const getMoodForDate = (date: string) => {
    const entry = journalEntries.find((e) => {
      const entryDate = e.date;
      const entryDateStr = entryDate.toISOString().split("T")[0];
      return entryDateStr === date;
    });
    return entry?.mood || null;
  };

  const getMoodEmoji = (moodId: string | null) => {
    if (!moodId) return null;
    return moods.find((m) => m.id === moodId)?.emoji;
  };

  const getMoodColor = (moodId: string | null) => {
    if (!moodId) return theme.inputBg;
    return moods.find((m) => m.id === moodId)?.color;
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);

    const days = [];
    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, date: null, isCurrentMonth: false });
    }
    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dateStr = date.toISOString().split("T")[0];
      days.push({ day: i, date: dateStr, isCurrentMonth: true });
    }
    return days;
  };

  const prevMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1),
    );
  };

  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1),
    );
  };

  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setJournalEntries([]);
        setLoading(false);
        router.replace("/auth/login");
        return;
      }

      const q = query(
        collection(db, "users", user.uid, "journalEntries"),
        orderBy("createdAt", "desc"),
      );

      unsubSnapshot = onSnapshot(q, (snap) => {
        const entries = snap.docs.map((d) => {
          const data = d.data() as any;
          const createdAt = data.createdAt;
          const date =
            createdAt && typeof (createdAt as any).toDate === "function"
              ? (createdAt as any).toDate()
              : createdAt
                ? new Date(createdAt)
                : new Date();

          return {
            id: d.id,
            title: data.title || "Untitled",
            thoughts: data.thoughts || data.content || "",
            date,
            mood: data.mood || "",
            category: data.category || "",
          };
        });
        setJournalEntries(entries);
        setLoading(false);
      }, (snapshotErr) => {
        console.warn("Journal entries listener error:", snapshotErr);
        setLoading(false);
      });

      return () => {
        if (unsubSnapshot) unsubSnapshot();
      };
    });

    return () => {
      unsubAuth();
    };
  }, []);

  const calendarDays = generateCalendarDays();
  const monthName = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={theme.softGradient}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>Mood Calendar</Text>
          <Pressable onPress={handleAddEntry}>
            <Ionicons name="add-circle-outline" size={28} color={theme.primary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Month Navigation */}
          <View style={styles.monthNavigator}>
            <Pressable onPress={prevMonth}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </Pressable>
            <Text style={styles.monthText}>{monthName}</Text>
            <Pressable onPress={nextMonth}>
              <Ionicons name="chevron-forward" size={24} color={theme.primary} />
            </Pressable>
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarContainer}>
            {/* Day headers */}
            <View style={styles.dayHeaderRow}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <Text key={day} style={styles.dayHeader}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Calendar days */}
            <View style={styles.calendarGrid}>
              {calendarDays.map((dayObj, idx) => {
                const mood = dayObj.isCurrentMonth
                  ? getMoodForDate(dayObj.date!)
                  : null;
                const moodEmoji = getMoodEmoji(mood);
                const moodColor = getMoodColor(mood);

                return (
                  <Pressable
                    key={idx}
                    style={[
                      styles.dayCell,
                      dayObj.isCurrentMonth && mood && moodColor
                        ? { backgroundColor: moodColor }
                        : undefined,
                      !dayObj.isCurrentMonth && {
                        backgroundColor: theme.secondaryCard,
                      },
                    ]}
                    onPress={() => {
                      if (dayObj.isCurrentMonth) {
                        setSelectedDate(dayObj.date);
                      }
                    }}
                  >
                    {dayObj.isCurrentMonth && (
                      <>
                        <Text style={styles.dayNumber}>{dayObj.day}</Text>
                        {moodEmoji && (
                          <Text style={styles.moodEmoji}>{moodEmoji}</Text>
                        )}
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Mood Legend */}
          <View style={styles.legendContainer}>
            <Text style={styles.legendTitle}>Mood Legend</Text>
            <View style={styles.legendGrid}>
              {moods.map((mood) => (
                <View key={mood.id} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendColor,
                      { backgroundColor: mood.color },
                    ]}
                  />
                  <Text style={styles.legendLabel}>{mood.emoji}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* AI Suggestions Button */}
          <Pressable
            style={styles.suggestionsButton}
            onPress={handleGetSuggestions}
          >
            <LinearGradient
              colors={[theme.accent.purple, theme.primary, theme.primaryDeep]}
              style={styles.suggestionsBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="sparkles" size={20} color="white" />
              <Text style={styles.suggestionsButtonText}>
                Get AI Suggestions
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Selected Date Entry Preview */}
          {selectedDate && (
            <View style={styles.entryPreviewContainer}>
              <Text style={styles.previewTitle}>Entry for {selectedDate}</Text>
              {journalEntries
                .filter(
                  (e) => e.date.toISOString().split("T")[0] === selectedDate,
                )
                .map((entry) => (
                  <Pressable
                    key={entry.id}
                    style={styles.previewCard}
                    onPress={() => handleViewEntry(entry.id)}
                  >
                    <View style={styles.previewHeader}>
                      <Text style={styles.previewEntryTitle}>
                        {entry.title}
                      </Text>
                      <Text style={styles.previewMood}>
                        {getMoodEmoji(entry.mood)}
                      </Text>
                    </View>
                    <Text style={styles.previewThoughts} numberOfLines={2}>
                      {entry.thoughts}
                    </Text>
                    <Text style={styles.tapToViewText}>
                      Tap to view full entry
                    </Text>
                  </Pressable>
                ))}
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.primary,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  monthNavigator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  monthText: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.text,
  },
  calendarContainer: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 12,
    marginBottom: 24,
    ...(shadows.custom(2, 8, 0.08, 3, "#8A63D2") as any),
    borderWidth: 1,
    borderColor: theme.borderSoft,
  },
  dayHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dayHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.secondaryText,
    width: "14.28%",
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: theme.inputBg,
  },
  otherMonthDay: {
    backgroundColor: theme.secondaryCard,
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: "500",
    color: theme.text,
  },
  moodEmoji: {
    fontSize: 16,
    marginTop: 2,
  },
  legendContainer: {
    marginBottom: 24,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.text,
    marginBottom: 12,
  },
  legendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 12,
    ...(shadows.custom(1, 4, 0.05, 1, "#8A63D2") as any),
    borderWidth: 1,
    borderColor: theme.borderSoft,
  },
  legendItem: {
    alignItems: "center",
    marginBottom: 12,
    width: "25%",
  },
  legendColor: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 4,
  },
  legendLabel: {
    fontSize: 16,
  },
  suggestionsButton: {
    marginBottom: 24,
    borderRadius: 25,
    overflow: "hidden",
  },
  suggestionsBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  suggestionsButtonText: {
    color: theme.onPrimary,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  entryPreviewContainer: {
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.text,
    marginBottom: 12,
  },
  previewCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    ...(shadows.custom(1, 4, 0.06, 2, "#8A63D2") as any),
    borderWidth: 1,
    borderColor: theme.borderSoft,
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  previewEntryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.text,
    flex: 1,
  },
  previewMood: {
    fontSize: 18,
    marginLeft: 8,
  },
  previewThoughts: {
    fontSize: 12,
    color: theme.secondaryText,
    lineHeight: 18,
    marginBottom: 8,
  },
  tapToViewText: {
    fontSize: 11,
    color: theme.primary,
    fontWeight: "500",
  },
});
