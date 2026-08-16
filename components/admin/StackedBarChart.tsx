import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { MindCareTheme } from "@/constants/theme";
import { useMindCareTheme } from "@/contexts/ThemeContext";

export interface StackedBarItem {
  label: string;
  positive: number;
  neutral: number;
  distressed: number;
  total: number;
}

interface StackedBarChartProps {
  data: StackedBarItem[];
  title?: string;
  subtitle?: string;
}

export function StackedBarChart({ data, title, subtitle }: StackedBarChartProps) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 900;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const colors = {
    positive: theme.status.success,
    neutral: theme.status.warning,
    distressed: theme.status.error,
  };

  const maxLabelLen = useMemo(
    () => Math.max(...data.map((d) => d.label.length), 1),
    [data],
  );

  const barHeight = isWide ? 52 : 28;
  const labelFontSize = isWide ? 14 : 11;
  const segmentFontSize = isWide ? 13 : 9;
  const totalFontSize = isWide ? 13 : 10;

  if (data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No mood data available</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isWide && styles.containerWide]}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{title || "Mood Distribution by Department"}</Text>
          <Text style={styles.subtitle}>
            {subtitle || "Normalized mood proportions — each bar sums to 100%"}
          </Text>
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.positive }]} />
          <Text style={styles.legendText}>Positive</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.neutral }]} />
          <Text style={styles.legendText}>Neutral</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.distressed }]} />
          <Text style={styles.legendText}>Distressed</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chartArea}>
          {data.map((item, idx) => {
            const sum = item.total || item.positive + item.neutral + item.distressed;
            const posPct = sum > 0 ? (item.positive / sum) * 100 : 0;
            const neuPct = sum > 0 ? (item.neutral / sum) * 100 : 0;
            const disPct = sum > 0 ? (item.distressed / sum) * 100 : 0;
            const isSelected = selectedIndex === idx;

            return (
              <Pressable
                key={item.label}
                style={[styles.barRow, isSelected && styles.barRowSelected]}
                onPress={() => setSelectedIndex(isSelected ? null : idx)}
              >
                <Text style={[styles.barLabel, { minWidth: maxLabelLen * (isWide ? 10 : 7), fontSize: labelFontSize }]} numberOfLines={1}>
                  {item.label}
                </Text>
                <View style={[styles.barTrack, { height: barHeight }]}>
                  {posPct > 0 && (
                    <View style={[styles.barSegment, { width: `${posPct}%`, backgroundColor: colors.positive }]}>
                      {posPct >= (isWide ? 8 : 12) && (
                        <Text style={[styles.segmentText, { fontSize: segmentFontSize }]}>{posPct.toFixed(0)}%</Text>
                      )}
                    </View>
                  )}
                  {neuPct > 0 && (
                    <View style={[styles.barSegment, { width: `${neuPct}%`, backgroundColor: colors.neutral }]}>
                      {neuPct >= (isWide ? 8 : 12) && (
                        <Text style={[styles.segmentText, { fontSize: segmentFontSize }]}>{neuPct.toFixed(0)}%</Text>
                      )}
                    </View>
                  )}
                  {disPct > 0 && (
                    <View style={[styles.barSegment, { width: `${disPct}%`, backgroundColor: colors.distressed }]}>
                      {disPct >= (isWide ? 8 : 12) && (
                        <Text style={[styles.segmentText, { fontSize: segmentFontSize }]}>{disPct.toFixed(0)}%</Text>
                      )}
                    </View>
                  )}
                </View>
                <Text style={[styles.barTotal, { fontSize: totalFontSize }]}>{sum}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {selectedIndex !== null && data[selectedIndex] && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipTitle}>{data[selectedIndex].label}</Text>
          <View style={styles.tooltipRow}>
            <View style={[styles.tooltipDot, { backgroundColor: colors.positive }]} />
            <Text style={styles.tooltipText}>
              Positive: <Text style={styles.tooltipBold}>{data[selectedIndex].positive}</Text>
            </Text>
          </View>
          <View style={styles.tooltipRow}>
            <View style={[styles.tooltipDot, { backgroundColor: colors.neutral }]} />
            <Text style={styles.tooltipText}>
              Neutral: <Text style={styles.tooltipBold}>{data[selectedIndex].neutral}</Text>
            </Text>
          </View>
          <View style={styles.tooltipRow}>
            <View style={[styles.tooltipDot, { backgroundColor: colors.distressed }]} />
            <Text style={styles.tooltipText}>
              Distressed: <Text style={styles.tooltipBold}>{data[selectedIndex].distressed}</Text>
            </Text>
          </View>
          <Text style={styles.tooltipTotal}>Total: {data[selectedIndex].total}</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.primaryDeep,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 22,
      elevation: 4,
    },
    containerWide: { padding: 32 },
    header: {
      marginBottom: 16,
    },
    headerContent: { flex: 1 },
    title: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.text,
    },
    subtitle: {
      fontSize: 12,
      color: theme.secondaryText,
      marginTop: 4,
      lineHeight: 18,
    },
    legend: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 16,
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderSoft,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.primaryDeep,
    },
    chartArea: {
      gap: 10,
      paddingRight: 24,
      minWidth: 320,
    },
    barRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 8,
      paddingVertical: 2,
    },
    barRowSelected: {
      backgroundColor: theme.secondaryCard,
      paddingHorizontal: 4,
    },
    barLabel: {
      fontWeight: "700",
      color: theme.secondaryText,
      textAlign: "right",
    },
    barTrack: {
      flex: 1,
      flexDirection: "row",
      borderRadius: 6,
      overflow: "hidden",
      backgroundColor: theme.softPurple,
    },
    barSegment: {
      justifyContent: "center",
      alignItems: "center",
      minWidth: 0,
    },
    segmentText: {
      fontWeight: "800",
      color: theme.onPrimary,
    },
    barTotal: {
      fontWeight: "700",
      color: theme.secondaryText,
      minWidth: 28,
      textAlign: "right",
    },
    tooltip: {
      marginTop: 16,
      backgroundColor: theme.secondaryCard,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.borderSoft,
    },
    tooltipTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 8,
    },
    tooltipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    tooltipDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    tooltipText: {
      fontSize: 13,
      color: theme.secondaryText,
      lineHeight: 20,
    },
    tooltipBold: {
      fontWeight: "700",
      color: theme.text,
    },
    tooltipTotal: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.secondaryText,
      marginTop: 6,
    },
    emptyText: {
      fontSize: 14,
      color: theme.secondaryText,
      textAlign: "center",
      paddingVertical: 24,
      fontWeight: "500",
    },
  });
