import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useJournal } from "@/hooks/useJournal";
import { JournalCalendar } from "@/components/student/JournalCalendar";
import { WellnessChart } from "@/components/WellnessChart";

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

  const handleBack = () => {
    router.replace("/dashboard");
  };

  const onRefresh = useCallback(() => {
    manualSync();
  }, [manualSync]);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

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
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
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

        {/* Emotional Wellness Chart */}
        <View style={styles.wellnessCard}>
          <View style={styles.wellnessHeader}>
            <Text style={styles.wellnessTitle}>🌱 My Emotional Journey</Text>
          </View>
          <Text style={styles.wellnessSubtitle}>
            Every journal entry is a step toward understanding yourself.
          </Text>
          <WellnessChart
            journalEntries={journalEntries}
            currentMonth={currentMonth}
          />
        </View>
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
    paddingBottom: 20,
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
    paddingTop: 20,
    paddingBottom: 40,
  },
  // Wellness chart styles
  wellnessCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 4px 16px rgba(138, 99, 210, 0.08)",
    elevation: 3,
    paddingTop: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
  },
  wellnessHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  wellnessTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#333",
    letterSpacing: 0.2,
  },
  wellnessSubtitle: {
    fontSize: 13,
    color: "#888",
    marginBottom: 16,
    lineHeight: 18,
    paddingLeft: 4,
    paddingRight: 10,
  },
});