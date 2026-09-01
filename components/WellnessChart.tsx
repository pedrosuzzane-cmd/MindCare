import { JournalEntry } from "@/services/journalService";
import { moodWellnessScore } from "@/utils/moodScoring";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

const MOODS = [
  { id: "happy", emoji: "😄", color: "#FFD700", wellness: 5 },
  { id: "calm", emoji: "😊", color: "#98FB98", wellness: 5 },
  { id: "relaxed", emoji: "😌", color: "#87CEEB", wellness: 5 },
  { id: "good", emoji: "🙂", color: "#90EE90", wellness: 4 },
  { id: "neutral", emoji: "😐", color: "#D3D3D3", wellness: 3 },
  { id: "worried", emoji: "😟", color: "#FFA500", wellness: 2 },
  { id: "sad", emoji: "😞", color: "#4169E1", wellness: 2 },
  { id: "overwhelmed", emoji: "😣", color: "#8B0000", wellness: 1 },
  { id: "exhausted", emoji: "😫", color: "#708090", wellness: 1 },
  { id: "stressed", emoji: "😓", color: "#FF6347", wellness: 0 },
  { id: "burnout", emoji: "😤", color: "#800020", wellness: 0 },
  { id: "mad", emoji: "😡", color: "#DC2626", wellness: 0 },
  { id: "fearful", emoji: "😰", color: "#2563EB", wellness: 1 },
  { id: "flushed", emoji: "😅", color: "#F472B6", wellness: 2 },
  { id: "very-upset", emoji: "😢", color: "#000080", wellness: 0 },
];

const CHART_HEIGHT = 160;

interface WellnessChartProps {
  journalEntries: JournalEntry[];
  currentMonth: Date;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function WellnessChart({
  journalEntries,
  currentMonth,
}: WellnessChartProps) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const { width: screenWidth } = useWindowDimensions();
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const CHART_WIDTH = Math.min(screenWidth - 72, 400);

  const wellnessChartData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const dailyScores: { day: number; score: number | null; date: Date }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const entry = journalEntries.find((e) =>
        sameDay(new Date(e.entryDate), date),
      );
      let score: number | null = null;
      if (entry && entry.mood) {
        const mood = MOODS.find((m) => m.id === entry.mood);
        score = mood ? moodWellnessScore(mood.id) : null;
      }
      dailyScores.push({ day: d, score, date });
    }

    return dailyScores;
  }, [journalEntries, currentMonth]);

  const dataPoints = wellnessChartData.filter((d) => d.score !== null);

  const maxScore = 5;
  const chartPadding = 20;
  const usableHeight = CHART_HEIGHT - chartPadding * 2;
  const usableWidth = CHART_WIDTH - chartPadding * 2;

  const stepX =
    dataPoints.length > 1 ? usableWidth / (dataPoints.length - 1) : usableWidth;
  const barStepX = usableWidth / wellnessChartData.length;
  const barWidth = Math.max(2, barStepX * 0.6);

  const showLineChart = chartType === "line" && dataPoints.length >= 2;
  const showBarChart = chartType === "bar" && dataPoints.length > 0;

  if (dataPoints.length === 0) {
    return (
      <View style={styles.chartEmptyState}>
        <Ionicons name="analytics-outline" size={32} color={theme.border} />
        <Text style={styles.chartEmptyText}>
          Journal this month to see your wellness trend.
        </Text>
      </View>
    );
  }

  if (chartType === "line" && dataPoints.length < 2) {
    return (
      <View style={styles.chartEmptyState}>
        <Ionicons name="analytics-outline" size={32} color={theme.border} />
        <Text style={styles.chartEmptyText}>
          Journal at least 2 days this month to see your line chart trend.
        </Text>
        <Pressable
          style={styles.switchButton}
          onPress={() => setChartType("bar")}
        >
          <Text style={styles.switchButtonText}>Switch to Bar Chart</Text>
        </Pressable>
      </View>
    );
  }

  const segments: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    score: number;
    key: string;
  }[] = [];

  for (let i = 0; i < dataPoints.length - 1; i++) {
    const p1 = dataPoints[i];
    const p2 = dataPoints[i + 1];
    if (p1.score === null || p2.score === null) continue;

    const x1 = chartPadding + i * stepX;
    const y1 =
      chartPadding + usableHeight - (p1.score / maxScore) * usableHeight;
    const x2 = chartPadding + (i + 1) * stepX;
    const y2 =
      chartPadding + usableHeight - (p2.score / maxScore) * usableHeight;

    segments.push({
      x1,
      y1,
      x2,
      y2,
      score: (p1.score + p2.score) / 2,
      key: `seg-${i}`,
    });
  }

  if (chartType === "line" && segments.length === 0) {
    return (
      <View style={styles.chartEmptyState}>
        <Ionicons name="analytics-outline" size={32} color={theme.border} />
        <Text style={styles.chartEmptyText}>
          Not enough data yet. Keep journaling!
        </Text>
      </View>
    );
  }

  const yLabels = [5, 4, 3, 2, 1, 0];

  const colors = ["#E53935", "#FB8C00", "#FFC107", "#8BC34A", "#4CAF50"];
  const getColorForScore = (score: number) => {
    const colorIndex = Math.round((score / maxScore) * 4);
    return colors[Math.min(colorIndex, colors.length - 1)];
  };

  return (
    <>
      <View style={styles.chartTypeSwitcher}>
        <Pressable
          style={[
            styles.chartTypeButton,
            chartType === "line" && styles.chartTypeButtonActive,
          ]}
          onPress={() => setChartType("line")}
        >
          <Ionicons
            name="analytics-outline"
            size={16}
            color={chartType === "line" ? theme.onPrimary : theme.secondaryText}
          />
        </Pressable>
        <Pressable
          style={[
            styles.chartTypeButton,
            chartType === "bar" && styles.chartTypeButtonActive,
          ]}
          onPress={() => setChartType("bar")}
        >
          <Ionicons
            name="bar-chart-outline"
            size={16}
            color={chartType === "bar" ? theme.onPrimary : theme.secondaryText}
          />
        </Pressable>
      </View>
      <View style={styles.chartContainer}>
        <View style={styles.yAxis}>
          {yLabels.map((val) => (
            <Text key={`y-${val}`} style={styles.yLabel}>
              {val}
            </Text>
          ))}
        </View>

        <View style={styles.chartArea}>
          {/* Grid Lines */}
          {yLabels.map((val) => {
            const y =
              chartPadding + usableHeight - (val / maxScore) * usableHeight;
            return (
              <View key={`grid-${val}`} style={[styles.gridLine, { top: y }]} />
            );
          })}

          {/* Line Chart */}
          {showLineChart && (
            <>
              {segments.map((seg) => {
                const length = Math.sqrt(
                  Math.pow(seg.x2 - seg.x1, 2) + Math.pow(seg.y2 - seg.y1, 2),
                );
                const angle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);
                const lineColor = getColorForScore(seg.score);

                return (
                  <View
                    key={seg.key}
                    style={[
                      styles.lineSegment,
                      {
                        left: seg.x1,
                        top: seg.y1,
                        width: length,
                        transform: [{ rotate: `${angle}rad` }],
                        backgroundColor: lineColor,
                      },
                    ]}
                  />
                );
              })}

              {dataPoints.map((dp, idx) => {
                if (dp.score === null) return null;
                const x = chartPadding + idx * stepX;
                const y =
                  chartPadding +
                  usableHeight -
                  (dp.score / maxScore) * usableHeight;
                const dotColor = getColorForScore(dp.score);

                return (
                  <View
                    key={`dot-${idx}`}
                    style={[
                      styles.chartDot,
                      { left: x - 5, top: y - 5, backgroundColor: dotColor },
                    ]}
                  />
                );
              })}
            </>
          )}

          {/* Bar Chart */}
          {showBarChart && (
            <View style={styles.barChartContainer}>
              {wellnessChartData.map((dp, idx) => {
                if (dp.score === null) {
                  return (
                    <View key={`bar-${idx}`} style={{ width: barStepX }} />
                  );
                }
                const barHeight = (dp.score / maxScore) * usableHeight;
                const barColor = getColorForScore(dp.score);
                return (
                  <View
                    key={`bar-${idx}`}
                    style={[styles.barWrapper, { width: barStepX }]}
                  >
                    <View
                      style={[
                        styles.bar,
                        {
                          height: barHeight,
                          width: barWidth,
                          backgroundColor: barColor,
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    chartContainer: {
      flexDirection: "row",
      height: CHART_HEIGHT + 20,
      alignItems: "flex-end",
    },
    yAxis: {
      width: 24,
      height: CHART_HEIGHT,
      justifyContent: "space-between",
      paddingVertical: 16,
      alignItems: "flex-end",
      paddingRight: 4,
    },
    yLabel: {
      fontSize: 10,
      color: theme.secondaryText,
      fontWeight: "500",
    },
    chartArea: {
      flex: 1,
      height: CHART_HEIGHT,
      position: "relative",
      overflow: "hidden",
    },
    gridLine: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: theme.border,
    },
    lineSegment: {
      position: "absolute",
      height: 3,
      borderRadius: 2,
      transformOrigin: "left center",
    },
    chartDot: {
      position: "absolute",
      width: 10,
      height: 10,
      borderRadius: 5,
      zIndex: 10,
    },
    chartEmptyState: {
      alignItems: "center",
      paddingVertical: 30,
    },
    chartEmptyText: {
      fontSize: 13,
      color: theme.secondaryText,
      textAlign: "center",
      marginTop: 8,
      paddingHorizontal: 20,
      lineHeight: 18,
    },
    switchButton: {
      marginTop: 12,
      backgroundColor: theme.status.success,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    switchButtonText: {
      color: theme.onPrimary,
      fontWeight: "600",
    },
    chartTypeSwitcher: {
      flexDirection: "row",
      alignSelf: "flex-end",
      backgroundColor: theme.inputBg,
      borderRadius: 16,
      padding: 4,
      marginBottom: -10,
      zIndex: 10,
    },
    chartTypeButton: {
      padding: 8,
      borderRadius: 12,
    },
    chartTypeButtonActive: {
      backgroundColor: theme.status.success,
    },
    // Bar Chart Styles
    barChartContainer: {
      position: "absolute",
      bottom: 20,
      left: 20,
      right: 20,
      height: 120,
      flexDirection: "row",
      alignItems: "flex-end",
    },
    barWrapper: {
      height: "100%",
      justifyContent: "flex-end",
      alignItems: "center",
    },
    bar: {
      borderRadius: 4,
    },
  });
