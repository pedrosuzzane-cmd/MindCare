import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 12 }, (_, i) => `${i + 7}:00`);

interface HeatmapCell {
  dayIndex: number;
  hourIndex: number;
  intensity: number;
  count: number;
}

interface StressHeatmapProps {
  data?: HeatmapCell[];
  title?: string;
  subtitle?: string;
}

function getColor(intensity: number): string {
  if (intensity <= 0) return "#F0FDF4";
  if (intensity <= 0.15) return "#DCFCE7";
  if (intensity <= 0.3) return "#BBF7D0";
  if (intensity <= 0.45) return "#86EFAC";
  if (intensity <= 0.55) return "#FEF08A";
  if (intensity <= 0.65) return "#FDE047";
  if (intensity <= 0.75) return "#F97316";
  if (intensity <= 0.85) return "#EA580C";
  return "#DC2626";
}

function getLabel(intensity: number): string {
  if (intensity <= 0) return "None";
  if (intensity <= 0.25) return "Very Low";
  if (intensity <= 0.45) return "Low";
  if (intensity <= 0.55) return "Moderate";
  if (intensity <= 0.65) return "Elevated";
  if (intensity <= 0.75) return "High";
  if (intensity <= 0.85) return "Very High";
  return "Severe";
}

export function generateMockHeatmapData(): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 12; h++) {
      const dayFactor = d >= 5 ? 0.3 : 1;
      const peakMorning = h >= 0 && h <= 2 ? 1.2 : 1;
      const peakAfternoon = h >= 4 && h <= 6 ? 1.4 : 1;
      const base = Math.random() * 0.5 + 0.1;
      cells.push({
        dayIndex: d,
        hourIndex: h,
        intensity: Math.min(base * dayFactor * peakMorning * peakAfternoon, 1),
        count: Math.floor(Math.random() * 15) + 1,
      });
    }
  }
  return cells;
}

export function StressHeatmap({ data, title, subtitle }: StressHeatmapProps) {
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 900;
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const cells = data || generateMockHeatmapData();

  const cellSize = useMemo(() => {
    const availWidth = (isWide ? screenWidth * 0.7 : screenWidth - 64) - 60;
    return Math.max(24, Math.min(48, Math.floor(availWidth / HOURS.length) - 2));
  }, [screenWidth, isWide]);

  const maxCount = useMemo(() => Math.max(...cells.map((c) => c.count), 1), [cells]);

  return (
    <View style={[styles.container, isWide && styles.containerWide]}>
      <View style={styles.headerRow}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{title || "Stress Pattern Heatmap"}</Text>
          <Text style={styles.subtitle}>
            {subtitle || "Daily stress intensity mapped across hours — green (low) to red (high)"}
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.heatmapWrapper}>
          <View style={styles.heatmapBody}>
            <View style={styles.dayLabelCol}>
              <View style={[styles.cornerPlaceholder, { width: 50, height: 28 }]} />
              {DAYS.map((day) => (
                <View key={day} style={[styles.dayLabelCell, { height: cellSize + 4 }]}>
                  <Text style={styles.dayLabelText}>{day}</Text>
                </View>
              ))}
            </View>

            <View>
              <View style={styles.hourRow}>
                {HOURS.map((hour) => (
                  <View key={hour} style={[styles.hourLabelCell, { width: cellSize + 2 }]}>
                    <Text style={styles.hourLabelText}>{hour}</Text>
                  </View>
                ))}
              </View>

              {DAYS.map((_, dIdx) => (
                <View key={dIdx} style={styles.cellRow}>
                  {HOURS.map((_, hIdx) => {
                    const cell = cells.find(
                      (c) => c.dayIndex === dIdx && c.hourIndex === hIdx,
                    ) || { dayIndex: dIdx, hourIndex: hIdx, intensity: 0, count: 0 };
                    const color = getColor(cell.intensity);
                    return (
                      <Pressable
                        key={`${dIdx}-${hIdx}`}
                        style={[
                          styles.cell,
                          {
                            width: cellSize + 2,
                            height: cellSize + 2,
                            backgroundColor: color,
                          },
                          selectedCell?.dayIndex === dIdx &&
                            selectedCell?.hourIndex === hIdx && styles.cellSelected,
                        ]}
                        onPress={() => {
                          setSelectedCell(cell);
                        }}
                      >
                        <Text style={[styles.cellCount, { fontSize: Math.max(7, cellSize * 0.3) }]}>
                          {cell.count}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {selectedCell && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipTitle}>
            {DAYS[selectedCell.dayIndex]} at {HOURS[selectedCell.hourIndex]}
          </Text>
          <View style={styles.tooltipRow}>
            <View style={[styles.tooltipDot, { backgroundColor: getColor(selectedCell.intensity) }]} />
            <Text style={styles.tooltipText}>
              Stress Level: <Text style={styles.tooltipBold}>{getLabel(selectedCell.intensity)}</Text>
            </Text>
          </View>
          <Text style={styles.tooltipText}>
            Reports: <Text style={styles.tooltipBold}>{selectedCell.count}</Text> students
          </Text>
          <Text style={styles.tooltipText}>
            Intensity: <Text style={styles.tooltipBold}>{(selectedCell.intensity * 100).toFixed(0)}%</Text>
          </Text>
        </View>
      )}

      <View style={styles.legend}>
        <Text style={styles.legendLabel}>Low</Text>
        {[0, 0.2, 0.4, 0.55, 0.7, 0.85, 1].map((val) => (
          <View key={val} style={[styles.legendSwatch, { backgroundColor: getColor(val) }]} />
        ))}
        <Text style={styles.legendLabel}>High</Text>
      </View>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
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
  heatmapWrapper: { paddingBottom: 4 },
  heatmapBody: { flexDirection: "row" },
  dayLabelCol: { marginRight: 6 },
  cornerPlaceholder: { justifyContent: "center", alignItems: "center" },
  dayLabelCell: {
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 6,
  },
  dayLabelText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  hourRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  hourLabelCell: {
    justifyContent: "center",
    alignItems: "center",
    height: 16,
  },
  hourLabelText: {
    fontSize: 8,
    fontWeight: "600",
    color: "#94A3B8",
    transform: [{ rotate: "-45deg" }],
  },
  cellRow: { flexDirection: "row" },
  cell: {
    borderRadius: 3,
    justifyContent: "center",
    alignItems: "center",
    margin: 1,
  },
  cellSelected: {
    borderWidth: 2,
    borderColor: "#1E1B4B",
  },
  cellCount: {
    fontWeight: "700",
    color: "rgba(0,0,0,0.5)",
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
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3EAFF",
  },
  legendSwatch: {
    width: 20,
    height: 12,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    marginHorizontal: 4,
  },
});
