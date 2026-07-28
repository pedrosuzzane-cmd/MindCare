import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchStudentJournals } from "@/services/adminFirestoreService";
import type { JournalEntryDoc } from "@/services/adminFirestoreService";

function formatDate(createdAt: JournalEntryDoc["createdAt"]): string {
  if (!createdAt) return "";
  if (typeof createdAt === "object" && "toDate" in createdAt) {
    return createdAt.toDate().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (typeof createdAt === "string") {
    return new Date(createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MOOD_EMOJIS: Record<string, string> = {
  happy: "😊",
  sad: "😢",
  anxious: "😰",
  calm: "😌",
  angry: "😠",
  excited: "🤩",
  tired: "😴",
  grateful: "🙏",
  hopeful: "🌟",
  lonely: "💔",
  stressed: "😫",
  peaceful: "🕊️",
};

export default function StudentJournalsScreen() {
  const { studentId, studentName } = useLocalSearchParams<{
    studentId: string;
    studentName: string;
  }>();
  const [entries, setEntries] = useState<JournalEntryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchStudentJournals(studentId)
      .then((data) => {
        if (!cancelled) {
          setEntries(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to load journal entries");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [studentId]);

  const renderEntry = ({ item }: { item: JournalEntryDoc }) => {
    const moodEmoji = MOOD_EMOJIS[item.mood?.toLowerCase() || ""] || "";
    return (
      <View style={styles.entryCard}>
        <View style={styles.entryHeader}>
          <Text style={styles.entryDate}>{formatDate(item.createdAt)}</Text>
          {item.mood && (
            <View style={styles.moodBadge}>
              {moodEmoji ? (
                <Text style={styles.moodEmoji}>{moodEmoji}</Text>
              ) : null}
              <Text style={styles.moodText}>{item.mood}</Text>
            </View>
          )}
        </View>

        {item.title ? (
          <Text style={styles.entryTitle}>{item.title}</Text>
        ) : null}

        {item.thoughts ? (
          <Text style={styles.entryText}>{item.thoughts}</Text>
        ) : null}

        {item.aiInsight ? (
          <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <Ionicons name="bulb" size={16} color="#8A63D2" />
              <Text style={styles.insightLabel}>AI Wellness Insight</Text>
            </View>
            <Text style={styles.insightText}>{item.aiInsight}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#8A63D2", "#B794F6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="white" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {studentName || "Journal Entries"}
            </Text>
            <Text style={styles.headerSubtitle}>Journal History</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#8A63D2" />
          <Text style={styles.stateText}>Loading journal entries...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.stateTitle}>Failed to Load</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              setError(null);
              fetchStudentJournals(studentId)
                .then(setEntries)
                .catch((err) => setError(err.message))
                .finally(() => setLoading(false));
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="book-outline" size={48} color="#D1D5DB" />
          <Text style={styles.stateTitle}>No Journal Entries</Text>
          <Text style={styles.stateText}>
            {studentName || "This student"} has not written any journal entries yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderEntry}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F2F8" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: "white", fontSize: 18, fontWeight: "700", textAlign: "center" },
  headerSubtitle: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "500", marginTop: 2 },
  centerState: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8, paddingHorizontal: 40 },
  stateTitle: { fontSize: 17, fontWeight: "700", color: "#1E1B4B", marginTop: 4 },
  stateText: { fontSize: 14, color: "#64748B", textAlign: "center" },
  retryButton: {
    marginTop: 12,
    backgroundColor: "#8A63D2",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: { color: "white", fontWeight: "600", fontSize: 14 },
  list: { padding: 16, paddingBottom: 40 },
  entryCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  entryDate: { fontSize: 13, fontWeight: "600", color: "#8A63D2" },
  moodBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3EEFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  moodEmoji: { fontSize: 14 },
  moodText: { fontSize: 12, fontWeight: "600", color: "#6D5BBF" },
  entryTitle: { fontSize: 16, fontWeight: "700", color: "#1E1B4B", marginBottom: 6 },
  entryText: { fontSize: 14, color: "#334155", lineHeight: 22 },
  insightCard: {
    backgroundColor: "#F8F5FF",
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(138, 99, 210, 0.1)",
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  insightLabel: { fontSize: 12, fontWeight: "700", color: "#8A63D2", textTransform: "uppercase" },
  insightText: { fontSize: 13, color: "#4B5563", lineHeight: 20, fontStyle: "italic" },
});
