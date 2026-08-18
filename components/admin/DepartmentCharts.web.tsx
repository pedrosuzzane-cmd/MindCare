import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import type { MindCareTheme } from "@/constants/theme";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import {
  formatDepartmentName,
  getDepartmentCode,
} from "@/utils/departmentMeta";

// ─── Types ────────────────────────────────────────────────────────────────
export interface DeptComparisonMetric {
  deptAbbr: string;
  deptName: string;
  avgScore: number;
  journalCount: number;
  lsnCount: number;
  assessmentCount: number;
  participationRate: number;
  trackedStudents?: number;
  assessedStudents?: number;
}

export interface ScatterPoint {
  studentId: string;
  department: string;
  journalCount: number;
  avgScore: number;
  riskLevel: "low" | "normal" | "high";
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function concernLabel(risk: string): string {
  if (risk === "low") return "Lower concern";
  if (risk === "high") return "Elevated concern";
  return "Moderate concern";
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  if (!active || !payload?.length) return null;
  const first = payload[0]?.payload;
  const title = formatDepartmentName(String(label));
  return (
    <View style={styles.tooltip}>
      <Text style={styles.tooltipLabel}>{title}</Text>
      {payload.map((p: any, i: number) => (
        <Text key={i} style={[styles.tooltipValue, { color: p.color }]}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
        </Text>
      ))}
      {typeof first.participationRate === "number" && (
        <Text style={styles.tooltipMuted}>
          Participation: {Math.round(first.participationRate * 100)}%
        </Text>
      )}
      {typeof first.trackedStudents === "number" && (
        <Text style={styles.tooltipMuted}>
          Tracked / assessed students: {first.trackedStudents} /{" "}
          {first.assessedStudents ?? "—"}
        </Text>
      )}
      <Text style={styles.tooltipNote}>
        Shows the latest recorded data; correlation never implies causation.
      </Text>
    </View>
  );
};

const ScatterTooltip = ({ active, payload }: any) => {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <View style={styles.tooltip}>
      <Text style={styles.tooltipLabel}>
        {formatDepartmentName(d.department)}
      </Text>
      <Text style={styles.tooltipValue}>
        Concern: {concernLabel(d.riskLevel)}
      </Text>
      <Text style={styles.tooltipValue}>Avg Score: {d.avgScore} (0–80)</Text>
      <Text style={styles.tooltipValue}>Journals: {d.journalCount}</Text>
    </View>
  );
};

// ─── Component: DepartmentComparisonChart ──────────────────────────────────
interface ComparisonChartProps {
  data: DeptComparisonMetric[];
}

export function DepartmentComparisonChart({ data }: ComparisonChartProps) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  if (data.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="bar-chart-outline" size={32} color={theme.border} />
        <Text style={styles.emptyText}>No department data available</Text>
      </View>
    );
  }

  const barData = useMemo(
    () =>
      data.map((d) => ({
        dept: d.deptAbbr,
        "Avg Score": d.avgScore,
        "Journals": d.journalCount,
        "LSN": d.lsnCount,
        "Assessments": d.assessmentCount,
        participationRate: d.participationRate,
        trackedStudents: d.trackedStudents,
        assessedStudents: d.assessedStudents,
      })),
    [data],
  );

  return (
    <View>
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={barData} margin={{ top: 20, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
          <XAxis
            dataKey="dept"
            tick={{ fill: theme.text, fontSize: 13, fontWeight: "700" }}
            axisLine={{ stroke: theme.border }}
            tickLine={false}
          />
          <YAxis tick={{ fill: theme.secondaryText, fontSize: 11.5 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 13, paddingTop: 12, color: theme.text }} />
          <Bar dataKey="Avg Score" fill={theme.primary} radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Bar dataKey="Journals" fill={theme.status.success} radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Bar dataKey="LSN" fill={theme.status.warning} radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Bar dataKey="Assessments" fill={theme.status.info} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>

      <View style={styles.chartFooter}>
        <Text style={styles.chartFooterNote}>
          Grouped bars comparing departments across key wellness metrics.
        </Text>
      </View>
    </View>
  );
}

// ─── Component: DepartmentCorrelationScatter ───────────────────────────────
interface ScatterPlotProps {
  points: ScatterPoint[];
}

export function DepartmentCorrelationScatter({ points }: ScatterPlotProps) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const riskColors = {
    low: theme.status.success,
    normal: theme.status.warning,
    high: theme.status.error,
  };
  const deptColors: Record<string, string> = {};
  const uniqueDepts = [...new Set(points.map((p) => p.department))];
  const palette = [theme.primary, theme.status.success, theme.status.warning, theme.status.info, theme.accent.rose, theme.accent.amber, theme.accent.teal];
  uniqueDepts.forEach((d, i) => {
    deptColors[d] = palette[i % palette.length];
  });

  return (
    <View>
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
          <XAxis
            dataKey="journalCount"
            name="Journal Entries"
            tick={{ fill: theme.text, fontSize: 11.5 }}
            axisLine={{ stroke: theme.border }}
            tickLine={false}
          />
          <YAxis
            dataKey="avgScore"
            name="Avg Assessment Score"
            domain={[0, 80]}
            tick={{ fill: theme.text, fontSize: 11.5 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Concern Indicator →",
              angle: -90,
              position: "insideLeft",
              style: { fill: theme.secondaryText, fontSize: 12, fontWeight: "600" },
            }}
          />
          <ZAxis range={[60, 60]} />
          <Tooltip content={<ScatterTooltip />} />
          <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 10, paddingTop: 12 }} iconSize={8} />
          {uniqueDepts.map((dept) => (
            <Scatter
              key={dept}
              name={getDepartmentCode(dept)}
              data={points.filter((p) => p.department === dept)}
              fill={deptColors[dept]}
              opacity={0.7}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
      <View style={styles.scatterLegend}>
        <Text style={styles.chartFooterNote}>Point color = Department</Text>
        <View style={styles.scatterRiskLegend}>
          <View style={styles.riskDotRow}>
            <View style={[styles.riskDot, { backgroundColor: riskColors.low }]} />
            <Text style={styles.riskDotLabel}>Lower concern</Text>
          </View>
          <View style={styles.riskDotRow}>
            <View style={[styles.riskDot, { backgroundColor: riskColors.normal }]} />
            <Text style={styles.riskDotLabel}>Moderate concern</Text>
          </View>
          <View style={styles.riskDotRow}>
            <View style={[styles.riskDot, { backgroundColor: riskColors.high }]} />
            <Text style={styles.riskDotLabel}>Elevated concern</Text>
          </View>
        </View>
      </View>
      <View style={styles.chartFooter}>
        <Text style={styles.chartFooterNote}>
          Each dot represents a student. X-axis = journal frequency, Y-axis =
          latest in-app assessment score (0–80; higher = more concern
          indicators). Use this plot to
          identify clusters and outliers needing follow-up. Correlation does
          not establish causation.
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    tooltip: {
      backgroundColor: theme.card,
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: theme.border,
      elevation: 8,
      shadowColor: theme.text,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      maxWidth: 260,
    },
    tooltipLabel: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 4,
    },
    tooltipValue: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.secondaryText,
      marginTop: 2,
    },
    tooltipMuted: {
      fontSize: 11,
      color: theme.secondaryText,
      marginTop: 4,
      fontWeight: "600",
    },
    tooltipNote: {
      fontSize: 10,
      color: theme.secondaryText,
      fontStyle: "italic",
      marginTop: 6,
      lineHeight: 14,
    },
    chartFooter: {
      marginTop: 12,
      paddingHorizontal: 4,
    },
    chartFooterNote: {
      fontSize: 12,
      color: theme.secondaryText,
      fontStyle: "italic",
      lineHeight: 18,
    },
    emptyCard: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 40,
      gap: 8,
    },
    emptyText: {
      fontSize: 14,
      color: theme.secondaryText,
      fontWeight: "500",
    },
    scatterLegend: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
      marginTop: 8,
      paddingHorizontal: 4,
    },
    scatterRiskLegend: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    riskDotRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    riskDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    riskDotLabel: {
      fontSize: 11,
      color: theme.secondaryText,
      fontWeight: "500",
    },
  });
