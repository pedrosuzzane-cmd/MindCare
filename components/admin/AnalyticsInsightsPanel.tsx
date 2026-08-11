/**
 * Analytics Insights Panel — new aggregate, privacy-preserving sections for the
 * admin analytics dashboard:
 *
 *   • Aggregate Trend Alerts
 *   • Wellness Trend
 *   • Assessment Participation Trend
 *   • Recommended Administrative Actions
 *   • Safeguarding & Follow-Up summary (with link to the case queue)
 *
 * Every value is computed dynamically from live student summaries and the
 * safeguarding case store. Small groups are suppressed via analyticsPrivacy.
 * Language is deliberately non-clinical (indicators, not diagnoses).
 */

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StudentSummary } from "@/services/adminFirestoreService";
import { fetchFollowUpQueueCounts } from "@/services/safeguardingService";
import {
  averageWellness,
  buildDepartmentTrendRows,
  buildParticipationTrend,
  buildRecommendedActions,
  buildWellnessTrend,
  deriveTrendAlert,
  participationRate,
} from "@/utils/analyticsTrends";
import { MIN_ANALYTICS_GROUP_SIZE } from "@/utils/analyticsPrivacy";

const WINDOW_DAYS = 30;
const WINDOW_COUNT = 4;

interface AnalyticsInsightsPanelProps {
  students: StudentSummary[];
}

function DeltaBadge({ label }: { label: string }) {
  const up = label === "up";
  const down = label === "down";
  const color = up ? "#16A34A" : down ? "#DC2626" : "#94A3B8";
  const icon = up ? "arrow-up" : down ? "arrow-down" : "remove";
  return (
    <View style={[styles.deltaBadge, { backgroundColor: `${color}18` }]}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.deltaText, { color }]}>
        {up ? "Rising" : down ? "Declining" : "Steady"}
      </Text>
    </View>
  );
}

export default function AnalyticsInsightsPanel({
  students,
}: AnalyticsInsightsPanelProps) {
  const [followUpCounts, setFollowUpCounts] = useState({
    pendingReview: 0,
    inProgress: 0,
    monitoring: 0,
    resolved: 0,
  });

  useEffect(() => {
    let cancelled = false;
    fetchFollowUpQueueCounts()
      .then((counts) => {
        if (!cancelled) setFollowUpCounts(counts);
      })
      .catch((err) => console.warn("Follow-up counts unavailable:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const totalStudents = students.length;
  const cohortSuppressed = totalStudents < MIN_ANALYTICS_GROUP_SIZE;

  const wellnessSeries = useMemo(
    () =>
      buildWellnessTrend(
        students,
        WINDOW_DAYS * 24 * 60 * 60 * 1000,
        WINDOW_COUNT,
      ),
    [students],
  );
  const participationSeries = useMemo(
    () =>
      buildParticipationTrend(
        students,
        WINDOW_DAYS * 24 * 60 * 60 * 1000,
        WINDOW_COUNT,
      ),
    [students],
  );
  const wellnessAlert = useMemo(
    () => deriveTrendAlert(wellnessSeries, "Aggregate wellness"),
    [wellnessSeries],
  );
  const participationAlert = useMemo(
    () => deriveTrendAlert(participationSeries, "Assessment participation"),
    [participationSeries],
  );
  const departmentRows = useMemo(
    () => buildDepartmentTrendRows(students, WINDOW_DAYS * 24 * 60 * 60 * 1000),
    [students],
  );
  const recommendedActions = useMemo(
    () => buildRecommendedActions(wellnessAlert, participationAlert, departmentRows),
    [wellnessAlert, participationAlert, departmentRows],
  );

  const currentWellness = averageWellness(students);
  const currentParticipation = participationRate(students);
  const elevatedConcernCount = students.filter(
    (s) => s.latestRiskLevel === "high",
  ).length;
  const moderateConcernCount = students.filter(
    (s) => s.latestRiskLevel === "normal",
  ).length;

  const visibleDeptRows = departmentRows.filter((r) => r.studentCount > 0);
  const suppressedDeptCount = visibleDeptRows.filter((r) => r.suppressed).length;
  const displayedDeptRows = visibleDeptRows.slice(0, 6);

  const lastWellness = wellnessSeries[wellnessSeries.length - 1];
  const lastParticipation = participationSeries[participationSeries.length - 1];

  return (
    <View style={styles.container}>
      {/* ─── Aggregate Trend Alerts ─────────────────────────────────── */}
      <Text style={styles.sectionHeader}>Aggregate Trend Alerts</Text>
      <View style={styles.alertsGrid}>
        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <DeltaBadge label={wellnessAlert.kind} />
            <Text style={styles.alertTitle}>{wellnessAlert.title}</Text>
          </View>
          <Text style={styles.alertText}>{wellnessAlert.description}</Text>
        </View>
        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <DeltaBadge label={participationAlert.kind} />
            <Text style={styles.alertTitle}>{participationAlert.title}</Text>
          </View>
          <Text style={styles.alertText}>{participationAlert.description}</Text>
        </View>
      </View>
      <Text style={styles.alertFootnote}>
        Alerts are aggregate indicators computed from the latest reporting
        windows. They describe cohorts, not individual students, and are not
        clinical diagnoses.
      </Text>

      {/* ─── Wellness Trend + Participation Trend ───────────────────── */}
      <View style={styles.trendRow}>
        <View style={styles.trendCard}>
          <View style={styles.trendCardHeader}>
            <Ionicons name="pulse" size={16} color="#8A63D2" />
            <Text style={styles.trendCardTitle}>Wellness Trend</Text>
          </View>
          <Text style={styles.trendValue}>
            {cohortSuppressed || currentWellness == null
              ? "Data suppressed"
              : currentWellness}
          </Text>
          <Text style={styles.trendLabel}>Average latest wellness score</Text>
          <Text style={styles.trendHint}>
            {lastWellness?.suppressed
              ? "Latest window below privacy threshold."
              : `Latest window: ${lastWellness?.sampleSize ?? "—"} assessed students.`}
          </Text>
        </View>
        <View style={styles.trendCard}>
          <View style={styles.trendCardHeader}>
            <Ionicons name="checkbox" size={16} color="#8A63D2" />
            <Text style={styles.trendCardTitle}>Assessment Participation</Text>
          </View>
          <Text style={styles.trendValue}>
            {cohortSuppressed || currentParticipation == null
              ? "Data suppressed"
              : `${currentParticipation}%`}
          </Text>
          <Text style={styles.trendLabel}>of tracked students assessed</Text>
          <Text style={styles.trendHint}>
            {lastParticipation?.suppressed
              ? "Latest window below privacy threshold."
              : `Latest window: ${lastParticipation?.sampleSize ?? "—"} assessed students.`}
          </Text>
        </View>
      </View>

      {/* ─── Recommended Administrative Actions ─────────────────────── */}
      <Text style={styles.sectionHeader}>Recommended Administrative Actions</Text>
      <View style={styles.actionsCard}>
        {recommendedActions.map((action, i) => (
          <View key={i} style={styles.actionRow}>
            <View style={styles.actionIcon}>
              <Ionicons name="flag-outline" size={14} color="#6D28D9" />
            </View>
            <View style={styles.actionBody}>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionDesc}>{action.description}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* ─── Department comparison with privacy + trends ────────────── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Department Comparison</Text>
        {suppressedDeptCount > 0 && (
          <Text style={styles.suppressedTag}>
            {suppressedDeptCount} group(s) suppressed
          </Text>
        )}
      </View>
      {displayedDeptRows.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Department comparison data will appear once students are tracked.
          </Text>
        </View>
      ) : (
        <View style={styles.deptTable}>
          <View style={styles.deptTableHeader}>
            <Text style={[styles.deptCell, styles.deptCellDept]}>Department</Text>
            <Text style={styles.deptCell}>Avg Score</Text>
            <Text style={styles.deptCell}>Participation</Text>
            <Text style={styles.deptCell}>Journals</Text>
            <Text style={styles.deptCell}>Trend</Text>
          </View>
          {displayedDeptRows.map((row) => (
            <View key={row.department} style={styles.deptTableRow}>
              <View style={[styles.deptCell, styles.deptCellDept]}>
                <Text style={styles.deptName} numberOfLines={1}>
                  {row.department}
                </Text>
                <Text style={styles.deptCount}>{row.studentCount} students</Text>
              </View>
              <Text style={styles.deptCell}>
                {row.suppressed || row.averageWellness == null
                  ? "—"
                  : row.averageWellness}
              </Text>
              <Text style={styles.deptCell}>
                {row.suppressed || row.participationRate == null
                  ? "—"
                  : `${row.participationRate}%`}
              </Text>
              <Text style={styles.deptCell}>
                {row.suppressed || row.journalEngagement == null
                  ? "—"
                  : row.journalEngagement}
              </Text>
              <View style={styles.deptCell}>
                {row.suppressed ? (
                  <Text style={styles.suppressedText}>privacy</Text>
                ) : row.wellnessDelta == null ? (
                  <Text style={styles.flatText}>—</Text>
                ) : (
                  <DeltaBadge
                    label={
                      row.wellnessDelta > 0.5
                        ? "up"
                        : row.wellnessDelta < -0.5
                          ? "down"
                          : "flat"
                    }
                  />
                )}
              </View>
            </View>
          ))}
          {displayedDeptRows.length > 6 && (
            <Text style={styles.moreText}>
              +{displayedDeptRows.length - 6} more departments
            </Text>
          )}
        </View>
      )}
      <Text style={styles.alertFootnote}>
        Department statistics are withheld when a group has fewer than {MIN_ANALYTICS_GROUP_SIZE}{" "}
        students to prevent re-identification.
      </Text>

      {/* ─── Safeguarding & Follow-Up summary ───────────────────────── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Safeguarding & Follow-Up</Text>
        <Pressable
          style={({ pressed }) => [
            styles.queueButton,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => router.push("/(admin)/safeguarding")}
        >
          <Ionicons name="shield-checkmark-outline" size={14} color="#FFFFFF" />
          <Text style={styles.queueButtonText}>Open Follow-Up Queue</Text>
        </Pressable>
      </View>
      <View style={styles.safeguardingGrid}>
        <View style={styles.safeguardCard}>
          <Text style={styles.safeguardValue}>{elevatedConcernCount}</Text>
          <Text style={styles.safeguardLabel}>Elevated Concern</Text>
        </View>
        <View style={styles.safeguardCard}>
          <Text style={styles.safeguardValue}>{moderateConcernCount}</Text>
          <Text style={styles.safeguardLabel}>Moderate Concern</Text>
        </View>
        <View style={styles.safeguardCard}>
          <Text style={styles.safeguardValue}>{followUpCounts.pendingReview}</Text>
          <Text style={styles.safeguardLabel}>Cases Pending</Text>
        </View>
        <View style={styles.safeguardCard}>
          <Text style={styles.safeguardValue}>{followUpCounts.inProgress}</Text>
          <Text style={styles.safeguardLabel}>In Progress</Text>
        </View>
        <View style={styles.safeguardCard}>
          <Text style={styles.safeguardValue}>{followUpCounts.monitoring}</Text>
          <Text style={styles.safeguardLabel}>Monitoring</Text>
        </View>
        <View style={styles.safeguardCard}>
          <Text style={styles.safeguardValue}>{followUpCounts.resolved}</Text>
          <Text style={styles.safeguardLabel}>Resolved</Text>
        </View>
      </View>
      <Text style={styles.alertFootnote}>
        Concern counts reflect the latest assessment indicator per tracked
        student. Follow-up figures come from the safeguarding case store
        maintained by the guidance office. This is a summary — the queue holds
        the full follow-up record and audit log.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, marginTop: 8 },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "800",
    color: "#4C1D95",
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
  },
  alertsGrid: { gap: 10 },
  alertCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  alertHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  alertTitle: { fontSize: 13, fontWeight: "800", color: "#2D1B69", flex: 1 },
  alertText: { fontSize: 12, color: "#64748B", lineHeight: 18 },
  alertFootnote: { fontSize: 11, color: "#94A3B8", lineHeight: 16 },
  deltaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  deltaText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  trendRow: { flexDirection: "row", gap: 10 },
  trendCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  trendCardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  trendCardTitle: { fontSize: 13, fontWeight: "800", color: "#2D1B69", flex: 1 },
  trendValue: { fontSize: 24, fontWeight: "900", color: "#581C87" },
  trendLabel: { fontSize: 11, color: "#8B5CF6", fontWeight: "700", marginTop: 2 },
  trendHint: { fontSize: 11, color: "#94A3B8", marginTop: 6, lineHeight: 15 },
  actionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    gap: 12,
  },
  actionRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  actionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#EDE9FE",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  actionBody: { flex: 1 },
  actionTitle: { fontSize: 13, fontWeight: "700", color: "#1E1B4B" },
  actionDesc: { fontSize: 12, color: "#64748B", lineHeight: 17, marginTop: 2 },
  suppressedTag: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B45309",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    alignItems: "center",
  },
  emptyText: { fontSize: 13, color: "#94A3B8" },
  deptTable: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  deptTableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#EDE9FE",
    paddingBottom: 8,
  },
  deptTableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F8F6FC",
  },
  deptCell: {
    flex: 1,
    fontSize: 12,
    color: "#475569",
    fontWeight: "700",
    textAlign: "center",
  },
  deptCellDept: { flex: 1.6, alignItems: "flex-start", textAlign: "left" },
  deptName: { fontSize: 12, fontWeight: "800", color: "#2D1B69" },
  deptCount: { fontSize: 10, color: "#94A3B8", fontWeight: "600", marginTop: 2 },
  suppressedText: { fontSize: 11, color: "#94A3B8", fontStyle: "italic" },
  flatText: { fontSize: 11, color: "#94A3B8" },
  moreText: { fontSize: 11, color: "#8A63D2", fontWeight: "700", marginTop: 8 },
  queueButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#6D28D9",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  queueButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  safeguardingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  safeguardCard: {
    flexGrow: 1,
    flexBasis: "30%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  safeguardValue: { fontSize: 20, fontWeight: "900", color: "#581C87" },
  safeguardLabel: { fontSize: 11, color: "#8B5CF6", fontWeight: "700", marginTop: 2, textAlign: "center" },
});
