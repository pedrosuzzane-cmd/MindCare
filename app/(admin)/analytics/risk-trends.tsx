import { BoxWhiskerChart } from "@/components/admin/BoxWhiskerChart";
import type { BoxWhiskerDataPoint } from "@/components/admin/BoxWhiskerChart";
import { listenForAdminDashboardData } from "@/services/adminFirestoreService";
import type { StudentSummary } from "@/services/adminFirestoreService";
import { useAuth } from "@/hooks/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

    studentSummaries.forEach((s) => {
      if (s.latestTotalScore == null) return;
      const dept = s.department || "Unspecified";
      if (!deptScores.has(dept)) {
        deptScores.set(dept, []);
      }
      deptScores.get(dept)!.push(s.latestTotalScore);
    });

    return Array.from(deptScores.entries())
      .map(([label, scores]) => {
        if (scores.length < 4) return null;
        const sorted = [...scores].sort((a, b) => a - b);
        const count = sorted.length;
        const min = sorted[0];
        const max = sorted[count - 1];
        const q1 = sorted[Math.floor(count * 0.25)];
        const median = sorted[Math.floor(count * 0.5)];
        const q3 = sorted[Math.floor(count * 0.75)];
        const iqr = q3 - q1;

        const lowerFence = q1 - 1.5 * iqr;
        const upperFence = q3 + 1.5 * iqr;

        const outliers = sorted.filter((v) => v < lowerFence || v > upperFence);

        const whiskerMin = sorted.find((v) => v >= lowerFence) ?? min;
        const whiskerMax = [...sorted].reverse().find((v) => v <= upperFence) ?? max;

        return {
          label: label.split("(").pop()?.replace(")", "") || label,
          min: whiskerMin,
          q1,
          median,
          q3,
          max: whiskerMax,
          outliers,
          count,
        };
      })
      .filter((d): d is BoxWhiskerDataPoint => d !== null)
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
            <Text style={styles.headerTitle}>Risk Score Variance</Text>
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
              <Text style={[styles.kpiValue, { color: "#EF4444" }]}>{highRiskCount}</Text>
              <Text style={styles.kpiLabel}>High Risk</Text>
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
                <Text style={styles.alertTitle}>Intervention Insights</Text>
              </View>
              {highRiskDepts.length > 0 && (
                <Text style={styles.alertText}>
                  <Text style={styles.alertBold}>High median risk: </Text>
                  {highRiskDepts.join(", ")} — these departments show elevated median scores
                  and may need targeted wellness support.
                </Text>
              )}
              {highVarianceDepts.length > 0 && (
                <Text style={[styles.alertText, { marginTop: 8 }]}>
                  <Text style={styles.alertBold}>High variance: </Text>
                  {highVarianceDepts.join(", ")} — wide score distribution indicates inconsistent
                  wellness across student cohorts.
                </Text>
              )}
            </View>
          )}

          <BoxWhiskerChart
            data={boxWhiskerData}
            title="Risk Score Distribution by Department"
            subtitle="Boxes span Q1–Q3 (interquartile range), center line = median. Red crosses mark outlier students needing attention."
            yAxisLabel="Score"
          />

          {boxWhiskerData.length > 0 && (
            <View style={styles.summaryTable}>
              <Text style={styles.summaryTableTitle}>Department Risk Summary</Text>
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
  summaryTableTitle: { fontSize: 14, fontWeight: "800", color: "#2D1B69", marginBottom: 12 },
  summaryTableHeader: { flexDirection: "row", borderBottomWidth: 2, borderBottomColor: "#EDE9FE", paddingBottom: 8, marginBottom: 4 },
  summaryTableRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F8F6FC" },
  summaryTableCell: { flex: 1, fontSize: 11, color: "#475569", fontWeight: "600", textAlign: "center" },
  headerCell: { fontSize: 10, fontWeight: "800", color: "#8B5CF6", textTransform: "uppercase" },
});
