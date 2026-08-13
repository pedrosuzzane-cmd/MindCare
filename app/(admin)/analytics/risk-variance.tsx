import { BoxWhiskerChart } from "@/components/admin/BoxWhiskerChart";
import type { BoxWhiskerDataPoint } from "@/components/admin/BoxWhiskerChart";
import { listenForAdminDashboardData } from "@/services/adminFirestoreService";
import type { StudentSummary } from "@/services/adminFirestoreService";
import { getDepartmentCode } from "@/utils/departmentMeta";
import { useAuth } from "@/hooks/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DEPARTMENTS = ["CITCS", "COA", "CCJE", "CTE", "CON", "COE", "CAFA", "CHTM"];

const getBoxColor = (median: number): string => {
  if (median <= 20) return "#22C55E";
  if (median <= 50) return "#F59E0B";
  return "#EF4444";
};

export default function RiskTrendsScreen() {
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
        setError("Failed to load risk trend data.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user]);

  const boxWhiskerData = useMemo((): BoxWhiskerDataPoint[] => {
    const deptScores = new Map<string, number[]>();
    DEPARTMENTS.forEach((d) => deptScores.set(d, []));

    studentSummaries.forEach((s) => {
      if (s.latestTotalScore == null) return;
      const abbr = getDepartmentCode(s.department);
      if (deptScores.has(abbr)) {
        deptScores.get(abbr)!.push(s.latestTotalScore);
      }
    });

    return Array.from(deptScores.entries())
      .map(([label, scores]) => {
        const sorted = [...scores].sort((a, b) => a - b);
        const count = sorted.length;

        let min = 0, max = 0, q1 = 0, median = 0, q3 = 0;
        const outliers: number[] = [];
        let whiskerMin = 0, whiskerMax = 0;

        if (count > 0) {
          min = sorted[0];
          max = sorted[count - 1];

          if (count < 2) {
            q1 = min; median = min; q3 = max;
          } else if (count === 2) {
            q1 = min; median = Math.round((min + max) / 2); q3 = max;
          } else if (count === 3) {
            q1 = sorted[0]; median = sorted[1]; q3 = sorted[2];
          } else {
            q1 = sorted[Math.floor(count * 0.25)];
            median = sorted[Math.floor(count * 0.5)];
            q3 = sorted[Math.floor(count * 0.75)];
          }

          const iqr = q3 - q1;
          const lowerFence = q1 - 1.5 * iqr;
          const upperFence = q3 + 1.5 * iqr;
          sorted.forEach((v) => { if (v < lowerFence || v > upperFence) outliers.push(v); });
          whiskerMin = sorted.find((v) => v >= lowerFence) ?? min;
          whiskerMax = [...sorted].reverse().find((v) => v <= upperFence) ?? max;
        }

        return {
          label,
          min: whiskerMin,
          q1,
          median,
          q3,
          max: whiskerMax,
          outliers,
          count,
          boxColor: count > 0 ? getBoxColor(median) : "#E2E8F0",
        };
      })
      .sort((a, b) => b.median - a.median);
  }, [studentSummaries]);

  const highRiskDepts = useMemo(() => {
    return boxWhiskerData
      .filter((d) => d.median >= 40)
      .map((d) => d.label);
  }, [boxWhiskerData]);

  const highVarianceDepts = useMemo(() => {
    return boxWhiskerData
      .filter((d) => d.q3 - d.q1 > 25)
      .map((d) => d.label);
  }, [boxWhiskerData]);

  const totalAssessed = studentSummaries.filter((s) => s.latestTotalScore != null).length;
  const highRiskCount = studentSummaries.filter((s) => s.latestRiskLevel === "high").length;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8A63D2" />
          <Text style={styles.loadingText}>Loading risk trends...</Text>
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
            <Text style={styles.headerTitle}>Wellness Score Variance</Text>
            <Text style={styles.headerSubtitle}>Box & whisker distribution of assessment scores across departments</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, isWide && { padding: responsivePadding }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.kpiRow, isWide && styles.kpiRowWide]}>
            <View style={styles.kpiCard}>
              <Ionicons name="people" size={20} color="#8A63D2" />
              <Text style={styles.kpiValue}>{totalAssessed}</Text>
              <Text style={styles.kpiLabel}>Students Assessed</Text>
            </View>
            <View style={styles.kpiCard}>
              <Ionicons name="warning" size={20} color="#EF4444" />
              <Text style={styles.kpiValue}>{highRiskCount}</Text>
              <Text style={styles.kpiLabel}>Elevated Concern</Text>
            </View>
            <View style={styles.kpiCard}>
              <Ionicons name="stats-chart" size={20} color="#D97706" />
              <Text style={styles.kpiValue}>{boxWhiskerData.length}</Text>
              <Text style={styles.kpiLabel}>Depts Analyzed</Text>
            </View>
          </View>

          {(highRiskDepts.length > 0 || highVarianceDepts.length > 0) && (
            <View style={styles.alertCard}>
              <View style={styles.alertHeader}>
                <Ionicons name="information-circle" size={18} color="#D97706" />
                <Text style={styles.alertTitle}>Aggregate Wellness Insights</Text>
              </View>
              {highRiskDepts.length > 0 && (
                <Text style={styles.alertText}>
                  <Text style={styles.alertBold}>Elevated median wellness indicators: </Text>
                  {highRiskDepts.join(", ")} — these departments show elevated median scores
                  and may benefit from a review of available wellness supports.
                </Text>
              )}
              {highVarianceDepts.length > 0 && (
                <Text style={[styles.alertText, { marginTop: 8 }]}>
                  <Text style={styles.alertBold}>High variance: </Text>
                  {highVarianceDepts.join(", ")} — wide score distribution indicates differing
                  wellness scores across student cohorts.
                </Text>
              )}
            </View>
          )}

          <View style={styles.explanationCard}>
            <View style={styles.explanationHeader}>
              <Ionicons name="school-outline" size={20} color="#8A63D2" />
              <Text style={styles.explanationTitle}>Administrator Guide: Understanding Wellness Score Variance & Scoring</Text>
            </View>

            <Text style={styles.guideSectionTitle}>The Core Score (In-App Assessment Scale)</Text>
            <Text style={styles.guideText}>
              Each student's assessment score is the raw total of their latest
              in-app 20-item self-assessment (each item 0–4, reverse-scored where
              applicable), out of <Text style={{ fontWeight: "700" }}>80 points</Text>.
              It is a custom wellness indicator, not a standardized clinical scale.
            </Text>
              <View style={styles.guideScaleRow}>
                <View style={[styles.guideScaleItem, { backgroundColor: "#DCFCE7", borderColor: "#22C55E" }]}>
                  <Text style={[styles.guideScaleLabel, { color: "#166534" }]}>Lower Concern (0–20)</Text>
                  <Text style={styles.guideScaleDesc}>Indicators within the expected range; routine monitoring continues.</Text>
                </View>
                <View style={[styles.guideScaleItem, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]}>
                  <Text style={[styles.guideScaleLabel, { color: "#92400E" }]}>Moderate Concern (21–50)</Text>
                  <Text style={styles.guideScaleDesc}>Some concern indicators; may benefit from routine wellness resources.</Text>
                </View>
                <View style={[styles.guideScaleItem, { backgroundColor: "#FEE2E2", borderColor: "#EF4444" }]}>
                  <Text style={[styles.guideScaleLabel, { color: "#991B1B" }]}>Elevated Concern (51–80)</Text>
                  <Text style={styles.guideScaleDesc}>Elevated concern indicators; review according to the safeguarding and student-support protocol.</Text>
                </View>
              </View>

            <Text style={[styles.guideSectionTitle, { marginTop: 16 }]}>Reading the Box & Whisker Chart</Text>

            <View style={styles.guideRow}>
              <View style={styles.guideItem}>
                <View style={[styles.guideBullet, { backgroundColor: "#2D1B69" }]} />
                <View style={styles.guideItemContent}>
                  <Text style={styles.guideItemTitle}>The Center Line (Median / Q2)</Text>
                  <Text style={styles.guideItemText}>
                    Represents the exact middle score of students in that department. A high median indicates widespread elevated stress across the department.
                  </Text>
                </View>
              </View>
              <View style={styles.guideItem}>
                <View style={[styles.guideBullet, { backgroundColor: "#8A63D2" }]} />
                <View style={styles.guideItemContent}>
                  <Text style={styles.guideItemTitle}>The Box (Interquartile Range / IQR)</Text>
                  <Text style={styles.guideItemText}>
                    Spans from the 25th percentile (Q1) to the 75th percentile (Q3). A wide box (high IQR) indicates greater variation in wellness scores across the cohort. A narrow box means students share similar wellness indicator levels.
                  </Text>
                </View>
              </View>
              <View style={styles.guideItem}>
                <View style={[styles.guideBullet, { backgroundColor: "#94A3B8" }]} />
                <View style={styles.guideItemContent}>
                  <Text style={styles.guideItemTitle}>The Whiskers (Range)</Text>
                  <Text style={styles.guideItemText}>
                    Show the spread from the lowest to highest recorded scores within normal statistical boundaries.
                  </Text>
                </View>
              </View>
              <View style={styles.guideItem}>
                <View style={[styles.guideBullet, { backgroundColor: "#EF4444" }]} />
                <View style={styles.guideItemContent}>
                  <Text style={styles.guideItemTitle}>Outliers (Red Crosses)</Text>
                  <Text style={styles.guideItemText}>
                    Individual student scores falling far from the department norm (&gt; Q3 + 1.5 × IQR). These are statistical outliers that suggest review according to the safeguarding and student-support protocol — the aggregate trend alone does not define any student.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <BoxWhiskerChart
            data={boxWhiskerData}
            title="Wellness Score Distribution by Department"
            subtitle="Boxes span Q1–Q3 (interquartile range), center line = median. Red crosses mark outlier scores for staff review."
            yAxisLabel="Score"
          />

          {boxWhiskerData.length > 0 && (
            <View style={styles.summaryTable}>
              <Text style={styles.summaryTableTitle}>Department Wellness Summary</Text>
              <View style={styles.summaryTableHeader}>
                <Text style={[styles.summaryTableCell, styles.headerCell, { flex: 1.5 }]}>Department</Text>
                <Text style={[styles.summaryTableCell, styles.headerCell]}>Count</Text>
                <Text style={[styles.summaryTableCell, styles.headerCell]}>Median</Text>
                <Text style={[styles.summaryTableCell, styles.headerCell]}>IQR</Text>
                <Text style={[styles.summaryTableCell, styles.headerCell]}>Outliers</Text>
                <Text style={[styles.summaryTableCell, styles.headerCell]}>Range</Text>
              </View>
              {boxWhiskerData.map((d) => (
                <View key={d.label} style={styles.summaryTableRow}>
                  <Text style={[styles.summaryTableCell, { flex: 1.5, fontWeight: "700", color: "#2D1B69" }]}>
                    {d.label}
                  </Text>
                  <Text style={styles.summaryTableCell}>{d.count}</Text>
                  <Text style={styles.summaryTableCell}>{d.median}</Text>
                  <Text style={styles.summaryTableCell}>{d.q3 - d.q1}</Text>
                  <Text style={[styles.summaryTableCell, d.outliers.length > 0 ? { color: "#EF4444", fontWeight: "700" } : {}]}>
                    {d.outliers.length > 0 ? d.outliers.length : "0"}
                  </Text>
                  <Text style={styles.summaryTableCell}>{d.min}–{d.max}</Text>
                </View>
              ))}
            </View>
          )}
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
  kpiValue: { fontSize: 22, fontWeight: "900", color: "#2D1B69" },
  kpiLabel: { fontSize: 11, fontWeight: "700", color: "#8B5CF6", textAlign: "center" },
  alertCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  alertHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  alertTitle: { fontSize: 14, fontWeight: "800", color: "#92400E" },
  alertText: { fontSize: 13, color: "#78350F", lineHeight: 20 },
  alertBold: { fontWeight: "700" },
  summaryTable: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    shadowColor: "#6D28D9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  summaryTableTitle: { fontSize: 15, fontWeight: "800", color: "#2D1B69", marginBottom: 12 },
  summaryTableHeader: { flexDirection: "row", borderBottomWidth: 2, borderBottomColor: "#EDE9FE", paddingBottom: 8, marginBottom: 4 },
  summaryTableRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F8F6FC" },
  summaryTableCell: { flex: 1, fontSize: 13, color: "#475569", fontWeight: "600", textAlign: "center" },
  headerCell: { fontSize: 11, fontWeight: "800", color: "#8B5CF6", textTransform: "uppercase" },
  explanationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  explanationHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  explanationTitle: { fontSize: 16, fontWeight: "800", color: "#2D1B69", flex: 1 },
  guideSectionTitle: { fontSize: 14, fontWeight: "800", color: "#4C1D95", marginBottom: 6 },
  guideText: { fontSize: 13, color: "#64748B", lineHeight: 20, marginBottom: 12 },
  guideScaleRow: { gap: 10, marginBottom: 4 },
  guideScaleItem: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginBottom: 8,
  },
  guideScaleLabel: { fontSize: 14, fontWeight: "800", marginBottom: 2 },
  guideScaleDesc: { fontSize: 13, lineHeight: 18, color: "#475569" },
  guideRow: { gap: 12 },
  guideItem: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  guideBullet: { width: 12, height: 12, borderRadius: 6, marginTop: 4, flexShrink: 0 },
  guideItemContent: { flex: 1 },
  guideItemTitle: { fontSize: 14, fontWeight: "700", color: "#1E1B4B", marginBottom: 2 },
  guideItemText: { fontSize: 13, color: "#475569", lineHeight: 18 },
});
