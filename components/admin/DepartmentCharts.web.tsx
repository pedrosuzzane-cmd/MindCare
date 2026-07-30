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

// ─── Custom Tooltip ────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <View style={styles.tooltip}>
      <Text style={styles.tooltipLabel}>{label}</Text>
      {payload.map((p: any, i: number) => (
        <Text key={i} style={[styles.tooltipValue, { color: p.color }]}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
        </Text>
      ))}
    </View>
  );
};

const ScatterTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <View style={styles.tooltip}>
      <Text style={styles.tooltipLabel}>{d.department} · Risk: {d.riskLevel}</Text>
      <Text style={styles.tooltipValue}>Avg Score: {d.avgScore}</Text>
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
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis
              dataKey="dept"
              tick={{ fill: "#475569", fontSize: 12, fontWeight: "600" }}
              axisLine={{ stroke: "#E2E8F0" }}
              tickLine={false}
            />
            <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
            <Bar dataKey="Avg Score" fill="#8A63D2" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="Journals" fill="#16A34A" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="LSN" fill="#D97706" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="Assessments" fill="#0EA5E9" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <ReRadarChart data={radarData} margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
            <PolarGrid stroke="#E2E8F0" />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: "#475569", fontSize: 11, fontWeight: "600" }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "#94A3B8", fontSize: 10 }}
              tickCount={5}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
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

function deptAbbr(full: string): string {
  const match = full.match(/\(([^)]+)\)/);
  return match ? match[1] : full.split(" ").slice(0, 3).join(" ");
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
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis
            dataKey="journalCount"
            name="Journal Entries"
            tick={{ fill: "#475569", fontSize: 11 }}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
          />
          <YAxis
            dataKey="avgScore"
            name="Avg Assessment Score"
            domain={[0, 80]}
            tick={{ fill: "#475569", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Avg Score →",
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
              name={deptAbbr(dept)}
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
            <Text style={styles.riskDotLabel}>Low Risk</Text>
          </View>
          <View style={styles.riskDotRow}>
            <View style={[styles.riskDot, { backgroundColor: RISK_COLORS.normal }]} />
            <Text style={styles.riskDotLabel}>Moderate</Text>
          </View>
          <View style={styles.riskDotRow}>
            <View style={[styles.riskDot, { backgroundColor: RISK_COLORS.high }]} />
            <Text style={styles.riskDotLabel}>High Risk</Text>
          </View>
        </View>
      </View>
      <View style={styles.chartFooter}>
        <Text style={styles.chartFooterNote}>
          Each dot represents a student. X-axis = journal frequency, Y-axis = assessment severity.
          Use this plot to identify clusters and outliers needing intervention.
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
    backgroundColor: "white",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  tooltipLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  tooltipValue: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
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
