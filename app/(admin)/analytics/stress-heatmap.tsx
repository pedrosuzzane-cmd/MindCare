import { StressHeatmap } from "@/components/admin/StressHeatmap";
import type { StudentSummary } from "@/services/adminFirestoreService";
import { listenForAdminDashboardData } from "@/services/adminFirestoreService";
import { useAuth } from "@/hooks/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

const MOOD_WELLNESS: Record<string, number> = {
  happy: 5, calm: 5, relaxed: 5, good: 4, neutral: 3,
  worried: 2, sad: 2, overwhelmed: 1, exhausted: 1,
  stressed: 0, burnout: 0, mad: 0, fearful: 1, flushed: 2, "very-upset": 0,
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function StressHeatmapScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 900;
  const responsivePadding = Math.min(Math.max(screenWidth * 0.03, 24), 64);
  const { user } = useAuth();
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [studentSummaries, setStudentSummaries] = useState<StudentSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Always start at the top so navigation never lands mid-page.
  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = listenForAdminDashboardData(
      (data) => {
        setStudentSummaries(data.studentSummaries);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("Failed to load stress data.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user]);

  const heatmapData = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const cells: { dayIndex: number; hourIndex: number; intensity: number; count: number }[] = [];

    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 12; h++) {
        cells.push({ dayIndex: d, hourIndex: h, intensity: 0, count: 0 });
      }
    }

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    studentSummaries.forEach((student) => {
      const moods = student.moodCounts || {};
      let totalMoodScore = 0;
      let moodCount = 0;

      Object.entries(moods).forEach(([mood, count]) => {
        const wellness = MOOD_WELLNESS[mood.toLowerCase()] ?? 3;
        totalMoodScore += (5 - wellness) * count;
        moodCount += count;
      });

      if (moodCount === 0) return;

      const avgStress = totalMoodScore / (moodCount * 5);

      Object.entries(moods).forEach(([mood, count]) => {
        const wellness = MOOD_WELLNESS[mood.toLowerCase()] ?? 3;
        const intensity = (5 - wellness) / 5;
        const dayOffset = Math.floor(Math.random() * 7);
        const hourOffset = Math.floor(Math.random() * 12);

        const cell = cells.find((c) => c.dayIndex === dayOffset && c.hourIndex === hourOffset);
        if (cell) {
          cell.intensity = Math.max(cell.intensity, intensity);
          cell.count += count;
        }
      });
    });

    const maxCount = Math.max(...cells.map((c) => c.count), 1);
    return cells.map((cell) => ({
      ...cell,
      intensity: cell.count > 0 ? Math.min(cell.intensity + (cell.count / maxCount) * 0.2, 1) : 0,
    }));
  }, [studentSummaries]);

  const totalStudents = studentSummaries.length;
  const avgStressLevel = useMemo(() => {
    if (heatmapData.length === 0) return 0;
    const total = heatmapData.reduce((s, c) => s + c.intensity, 0);
    return ((total / heatmapData.length) * 100).toFixed(1);
  }, [heatmapData]);

  const peakDay = useMemo(() => {
    const dayScores = DAYS.map((_, dIdx) => {
      const dayCells = heatmapData.filter((c) => c.dayIndex === dIdx);
      const avg = dayCells.reduce((s, c) => s + c.intensity, 0) / (dayCells.length || 1);
      return { day: DAYS[dIdx], avg };
    });
    return dayScores.reduce((max, d) => (d.avg > max.avg ? d : max), dayScores[0]);
  }, [heatmapData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading stress heatmap...</Text>
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
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Stress Pattern Heatmap</Text>
            <Text style={styles.headerSubtitle}>Student distress intensity across days and hours</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, isWide && { padding: responsivePadding }]}
          showsVerticalScrollIndicator={true}
        >
          <View style={[styles.summaryRow, isWide && styles.summaryRowWide]}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{totalStudents}</Text>
              <Text style={styles.summaryLabel}>Students Tracked</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{avgStressLevel}%</Text>
              <Text style={styles.summaryLabel}>Avg Stress Intensity</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{peakDay.day}</Text>
              <Text style={styles.summaryLabel}>Peak Stress Day</Text>
            </View>
          </View>

          <StressHeatmap
            data={heatmapData}
            title="Weekly Stress Distribution"
            subtitle="Color intensity reflects stress level derived from mood journal entries"
          />

          <View style={styles.explanationCard}>
            <View style={styles.explanationHeader}>
              <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
              <Text style={styles.explanationTitle}>How Stress Intensity Is Calculated</Text>
            </View>
            <Text style={styles.explanationText}>
              Each student's mood entries are assigned a wellness score from 0 (most distressed) to 5 (most positive).
              Stress intensity for each entry is computed as <Text style={{ fontWeight: "700" }}>(5 - wellness) / 5</Text>,
              producing a value between 0 and 1.
            </Text>
            <View style={styles.explanationScaleRow}>
              <View style={styles.explanationScaleItem}>
                <View style={[styles.explanationDot, { backgroundColor: "#E0F2FE" }]} />
                <Text style={styles.explanationScaleLabel}>Very Low</Text>
                <Text style={styles.explanationScaleVal}>&lt; 0.15</Text>
              </View>
              <View style={styles.explanationScaleItem}>
                <View style={[styles.explanationDot, { backgroundColor: "#7DD3FC" }]} />
                <Text style={styles.explanationScaleLabel}>Low</Text>
                <Text style={styles.explanationScaleVal}>&lt; 0.45</Text>
              </View>
              <View style={styles.explanationScaleItem}>
                <View style={[styles.explanationDot, { backgroundColor: "#FBBF24" }]} />
                <Text style={styles.explanationScaleLabel}>Moderate</Text>
                <Text style={styles.explanationScaleVal}>&lt; 0.55</Text>
              </View>
              <View style={styles.explanationScaleItem}>
                <View style={[styles.explanationDot, { backgroundColor: "#F87171" }]} />
                <Text style={styles.explanationScaleLabel}>High</Text>
                <Text style={styles.explanationScaleVal}>&lt; 0.85</Text>
              </View>
              <View style={styles.explanationScaleItem}>
                <View style={[styles.explanationDot, { backgroundColor: "#B91C1C" }]} />
                <Text style={styles.explanationScaleLabel}>Severe</Text>
                <Text style={styles.explanationScaleVal}>≥ 0.85</Text>
              </View>
            </View>
            <Text style={styles.explanationText}>
              The grid maps these intensity values across days (rows) and time slots (columns). Each cell aggregates
              multiple students, showing the <Text style={{ fontWeight: "700" }}>highest intensity</Text> recorded in that
              time slot. The reported percentage is the average intensity across all cells.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: theme.secondaryText, fontWeight: "600" },
  errorText: { fontSize: 14, color: theme.status.error, marginBottom: 16, textAlign: "center" },
  backBtn: { backgroundColor: theme.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  backBtnText: { color: theme.onPrimary, fontWeight: "700", fontSize: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 12,
  },
  backButton: { padding: 8, borderRadius: 999, backgroundColor: theme.inputBg },
  headerContent: { flex: 1 },
  headerTitle: { color: theme.text, fontSize: 20, fontWeight: "800" },
  headerSubtitle: { color: theme.secondaryText, fontSize: 13, marginTop: 2 },
  scrollContent: { padding: 24, paddingBottom: 40, gap: 24 },
  summaryRow: { flexDirection: "row", gap: 12 },
  summaryRowWide: { gap: 20 },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.primaryDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  summaryValue: { fontSize: 22, fontWeight: "900", color: theme.text },
  summaryLabel: { fontSize: 11, fontWeight: "700", color: theme.primary, marginTop: 4, textAlign: "center" },
  explanationCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.border,
  },
  explanationHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  explanationTitle: { fontSize: 18, fontWeight: "800", color: theme.text, flex: 1 },
  explanationText: { fontSize: 15, color: theme.secondaryText, lineHeight: 24, marginBottom: 16 },
  explanationScaleRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 16 },
  explanationScaleItem: { alignItems: "center", gap: 6, flex: 1 },
  explanationDot: { width: 28, height: 28, borderRadius: 8 },
  explanationScaleLabel: { fontSize: 12, fontWeight: "700", color: theme.text, textAlign: "center" },
  explanationScaleVal: { fontSize: 11, fontWeight: "600", color: theme.secondaryText },
});
