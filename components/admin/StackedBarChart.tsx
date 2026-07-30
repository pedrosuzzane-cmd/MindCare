import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

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

const COLORS = {
  positive: "#22C55E",
  neutral: "#F59E0B",
  distressed: "#EF4444",
};

export function StackedBarChart({ data, title, subtitle }: StackedBarChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 900;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const maxLabelLen = useMemo(
    () => Math.max(...data.map((d) => d.label.length), 1),
    [data],
  );

  const barHeight = isWide ? 36 : 28;

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
          <View style={[styles.legendDot, { backgroundColor: COLORS.positive }]} />
          <Text style={styles.legendText}>Positive</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.neutral }]} />
          <Text style={styles.legendText}>Neutral</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.distressed }]} />
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
                <Text style={[styles.barLabel, { minWidth: maxLabelLen * 7 }]} numberOfLines={1}>
                  {item.label}
                </Text>
                <View style={[styles.barTrack, { height: barHeight }]}>
                  {posPct > 0 && (
                    <View style={[styles.barSegment, { width: `${posPct}%`, backgroundColor: COLORS.positive }]}>
                      {posPct >= 12 && (
                        <Text style={styles.segmentText}>{posPct.toFixed(0)}%</Text>
                      )}
                    </View>
                  )}
                  {neuPct > 0 && (
                    <View style={[styles.barSegment, { width: `${neuPct}%`, backgroundColor: COLORS.neutral }]}>
                      {neuPct >= 12 && (
                        <Text style={styles.segmentText}>{neuPct.toFixed(0)}%</Text>
                      )}
                    </View>
                  )}
                  {disPct > 0 && (
                    <View style={[styles.barSegment, { width: `${disPct}%`, backgroundColor: COLORS.distressed }]}>
                      {disPct >= 12 && (
                        <Text style={styles.segmentText}>{disPct.toFixed(0)}%</Text>
                      )}
                    </View>
                  )}
                </View>
                <Text style={styles.barTotal}>{sum}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {selectedIndex !== null && data[selectedIndex] && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipTitle}>{data[selectedIndex].label}</Text>
          <View style={styles.tooltipRow}>
            <View style={[styles.tooltipDot, { backgroundColor: COLORS.positive }]} />
            <Text style={styles.tooltipText}>
              Positive: <Text style={styles.tooltipBold}>{data[selectedIndex].positive}</Text>
            </Text>
          </View>
          <View style={styles.tooltipRow}>
            <View style={[styles.tooltipDot, { backgroundColor: COLORS.neutral }]} />
            <Text style={styles.tooltipText}>
              Neutral: <Text style={styles.tooltipBold}>{data[selectedIndex].neutral}</Text>
            </Text>
          </View>
          <View style={styles.tooltipRow}>
            <View style={[styles.tooltipDot, { backgroundColor: COLORS.distressed }]} />
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    shadowColor: "#6D28D9",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 4,
  },
  containerWide: { padding: 28 },
  header: {
    marginBottom: 16,
  },
  headerContent: { flex: 1 },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2D1B69",
  },
  subtitle: {
    fontSize: 12,
    color: "#94A3B8",
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
    borderBottomColor: "#F3EAFF",
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
    fontSize: 11,
    fontWeight: "700",
    color: "#6B21A8",
  },
  chartArea: {
    gap: 8,
    paddingRight: 16,
    minWidth: 280,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    paddingVertical: 2,
  },
  barRowSelected: {
    backgroundColor: "#F8F6FC",
    paddingHorizontal: 4,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    textAlign: "right",
  },
  barTrack: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#F3EAFF",
  },
  barSegment: {
    justifyContent: "center",
    alignItems: "center",
    minWidth: 0,
  },
  segmentText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  barTotal: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    minWidth: 24,
    textAlign: "right",
  },
  tooltip: {
    marginTop: 16,
    backgroundColor: "#F8F6FC",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EDE9FE",
  },
  tooltipTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2D1B69",
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
    color: "#475569",
    lineHeight: 20,
  },
  tooltipBold: {
    fontWeight: "700",
    color: "#1E1B4B",
  },
  tooltipTotal: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    paddingVertical: 24,
    fontWeight: "500",
  },
});
