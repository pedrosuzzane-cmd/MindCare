import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

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

const MOOD_INSIGHTS: Record<string, string[]> = {
  happy: [
    "You're carrying a bright energy today — that sense of lightness is worth protecting. Savor this moment and let it remind you what joy feels like.",
    "Happiness flows through you right now. Notice what brought it on and consider how you can invite more of this feeling into your daily life.",
    "Your positive mood is a sign that things are aligning. Take a moment to appreciate this — you've earned it.",
  ],
  sad: [
    "Sadness is a visitor, not a permanent resident. Be gentle with yourself today — rest, reflect, and trust that this feeling will pass.",
    "It's okay to not be okay. Let yourself feel what you're feeling without judgment. You are stronger than you know.",
    "Some days are heavy, and that's part of being human. Reach out to someone who cares — you don't have to carry this alone.",
  ],
  anxious: [
    "Your mind is racing, but you are safe. Take a slow breath and ground yourself in the present moment — this too shall pass.",
    "Anxiety is a false alarm. Pause and name three things you can see right now. You are here, you are okay.",
    "The worry feels real, but it's not the whole story. Focus on what you can control right now and let the rest go.",
  ],
  calm: [
    "You're in a peaceful state — this is a great time to reflect and recharge. Notice what's working and carry that forward.",
    "Calm is powerful. Use this centered energy to approach one thing you've been putting off with clarity and ease.",
    "This sense of peace is your baseline — return to it whenever the world gets loud. You know how to find your way back.",
  ],
  angry: [
    "Anger is a signal, not a solution. Before you act, take a moment to breathe and ask yourself what you really need right now.",
    "Your feelings are valid, but they don't have to control you. Step away for five minutes and give yourself space to cool down.",
    "Heat rises, but so can you. Channel this energy into something physical — a walk, a workout, or writing it all out.",
  ],
  excited: [
    "That spark of excitement is contagious — lean into it! Use this energy to start something new or make progress on a goal.",
    "You're buzzing with positive energy. Channel it into something creative or share your enthusiasm with someone who'll celebrate with you.",
    "Excitement is momentum waiting to be used. Write down one thing you want to do with this energy before it fades.",
  ],
  tired: [
    "Your body is asking for rest. Honor that need without guilt — rest is not lazy, it's essential.",
    "Fatigue is a sign you've been giving too much. Take a short break, hydrate, and give yourself permission to recharge.",
    "You don't have to earn rest. If you're tired, rest. A short pause now can save you from burning out later.",
  ],
  grateful: [
    "Gratitude is a superpower — it shifts your focus from what's missing to what's abundant. Hold onto that perspective.",
    "A grateful heart attracts more to be grateful for. Take a moment to share your appreciation with someone today.",
    "You see the good even when it's small — that's a sign of resilience. Keep nurturing that outlook.",
  ],
  hopeful: [
    "Hope is the anchor in stormy seas. Hold onto it — even a small sense of possibility can carry you through hard moments.",
    "You're looking toward the future with optimism. That's a beautiful thing. Take one small step today toward something you're hoping for.",
    "Hope isn't naive — it's courageous. Keep believing that better days are ahead, because they are.",
  ],
  lonely: [
    "Loneliness is a reminder that connection matters. Reach out to someone today — even a small conversation can lift the weight.",
    "You are not alone, even when it feels that way. There are people who care about you and would love to hear from you.",
    "Loneliness is the space between connections. Fill it with one small act of reaching out — a text, a call, a hello.",
  ],
  stressed: [
    "Stress is a sign you care deeply, but you don't have to carry it all alone. Take a deep breath and prioritize one thing at a time.",
    "The pressure you feel is real, but so is your strength. Break it down, breathe through it, and give yourself grace.",
    "You're under a lot of pressure right now. Step back for a moment and ask: what's the one thing that would make this better?",
  ],
  peaceful: [
    "Peace is a gift you've given yourself. Bask in it, let it settle into your bones, and carry it with you through the day.",
    "You've found a moment of stillness — that's precious. Use it to check in with yourself and set a gentle intention for the rest of the day.",
    "This peaceful feeling is your natural state. Whenever stress comes, remember you can always return to this place of calm.",
  ],
  neutral: [
    "Take a moment to check in with yourself. Notice how you're feeling without judgment — awareness is the first step toward well-being.",
    "Every emotion is valid. Breathe, reflect, and trust yourself to navigate whatever comes next.",
    "Wellness is a journey, not a destination. Give yourself credit for showing up and doing the work.",
  ],
};

function generateLocalInsight(mood?: string): string {
  const key = mood?.toLowerCase() || "neutral";
  const insights = MOOD_INSIGHTS[key] || MOOD_INSIGHTS.neutral;
  return insights[Math.floor(Math.random() * insights.length)];
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
  mad: "😡",
  fearful: "😰",
  flushed: "😅",
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
  const [localInsights, setLocalInsights] = useState<Record<string, string>>({});
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const listRef = useRef<FlatList<JournalEntryDoc>>(null);

  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);

  // Always start at the top so navigation never lands mid-list.
  useEffect(() => {
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, []);

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

  const handleGenerateInsight = (item: JournalEntryDoc) => {
    setGeneratingId(item.id);
    // Simulate brief delay for UX
    setTimeout(() => {
      const insight = generateLocalInsight(item.mood);
      setLocalInsights((prev) => ({ ...prev, [item.id]: insight }));
      setGeneratingId(null);
    }, 400);
  };

  const renderEntry = ({ item }: { item: JournalEntryDoc }) => {
    const moodEmoji = MOOD_EMOJIS[item.mood?.toLowerCase() || ""] || "";
    const displayInsight = item.aiInsight || localInsights[item.id];
    const isGenerating = generatingId === item.id;
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

        {displayInsight ? (
          <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <Ionicons name="bulb" size={16} color={theme.primary} />
              <Text style={styles.insightLabel}>AI Wellness Insight</Text>
            </View>
            <Text style={styles.insightText}>{displayInsight}</Text>
          </View>
        ) : null}

        {!item.aiInsight ? (
          <Pressable
            style={styles.generateBtn}
            onPress={() => handleGenerateInsight(item)}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color={theme.onPrimary} />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color={theme.onPrimary} />
                <Text style={styles.generateBtnText}>
                  {localInsights[item.id] ? "Regenerate Insight" : "Generate AI Wellness Insight"}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={theme.headerGradient}
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
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.stateText}>Loading journal entries...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.status.error} />
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
          <Ionicons name="book-outline" size={48} color={theme.border} />
          <Text style={styles.stateTitle}>No Journal Entries</Text>
          <Text style={styles.stateText}>
            {studentName || "This student"} has not written any journal entries yet.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderEntry}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={true}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
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
  stateTitle: { fontSize: 17, fontWeight: "700", color: theme.text, marginTop: 4 },
  stateText: { fontSize: 14, color: theme.secondaryText, textAlign: "center" },
  retryButton: {
    marginTop: 12,
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: { color: theme.onPrimary, fontWeight: "600", fontSize: 14 },
  list: { padding: 16, paddingBottom: 40 },
  entryCard: {
    backgroundColor: theme.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.borderSoft,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  entryDate: { fontSize: 13, fontWeight: "600", color: theme.primary },
  moodBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.softPurple,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  moodEmoji: { fontSize: 14 },
  moodText: { fontSize: 12, fontWeight: "600", color: theme.primary },
  entryTitle: { fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: 6 },
  entryText: { fontSize: 14, color: theme.text, lineHeight: 22 },
  insightCard: {
    backgroundColor: theme.secondaryCard,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.borderSoft,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  insightLabel: { fontSize: 12, fontWeight: "700", color: theme.primary, textTransform: "uppercase" },
  insightText: { fontSize: 13, color: theme.secondaryText, lineHeight: 20, fontStyle: "italic" },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: theme.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  generateBtnText: { color: theme.onPrimary, fontSize: 13, fontWeight: "600" },
});
