import { DonutGauge, MultiDonutGauge } from "@/components/admin/DonutGauge";
import { StackedBarChart } from "@/components/admin/StackedBarChart";
import type { StackedBarItem } from "@/components/admin/StackedBarChart";
import { listenForAdminDashboardData } from "@/services/adminFirestoreService";
import type { StudentSummary } from "@/services/adminFirestoreService";
import { useAuth } from "@/hooks/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const POSITIVE_MOODS = new Set(["happy", "calm", "relaxed", "good"]);
const NEUTRAL_MOODS = new Set(["neutral"]);
const DISTRESSED_MOODS = new Set(["worried", "sad", "overwhelmed", "exhausted", "stressed", "burnout", "very-upset"]);

export default function MoodAnalyticsScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 900;
  const responsivePadding = Math.min(Math.max(screenWidth * 0.03, 24), 64);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [studentSummaries, setStudentSummaries] = useState<StudentSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = listenForAdminDashboardData(
      (data) => {
        setStudentSummaries(data.studentSummaries);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("Failed to load mood analytics.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user]);

  const totalStudents = studentSummaries.length;
  const assessedCount = studentSummaries.filter((s) => s.assessmentsCount > 0).length;
  const completionPct = totalStudents > 0 ? Math.round((assessedCount / totalStudents) * 100) : 0;

  const moodCounts = useMemo(() => {
    const counts = { positive: 0, neutral: 0, distressed: 0 };
    studentSummaries.forEach((s) => {
      Object.entries(s.moodCounts || {}).forEach(([mood, count]) => {
        const m = mood.toLowerCase();
        if (POSITIVE_MOODS.has(m)) counts.positive += count;
        else if (NEUTRAL_MOODS.has(m)) counts.neutral += count;
        else if (DISTRESSED_MOODS.has(m)) counts.distressed += count;
        else counts.neutral += count;
      });
    });
    return counts;
  }, [studentSummaries]);

  const totalMoods = moodCounts.positive + moodCounts.neutral + moodCounts.distressed || 1;

  const stackedBarData = useMemo((): StackedBarItem[] => {
    const deptMap = new Map<string, { positive: number; neutral: number; distressed: number }>();

    studentSummaries.forEach((s) => {
      const dept = s.department || "Unspecified";
      if (!deptMap.has(dept)) {
        deptMap.set(dept, { positive: 0, neutral: 0, distressed: 0 });
      }
      const entry = deptMap.get(dept)!;
      Object.entries(s.moodCounts || {}).forEach(([mood, count]) => {
        const m = mood.toLowerCase();
        if (POSITIVE_MOODS.has(m)) entry.positive += count;
        else if (NEUTRAL_MOODS.has(m)) entry.neutral += count;
        else if (DISTRESSED_MOODS.has(m)) entry.distressed += count;
        else entry.neutral += count;
      });
    });

    return Array.from(deptMap.entries())
      .map(([label, vals]) => ({
        label,
        ...vals,
        total: vals.positive + vals.neutral + vals.distressed,
      }))
      .filter((d) => d.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [studentSummaries]);

  const deptCompletionData = useMemo(() => {
    const deptMap = new Map<string, { total: number; assessed: number }>();
    studentSummaries.forEach((s) => {
      const dept = s.department || "Unspecified";
      if (!deptMap.has(dept)) {
        deptMap.set(dept, { total: 0, assessed: 0 });
      }
      const entry = deptMap.get(dept)!;
      entry.total++;
      if (s.assessmentsCount > 0) entry.assessed++;
    });

    return Array.from(deptMap.entries())
      .map(([label, vals]) => ({
        label,
        percentage: vals.total > 0 ? Math.round((vals.assessed / vals.total) * 100) : 0,
        total: vals.total,
        assessed: vals.assessed,
      }))
      .sort((a, b) => b.total - a.total);
  }, [studentSummaries]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8A63D2" />
          <Text style={styles.loadingText}>Loading mood analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={[styles.header, isWide && { paddingHorizontal: responsivePadding }]}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#0F172A" />
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Mood & Assessment Analytics</Text>
            <Text style={styles.headerSubtitle}>Department completion rates and mood distribution</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, isWide && { padding: responsivePadding }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.kpiRow, isWide && styles.kpiRowWide]}>
            <View style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: "#EDE9FE" }]}>
                <Ionicons name="people" size={18} color="#8A63D2" />
              </View>
              <Text style={styles.kpiValue}>{totalStudents}</Text>
              <Text style={styles.kpiLabel}>Total Students</Text>
            </View>
            <View style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: "#DCFCE7" }]}>
                <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
              </View>
              <Text style={styles.kpiValue}>{assessedCount}</Text>
              <Text style={styles.kpiLabel}>Assessed</Text>
            </View>
            <View style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="happy" size={18} color="#D97706" />
              </View>
              <Text style={styles.kpiValue}>{moodCounts.positive}</Text>
              <Text style={styles.kpiLabel}>Positive Moods</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overall Assessment Completion</Text>
            <View style={styles.gaugeSection}>
              <DonutGauge
                percentage={completionPct}
                size={180}
                strokeWidth={16}
                color="#8A63D2"
                trackColor="#F3EAFF"
                centerText={`${completionPct}%`}
                centerSubtext={`${assessedCount}/${totalStudents}`}
                label="Students who completed assessment"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Department Assessment Completion</Text>
            <View style={styles.deptGaugeRow}>
              {deptCompletionData.slice(0, isWide ? 6 : 4).map((dept) => (
                <View key={dept.label} style={styles.deptGaugeCard}>
                  <DonutGauge
                    percentage={dept.percentage}
                    size={100}
                    strokeWidth={10}
                    color={
                      dept.percentage >= 70 ? "#22C55E" : dept.percentage >= 40 ? "#F59E0B" : "#EF4444"
                    }
                    trackColor="#F3EAFF"
                    centerText={`${dept.percentage}%`}
                    centerSubtext={dept.label.split("(").pop()?.replace(")", "") || dept.label}
                  />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overall Mood Distribution</Text>
            <View style={styles.overallMoodRow}>
              <View style={styles.overallMoodCard}>
                <View style={[styles.moodBar, { flex: moodCounts.positive, backgroundColor: "#22C55E" }]} />
                <Text style={styles.moodPct}>{((moodCounts.positive / totalMoods) * 100).toFixed(1)}%</Text>
                <Text style={styles.moodLabel}>Positive</Text>
              </View>
              <View style={styles.overallMoodCard}>
                <View style={[styles.moodBar, { flex: moodCounts.neutral, backgroundColor: "#F59E0B" }]} />
                <Text style={styles.moodPct}>{((moodCounts.neutral / totalMoods) * 100).toFixed(1)}%</Text>
                <Text style={styles.moodLabel}>Neutral</Text>
              </View>
              <View style={styles.overallMoodCard}>
                <View style={[styles.moodBar, { flex: moodCounts.distressed, backgroundColor: "#EF4444" }]} />
                <Text style={styles.moodPct}>{((moodCounts.distressed / totalMoods) * 100).toFixed(1)}%</Text>
                <Text style={styles.moodLabel}>Distressed</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <StackedBarChart
              data={stackedBarData}
              title="Mood Distribution by Department"
              subtitle="Normalized proportions of positive, neutral, and distressed moods per department"
            />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F2F8" },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: "#64748B", fontWeight: "600" },
  errorText: { fontSize: 14, color: "#EF4444", marginBottom: 16, textAlign: "center" },
  backBtn: { backgroundColor: "#8A63D2", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  backBtnText: { color: "white", fontWeight: "700", fontSize: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    gap: 12,
  },
  backButton: { padding: 8, borderRadius: 999, backgroundColor: "#F1F5F9" },
  headerContent: { flex: 1 },
  headerTitle: { color: "#0F172A", fontSize: 20, fontWeight: "800" },
  headerSubtitle: { color: "#64748B", fontSize: 13, marginTop: 2 },
  scrollContent: { padding: 24, paddingBottom: 40, gap: 24 },
  kpiRow: { flexDirection: "row", gap: 12 },
  kpiRowWide: { gap: 20 },
  kpiCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    shadowColor: "#6D28D9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    gap: 8,
  },
  kpiIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  kpiValue: { fontSize: 22, fontWeight: "900", color: "#2D1B69" },
  kpiLabel: { fontSize: 11, fontWeight: "700", color: "#8B5CF6", textAlign: "center" },
  section: { gap: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#4C1D95", marginBottom: 4 },
  gaugeSection: { alignItems: "center", paddingVertical: 16 },
  deptGaugeRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  deptGaugeCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "#E9D5FF" },
  overallMoodRow: { flexDirection: "row", gap: 12, height: 140 },
  overallMoodCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "flex-end",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    shadowColor: "#6D28D9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  moodBar: { width: "100%", borderRadius: 6, minHeight: 4, marginBottom: 8 },
  moodPct: { fontSize: 18, fontWeight: "900", color: "#2D1B69" },
  moodLabel: { fontSize: 11, fontWeight: "700", color: "#8B5CF6", marginTop: 2 },
});
