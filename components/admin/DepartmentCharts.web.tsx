import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart as ReRadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
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
}

export interface ScatterPoint {
  studentId: string;
  department: string;
  journalCount: number;
  avgScore: number;
  riskLevel: "low" | "normal" | "high";
}

const RISK_COLORS: Record<string, string> = {
  low: "#22C55E",
  normal: "#EAB308",
  high: "#EF4444",
};

// ─── Helpers ──────────────────────────────────────────────────────────────
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return ((value - min) / (max - min)) * 100;
}

function concernLabel(risk: string): string {
  if (risk === "low") return "Lower concern";
  if (risk === "high") return "Elevated concern";
  return "Moderate concern";
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const first = payload[0]?.payload;
  const isBar = typeof first?.dept === "string";
  const deptCode = isBar ? String(label) : String(payload[0]?.name ?? label);
  const title = formatDepartmentName(deptCode);
  return (
    <View style={styles.tooltip}>
      <Text style={styles.tooltipLabel}>{title}</Text>
      {!isBar && label ? (
        <Text style={styles.tooltipMuted}>{label} (normalized 0–100)</Text>
      ) : null}
      {payload.map((p: any, i: number) => (
        <Text key={i} style={[styles.tooltipValue, { color: p.color }]}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
        </Text>
      ))}
      {isBar && typeof first.participationRate === "number" && (
        <Text style={styles.tooltipMuted}>
          Participation: {Math.round(first.participationRate * 100)}%
        </Text>
      )}
      <Text style={styles.tooltipNote}>
        Shows the latest recorded data; correlation never implies causation.
      </Text>
    </View>
  );
};

const ScatterTooltip = ({ active, payload }: any) => {
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
  const [chartMode, setChartMode] = useState<"bar" | "radar">("bar");

  if (data.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="bar-chart-outline" size={32} color="#CBD5E1" />
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
      })),
    [data],
  );

  const radarData = useMemo(() => {
    const scores = data.map((d) => d.avgScore);
    const journals = data.map((d) => d.journalCount);
    const lsns = data.map((d) => d.lsnCount);
    const assess = data.map((d) => d.assessmentCount);
    const rates = data.map((d) => d.participationRate);
    const minScore = Math.min(...scores);
    const maxScoreR = Math.max(...scores);
    const minJ = Math.min(...journals);
    const maxJ = Math.max(...journals);
    const minL = Math.min(...lsns);
    const maxL = Math.max(...lsns);
    const minA = Math.min(...assess);
    const maxA = Math.max(...assess);
    const minR = Math.min(...rates);
    const maxR = Math.max(...rates);
    return [
      {
        metric: "Avg Score",
        ...Object.fromEntries(
          data.map((d) => [d.deptAbbr, normalize(d.avgScore, minScore, maxScoreR)]),
        ),
      },
      {
        metric: "Journals",
        ...Object.fromEntries(
          data.map((d) => [d.deptAbbr, normalize(d.journalCount, minJ, maxJ)]),
        ),
      },
      {
        metric: "LSN Count",
        ...Object.fromEntries(
          data.map((d) => [d.deptAbbr, normalize(d.lsnCount, minL, maxL)]),
        ),
      },
      {
        metric: "Assessments",
        ...Object.fromEntries(
          data.map((d) => [d.deptAbbr, normalize(d.assessmentCount, minA, maxA)]),
        ),
      },
      {
        metric: "Participation",
        ...Object.fromEntries(
          data.map((d) => [d.deptAbbr, normalize(d.participationRate, minR, maxR)]),
        ),
      },
    ];
  }, [data]);

  const RADAR_COLORS = ["#8A63D2", "#16A34A", "#D97706", "#EF4444", "#0EA5E9", "#EC4899"];

  return (
    <View>
      <View style={styles.chartToggle}>
        <Pressable
          style={[styles.toggleBtn, chartMode === "bar" && styles.toggleBtnActive]}
          onPress={() => setChartMode("bar")}
        >
          <Ionicons name="bar-chart" size={14} color={chartMode === "bar" ? "white" : "#8A63D2"} />
          <Text style={[styles.toggleText, chartMode === "bar" && styles.toggleTextActive]}>Grouped Bar</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, chartMode === "radar" && styles.toggleBtnActive]}
          onPress={() => setChartMode("radar")}
        >
          <Ionicons name="git-network" size={14} color={chartMode === "radar" ? "white" : "#8A63D2"} />
          <Text style={[styles.toggleText, chartMode === "radar" && styles.toggleTextActive]}>Radar</Text>
        </Pressable>
      </View>

      {chartMode === "bar" ? (
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={barData} margin={{ top: 20, right: 20, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
            <XAxis
              dataKey="dept"
              tick={{ fill: "#334155", fontSize: 13, fontWeight: "700" }}
              axisLine={{ stroke: "#E2E8F0" }}
              tickLine={false}
            />
            <YAxis tick={{ fill: "#475569", fontSize: 11.5 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 13, paddingTop: 12, color: "#334155" }} />
            <Bar dataKey="Avg Score" fill="#8A63D2" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="Journals" fill="#16A34A" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="LSN" fill="#D97706" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="Assessments" fill="#0EA5E9" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <ReRadarChart data={radarData} margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
            <PolarGrid stroke="#EEF2F7" />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: "#334155", fontSize: 12, fontWeight: "700" }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "#475569", fontSize: 10.5 }}
              tickCount={5}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 13, paddingTop: 12, color: "#334155" }} />
            {data.map((d, i) => (
              <Radar
                key={d.deptAbbr}
                name={d.deptAbbr}
                dataKey={d.deptAbbr}
                stroke={RADAR_COLORS[i % RADAR_COLORS.length]}
                fill={RADAR_COLORS[i % RADAR_COLORS.length]}
                fillOpacity={0.15}
              />
            ))}
          </ReRadarChart>
        </ResponsiveContainer>
      )}

      <View style={styles.chartFooter}>
        <Text style={styles.chartFooterNote}>
          {chartMode === "bar"
            ? "Grouped bars comparing departments across key wellness metrics."
            : "Radar chart showing relative performance across 5 dimensions (normalized 0-100)."}
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
  const deptColors: Record<string, string> = {};
  const uniqueDepts = [...new Set(points.map((p) => p.department))];
  const palette = ["#8A63D2", "#16A34A", "#D97706", "#0EA5E9", "#EC4899", "#F97316", "#06B6D4"];
  uniqueDepts.forEach((d, i) => {
    deptColors[d] = palette[i % palette.length];
  });

  return (
    <View>
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
          <XAxis
            dataKey="journalCount"
            name="Journal Entries"
            tick={{ fill: "#334155", fontSize: 11.5 }}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
          />
          <YAxis
            dataKey="avgScore"
            name="Avg Assessment Score"
            domain={[0, 80]}
            tick={{ fill: "#334155", fontSize: 11.5 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Concern Indicator →",
              angle: -90,
              position: "insideLeft",
              style: { fill: "#64748B", fontSize: 12, fontWeight: "600" },
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
            <View style={[styles.riskDot, { backgroundColor: RISK_COLORS.low }]} />
            <Text style={styles.riskDotLabel}>Lower concern</Text>
          </View>
          <View style={styles.riskDotRow}>
            <View style={[styles.riskDot, { backgroundColor: RISK_COLORS.normal }]} />
            <Text style={styles.riskDotLabel}>Moderate concern</Text>
          </View>
          <View style={styles.riskDotRow}>
            <View style={[styles.riskDot, { backgroundColor: RISK_COLORS.high }]} />
            <Text style={styles.riskDotLabel}>Elevated concern</Text>
          </View>
        </View>
      </View>
      <View style={styles.chartFooter}>
        <Text style={styles.chartFooterNote}>
          Each dot represents a student. X-axis = journal frequency, Y-axis =
          latest concern indicator (WEMWBS score, 0–80). Use this plot to
          identify clusters and outliers needing follow-up. Correlation does
          not establish causation.
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  chartToggle: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3EEFF",
  },
  toggleBtnActive: {
    backgroundColor: "#8A63D2",
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8A63D2",
  },
  toggleTextActive: {
    color: "white",
  },
  tooltip: {
    backgroundColor: "#2A1745",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#6D28D9",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    maxWidth: 260,
  },
  tooltipLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#F8FAFC",
    marginBottom: 4,
  },
  tooltipValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#D1D5DB",
    marginTop: 2,
  },
  tooltipMuted: {
    fontSize: 11,
    color: "#A1A1AA",
    marginTop: 4,
    fontWeight: "600",
  },
  tooltipNote: {
    fontSize: 10,
    color: "#A1A1AA",
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
    color: "#94A3B8",
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
    color: "#94A3B8",
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
    color: "#64748B",
    fontWeight: "500",
  },
});
