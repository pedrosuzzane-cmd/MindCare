import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { MindCareTheme } from "@/constants/theme";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import { getDepartmentCode } from "@/utils/departmentMeta";

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

  return <View>{renderMobileBar(data, theme)}</View>;
}

// ─── Component: DepartmentCorrelationScatter ───────────────────────────────
interface ScatterPlotProps {
  points: ScatterPoint[];
}

function deptAbbr(full: string): string {
  return getDepartmentCode(full);
}

export function DepartmentCorrelationScatter({ points }: ScatterPlotProps) {
  const { theme } = useMindCareTheme();
  const deptColors: Record<string, string> = {};
  const uniqueDepts = [...new Set(points.map((p) => getDepartmentCode(p.department)))];
  const palette = [theme.primary, theme.status.success, theme.status.warning, theme.status.info, theme.accent.rose, theme.accent.amber, theme.accent.teal];
  uniqueDepts.forEach((d, i) => {
    deptColors[d] = palette[i % palette.length];
  });
  return renderMobileScatter(points, deptColors, theme);
}

// ─── Mobile Renderers ──────────────────────────────────────────────────────
function renderMobileBar(data: DeptComparisonMetric[], theme: MindCareTheme) {
  const maxScore = Math.max(...data.map((d) => d.avgScore), 1);
  const maxJournal = Math.max(...data.map((d) => d.journalCount), 1);
  const maxLsn = Math.max(...data.map((d) => d.lsnCount), 1);
  const maxAssessment = Math.max(...data.map((d) => d.assessmentCount), 1);
  const deptCount = data.length;
  const groupWidth = Math.max(56, Math.min(72, Math.floor(480 / deptCount)));
  const styles = createStyles(theme);

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mobileScroll}>
        <View style={[styles.mobileBarContainer, { gap: Math.max(4, Math.min(16, 40 / deptCount)) }]}>
          {data.map((d) => (
            <View key={d.deptAbbr} style={[styles.mobileBarGroup, { width: groupWidth }]}>
              <Text style={styles.mobileBarLabel}>{d.deptAbbr}</Text>
              <View style={styles.mobileBarCol}>
                <View style={[styles.mobileBar, { height: Math.max(4, (d.avgScore / maxScore) * 100), backgroundColor: theme.primary }]} />
                <Text style={styles.mobileBarVal}>{d.avgScore.toFixed(0)}</Text>
              </View>
              <View style={styles.mobileBarCol}>
                <View style={[styles.mobileBar, { height: Math.max(4, (d.journalCount / maxJournal) * 100), backgroundColor: theme.status.success }]} />
                <Text style={styles.mobileBarVal}>{d.journalCount}</Text>
              </View>
              <View style={styles.mobileBarCol}>
                <View style={[styles.mobileBar, { height: Math.max(4, (d.lsnCount / maxLsn) * 100), backgroundColor: theme.status.warning }]} />
                <Text style={styles.mobileBarVal}>{d.lsnCount}</Text>
              </View>
              <View style={styles.mobileBarCol}>
                <View style={[styles.mobileBar, { height: Math.max(4, (d.assessmentCount / maxAssessment) * 100), backgroundColor: theme.status.info }]} />
                <Text style={styles.mobileBarVal}>{d.assessmentCount}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.mobileBarLegend}>
        {[
          { label: "Avg Score", color: theme.primary },
          { label: "Journals", color: theme.status.success },
          { label: "LSN", color: theme.status.warning },
          { label: "Assessments", color: theme.status.info },
        ].map((m) => (
          <View key={m.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: m.color }]} />
            <Text style={styles.legendLabel}>{m.label}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

function renderMobileScatter(points: ScatterPoint[], deptColors: Record<string, string>, theme: MindCareTheme) {
  const maxJournal = Math.max(...points.map((p) => p.journalCount), 1);
  const cellW = 20;
  const cellH = 20;
  const cols = 10;
  const rows = 8;
  const styles = createStyles(theme);

  const cellMap = new Map<string, { points: ScatterPoint[]; dept: string; riskLevel: string }>();

  points.forEach((p) => {
    let row = Math.min(rows - 1, Math.max(0, Math.floor((80 - Math.min(p.avgScore, 80)) / 10)));
    let col = Math.min(cols - 1, Math.max(0, Math.floor((p.journalCount / maxJournal) * cols)));
    if (col >= cols) col = cols - 1;
    if (row >= rows) row = rows - 1;
    const key = `${row}-${col}`;
    if (!cellMap.has(key)) {
      cellMap.set(key, { points: [], dept: getDepartmentCode(p.department), riskLevel: p.riskLevel });
    }
    cellMap.get(key)!.points.push(p);
  });

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[styles.mobileScatterGrid, { width: cellW * cols, height: cellH * rows + 20 }]}>
          {Array.from({ length: rows }, (_, row) =>
            Array.from({ length: cols }, (_, col) => {
              const key = `${row}-${col}`;
              const cellData = cellMap.get(key);
              const count = cellData ? cellData.points.length : 0;
              const primary = cellData ? cellData.points[0] : null;
              const color = primary ? deptColors[getDepartmentCode(primary.department)] || "#8A63D2" : "transparent";

              const jitterX = count > 1 ? (Math.random() - 0.5) * 6 : 0;
              const jitterY = count > 1 ? (Math.random() - 0.5) * 6 : 0;
              const opacity = count === 0 ? 0 : Math.min(0.3 + count * 0.12, 0.95);

              return (
                <View
                  key={key}
                  style={[
                    styles.mobileScatterCell,
                    { width: cellW, height: cellH },
                    count > 0 && {
                      backgroundColor: color,
                      opacity,
                    },
                  ]}
                >
                  {count > 0 && (
                    <Text style={[
                      styles.mobileScatterDot,
                      {
                        fontSize: count > 3 ? 8 : 10,
                        transform: [
                          { translateX: jitterX },
                          { translateY: jitterY },
                        ],
                      },
                    ]}>
                      {count > 1 ? `${count}` : "•"}
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
      <View style={styles.scatterLegend}>
        <Text style={styles.chartFooterNote}>
          Cell darkness reflects density. Higher count = darker cell.
        </Text>
        <View style={styles.scatterRiskLegend}>
          {Object.entries(deptColors).slice(0, 6).map(([dept, color]) => (
            <View key={dept} style={styles.riskDotRow}>
              <View style={[styles.riskDot, { backgroundColor: color }]} />
              <Text style={styles.riskDotLabel}>{deptAbbr(dept)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
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
    mobileScroll: {
      marginBottom: 8,
    },
    mobileBarLegend: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 12,
      marginTop: 4,
      paddingHorizontal: 4,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendLabel: {
      fontSize: 11,
      fontWeight: "500",
      color: theme.secondaryText,
    },
    mobileBarContainer: {
      flexDirection: "row",
      gap: 16,
      paddingHorizontal: 4,
      paddingBottom: 8,
    },
    mobileBarGroup: {
      alignItems: "center",
      gap: 4,
      width: 56,
    },
    mobileBarLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 4,
    },
    mobileBarCol: {
      alignItems: "center",
      gap: 2,
    },
    mobileBar: {
      width: 10,
      borderRadius: 4,
    },
    mobileBarVal: {
      fontSize: 9,
      fontWeight: "600",
      color: theme.secondaryText,
    },
    mobileScatterGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      width: 200,
      height: 160,
    },
    mobileScatterCell: {
      width: 20,
      height: 20,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 0.5,
      borderColor: theme.border,
    },
    mobileScatterDot: {
      fontSize: 10,
      color: theme.onPrimary,
    },
  });
