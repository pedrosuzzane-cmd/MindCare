import { db } from "@/constants/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { collection, getDocs } from "firebase/firestore";
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

/**
 * Admin Concern Monitor.
 *
 * PRIVACY-FIRST: journal text is private and never shown here. This screen
 * only surfaces METADATA (student, department, date, concern indicators, mood,
 * AI insight) so the guidance office can follow up appropriately without
 * exposing the student's writing.
 */

type RiskLevel = "moderate" | "high";

interface RiskFlag {
  entryId: string;
  studentUid: string;
  studentName: string;
  department: string;
  entryDate: string; // ISO string
  riskLevel: RiskLevel;
  riskScore: number;
  riskKeywords: string[]; // used only for internal aggregation, never displayed
  mood: string;
  aiInsight?: string;
}

const RISK_COLORS: Record<RiskLevel, { bg: string; text: string }> = {
  high: { bg: "#FEE2E2", text: "#DC2626" },
  moderate: { bg: "#FEF3C7", text: "#D97706" },
};

function formatEntryDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
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
  neutral: "😐",
  overwhelmed: "😣",
  exhausted: "😫",
  burnout: "😤",
  mad: "😡",
  fearful: "😰",
  flushed: "😅",
  "very-upset": "😢",
  worried: "😟",
  good: "🙂",
  relaxed: "😌",
};

export default function RiskMonitorScreen() {
  const [flags, setFlags] = useState<RiskFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<RiskFlag>>(null);

  // Always start at the top so navigation never lands mid-list.
  useEffect(() => {
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const allFlags: RiskFlag[] = [];

        for (const userDoc of usersSnap.docs) {
          const userData = userDoc.data();
          if (userData.role === "admin") continue;

          const journalSnap = await getDocs(
            collection(db, "users", userDoc.id, "journalEntries"),
          );

          for (const jDoc of journalSnap.docs) {
            const j = jDoc.data();
            const riskLevel = j.riskLevel as RiskLevel | undefined;
            if (riskLevel !== "moderate" && riskLevel !== "high") continue;

            const createdAt = j.createdAt?.toDate
              ? j.createdAt.toDate().toISOString()
              : j.entryDate || new Date().toISOString();

            const insight =
              j.reflectionLocal?.summary ||
              j.reflectionLocal?.emotion ||
              j.aiSummary ||
              undefined;

            allFlags.push({
              entryId: jDoc.id,
              studentUid: userDoc.id,
              studentName: userData.fullName || "Unknown Student",
              department: userData.department || "Unspecified",
              entryDate: createdAt,
              riskLevel,
              riskScore: j.riskScore || 0,
              riskKeywords: Array.isArray(j.riskKeywords)
                ? j.riskKeywords
                : [],
              mood: j.mood || "Unknown",
              aiInsight: insight,
            });
          }
        }

        allFlags.sort(
          (a, b) =>
            new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime(),
        );

        if (!cancelled) {
          setFlags(allFlags);
          setLoading(false);
        }
      } catch (err) {
        console.error("Risk monitor load error:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load.");
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const highCount = flags.filter((f) => f.riskLevel === "high").length;
  const moderateCount = flags.filter((f) => f.riskLevel === "moderate").length;

  const renderFlag = ({ item }: { item: RiskFlag }) => {
    const color = RISK_COLORS[item.riskLevel];
    return (
      <Pressable
        style={styles.flagCard}
        onPress={() =>
          router.push({
            pathname: "./student-detail",
            params: { uid: item.studentUid },
          })
        }
      >
        <View style={styles.flagHeader}>
          <View style={styles.flagIdentity}>
            <Text style={styles.studentName}>{item.studentName}</Text>
            <Text style={styles.department}>{item.department}</Text>
          </View>
          <View style={[styles.riskBadge, { backgroundColor: color.bg }]}>
            <Text style={[styles.riskBadgeText, { color: color.text }]}>
              {item.riskLevel === "high" ? "🔴 Elevated" : "🟡 Moderate"}
            </Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>
              {formatEntryDate(item.entryDate)}
            </Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Mood</Text>
            <Text style={styles.metaValue}>
              {MOOD_EMOJIS[item.mood.toLowerCase()] ?? ""} {item.mood}
            </Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Concern Score</Text>
            <Text style={styles.metaValue}>{item.riskScore}</Text>
          </View>
        </View>

        {item.aiInsight ? (
          <View style={styles.insightBlock}>
            <View style={styles.insightHeader}>
              <Ionicons name="bulb-outline" size={14} color="#8A63D2" />
              <Text style={styles.insightLabel}>AI Insight</Text>
            </View>
            <Text style={styles.insightText} numberOfLines={2}>
              {item.aiInsight}
            </Text>
            <Text style={styles.insightDisclaimer}>
              Non-clinical summary based on journal metadata — for guidance-office review only.
            </Text>
          </View>
        ) : null}

        <View style={styles.flagFooter}>
          <Text style={styles.statusText}>
            {item.riskLevel === "high"
              ? "Status: Follow-up Recommended"
              : "Status: Monitoring"}
          </Text>
          <Text style={styles.viewDetailText}>View student →</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#8A63D2", "#B794F6"]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="white" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Concern Monitor</Text>
            <Text style={styles.headerSubtitle}>
              Journal concern indicators · metadata only
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <View style={styles.privacyBanner}>
        <Ionicons name="shield-checkmark-outline" size={16} color="#6D28D9" />
        <Text style={styles.privacyBannerText}>
          Journal content stays private. Only metadata is shown so the guidance
          office can follow up per institutional policy.
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#8A63D2" />
          <Text style={styles.stateText}>Scanning journal metadata...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.stateTitle}>Failed to Load</Text>
          <Text style={styles.stateText}>{error}</Text>
        </View>
      ) : (
        <>
            <View style={styles.summaryRow}>
            <View style={[styles.summaryChip, styles.summaryHigh]}>
              <Text style={styles.summaryHighText}>{highCount} Elevated</Text>
            </View>
            <View style={[styles.summaryChip, styles.summaryModerate]}>
              <Text style={styles.summaryModerateText}>
                {moderateCount} Moderate
              </Text>
            </View>
            <Text style={styles.summaryTotal}>{flags.length} indicators total</Text>
          </View>

          {flags.length === 0 ? (
            <View style={styles.centerState}>
              <Ionicons name="shield-checkmark-outline" size={48} color="#22C55E" />
              <Text style={styles.stateTitle}>No Concern Indicators</Text>
              <Text style={styles.stateText}>
                No journal entries currently require follow-up.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={flags}
              keyExtractor={(item) => `${item.studentUid}-${item.entryId}`}
              renderItem={renderFlag}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={true}
            />
          )}
        </>
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
  headerSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  privacyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F3E8FF",
    borderBottomWidth: 1,
    borderBottomColor: "#E9D5FF",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  privacyBannerText: { flex: 1, fontSize: 12, color: "#6D28D9", lineHeight: 17 },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 40,
  },
  stateTitle: { fontSize: 17, fontWeight: "700", color: "#1E1B4B", marginTop: 4 },
  stateText: { fontSize: 14, color: "#64748B", textAlign: "center" },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  summaryHigh: { backgroundColor: "#FEE2E2" },
  summaryHighText: { fontSize: 13, fontWeight: "700", color: "#DC2626" },
  summaryModerate: { backgroundColor: "#FEF3C7" },
  summaryModerateText: { fontSize: 13, fontWeight: "700", color: "#D97706" },
  summaryTotal: { fontSize: 13, color: "#64748B", fontWeight: "600", marginLeft: "auto" },
  list: { padding: 16, paddingBottom: 40 },
  flagCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.08)",
  },
  flagHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  flagIdentity: { flex: 1, paddingRight: 10 },
  studentName: { fontSize: 16, fontWeight: "700", color: "#1E1B4B" },
  department: { fontSize: 13, color: "#64748B", marginTop: 2 },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  riskBadgeText: { fontSize: 12, fontWeight: "700" },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 10,
  },
  metaCell: { flexGrow: 1, minWidth: "30%" },
  metaLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  metaValue: { fontSize: 13, fontWeight: "600", color: "#334155" },
  insightBlock: {
    backgroundColor: "#F8F5FF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(138, 99, 210, 0.1)",
  },
  insightHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  insightLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8A63D2",
    textTransform: "uppercase",
  },
  insightText: { fontSize: 13, color: "#4B5563", lineHeight: 19, fontStyle: "italic" },
  insightDisclaimer: {
    fontSize: 11,
    color: "#8A63D2",
    marginTop: 6,
    fontWeight: "600",
    lineHeight: 15,
  },
  flagFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
  },
  statusText: { fontSize: 12, fontWeight: "700", color: "#8A63D2" },
  viewDetailText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
});
