import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { shadows } from "@/utils/shadows";
import { useJournal } from "@/hooks/useJournal";
import { JournalCalendar } from "@/components/student/JournalCalendar";
import { WellnessJourneyCard } from "@/components/journal/WellnessJourneyCard";

export default function DailyJournalScreen() {
  const {
    entries: journalEntries,
    loading,
    syncing,
    getMoodEmoji,
    manualSync,
  } = useJournal();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const onRefresh = useCallback(() => {
    manualSync();
  }, [manualSync]);

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

  const formatEntryDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  const recentEntries = [...journalEntries]
    .sort(
      (a, b) =>
        new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime(),
    )
    .slice(0, 4);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const getEntryForDate = (date: Date) => {
    return journalEntries.find((entry) =>
      sameDay(new Date(entry.entryDate), date),
    );
  };

  const handleDayPress = (date: Date) => {
    if (isFutureDate(date)) {
      Alert.alert(
        "Future Date",
        "You cannot create journal entries for future dates.",
      );
      return;
    }
    const entry = getEntryForDate(date);
    if (entry) {
      router.push({ pathname: "/journal-detail", params: { id: entry.id } });
    } else {
      router.push({
        pathname: "/new-journal-entry",
        params: { date: date.toISOString() },
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#8A63D2", "#7C5AC8"]}
        style={styles.headerGradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Daily Journal</Text>
            {syncing && <Text style={styles.syncingText}>(Syncing...)</Text>}
          </View>
          <TouchableOpacity
            style={styles.syncButton}
            onPress={onRefresh}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Ionicons name="sync-outline" size={22} color="white" />
            )}
          </TouchableOpacity>
        </View>

        {/* Subtitle */}
        <View style={styles.subtitleContainer}>
          <Text style={styles.headerSubtitle}>
            Reflect on your thoughts and feelings
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={syncing}
            onRefresh={onRefresh}
              colors={["#7C5AC8", "#8A63D2"]}
          />
        }
      >
        {/* Month Calendar */}
        <JournalCalendar
          journalEntries={journalEntries}
          getMoodEmoji={getMoodEmoji}
          onDayPress={handleDayPress}
          selectedDate={selectedDate}
          currentMonth={currentMonth}
          onCurrentMonthChange={setCurrentMonth}
          onSelectedDateChange={setSelectedDate}
        />

        {/* Write Journal Button for Today */}
        <Pressable
          style={styles.writeJournalBtn}
          onPress={() => {
            const today = new Date();
            const existing = getEntryForDate(today);
            if (existing) {
              router.push({
                pathname: "/journal-detail",
                params: { id: existing.id },
              });
            } else {
              router.push({
                pathname: "/new-journal-entry",
                params: { date: today.toISOString() },
              });
            }
          }}
        >
          <LinearGradient
            colors={["#9C7EEB", "#8A63D2"]}
            style={styles.writeJournalGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="create-outline" size={20} color="white" />
            <Text style={styles.writeJournalBtnText}>
              {getEntryForDate(new Date()) ? "View Today's Journal" : "Write Today's Journal"}
            </Text>
          </LinearGradient>
        </Pressable>

        {/* Your Wellness Journey Dashboard */}
        <WellnessJourneyCard
          entries={journalEntries}
          getMoodEmoji={getMoodEmoji}
          onWriteJournal={() =>
            router.push({
              pathname: "/new-journal-entry",
              params: { date: new Date().toISOString() },
            })
          }
          onOpenEntry={(id) =>
            router.push({ pathname: "/journal-detail", params: { id } })
          }
        />

        {/* Recent Journals */}
        {recentEntries.length > 0 && (
          <View style={styles.recentCard}>
            <View style={styles.recentHeader}>
              <Text style={styles.sectionTitle}>Recent Journals</Text>
              <Pressable
                onPress={() => router.push("/mood-calendar")}
                hitSlop={8}
              >
                <Text style={styles.seeAllText}>See All →</Text>
              </Pressable>
            </View>
            {recentEntries.map((entry) => (
              <Pressable
                key={entry.id}
                style={styles.recentRow}
                onPress={() =>
                  router.push({
                    pathname: "/journal-detail",
                    params: { id: entry.id },
                  })
                }
              >
                <Ionicons name="book-outline" size={18} color="#8A63D2" />
                <View style={styles.recentInfo}>
                  <Text style={styles.recentTitle} numberOfLines={1}>
                    {entry.title || "Untitled"}
                  </Text>
                  <Text style={styles.recentDate}>
                    {formatEntryDate(entry.entryDate)}
                  </Text>
                </View>
                <Text style={styles.recentMood}>
                  {getMoodEmoji(entry.mood)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F2F8",
  },
  headerGradient: {
    paddingBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "white",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  syncingText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "500",
  },
  placeholder: {
    width: 44,
  },
  syncButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  subtitleContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerSubtitle: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 40,
  },
  writeJournalBtn: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 20,
  },
  writeJournalGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  writeJournalBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2D2640",
    marginBottom: 14,
  },
  // Recent journals
  recentCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    ...(shadows.sm("#000") as any),
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8A63D2",
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0ECF6",
  },
  recentInfo: {
    flex: 1,
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2D2640",
  },
  recentDate: {
    fontSize: 12,
    color: "#8B7FA8",
    marginTop: 2,
  },
  recentMood: {
    fontSize: 20,
  },
});