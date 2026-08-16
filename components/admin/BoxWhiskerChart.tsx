import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import type { MindCareTheme } from "@/constants/theme";
import { useMindCareTheme } from "@/contexts/ThemeContext";

export interface BoxWhiskerDataPoint {
  label: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers: number[];
  count: number;
  boxColor?: string;
}

interface BoxWhiskerChartProps {
  data: BoxWhiskerDataPoint[];
  title?: string;
  subtitle?: string;
  yAxisLabel?: string;
}

const getBoxColor = (theme: MindCareTheme, median: number): string => {
  if (median <= 20) return theme.status.success;
  if (median <= 50) return theme.status.warning;
  return theme.status.error;
};

export function generateMockBoxData(): BoxWhiskerDataPoint[] {
  return [
    {
      label: "SLU",
      min: 12,
      q1: 28,
      median: 42,
      q3: 58,
      max: 74,
      outliers: [78, 80, 8],
      count: 45,
    },
    {
      label: "UPB",
      min: 10,
      q1: 24,
      median: 38,
      q3: 52,
      max: 68,
      outliers: [76, 6],
      count: 32,
    },
    {
      label: "UB",
      min: 15,
      q1: 32,
      median: 45,
      q3: 60,
      max: 72,
      outliers: [79],
      count: 38,
    },
    {
      label: "UC",
      min: 8,
      q1: 20,
      median: 35,
      q3: 50,
      max: 66,
      outliers: [75, 77, 5],
      count: 28,
    },
    {
      label: "BCU",
      min: 18,
      q1: 30,
      median: 40,
      q3: 55,
      max: 70,
      outliers: [76, 4],
      count: 22,
    },
    {
      label: "PCC",
      min: 14,
      q1: 26,
      median: 39,
      q3: 54,
      max: 69,
      outliers: [80],
      count: 18,
    },
    {
      label: "BCT",
      min: 16,
      q1: 29,
      median: 43,
      q3: 56,
      max: 71,
      outliers: [78, 3],
      count: 15,
    },
  ];
}

export function BoxWhiskerChart({ data, title, subtitle, yAxisLabel }: BoxWhiskerChartProps) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 900;
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const boxWidth = isWide ? 44 : 28;
  const chartWidth = useMemo(
    () => Math.max(screenWidth - 64, data.length * (boxWidth + 50) + 60),
    [data.length, boxWidth, screenWidth],
  );
  const chartHeight = isWide ? 320 : 280;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };

  const globalMin = useMemo(() => Math.min(...data.map((d) => d.min)), [data]);
  const globalMax = useMemo(() => Math.max(...data.map((d) => d.max, ...data.flatMap((d) => d.outliers))), [data]);
  const range = globalMax - globalMin || 1;
  const yScale = (val: number) =>
    padding.top +
    chartHeight -
    padding.bottom -
    ((val - globalMin) / range) * (chartHeight - padding.top - padding.bottom);

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = Math.max(1, Math.ceil(range / 6 / 5) * 5);
    for (let v = Math.floor(globalMin / step) * step; v <= Math.ceil(globalMax / step) * step; v += step) {
      ticks.push(v);
    }
    return ticks;
  }, [globalMin, globalMax, range]);

  if (data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No risk score data available</Text>
      </View>
    );
  }

  const selectedBox = selectedIdx !== null ? data[selectedIdx] : null;

  return (
    <View style={[styles.container, isWide && styles.containerWide]}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{title || "Wellness Score Variance — Box & Whisker"}</Text>
          <Text style={styles.subtitle}>
            {subtitle || "Distribution of student risk assessment scores across departments — showing median, quartiles, and outliers"}
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <Svg width={chartWidth} height={chartHeight}>
            {yTicks.map((tick) => (
              <Line
                key={tick}
                x1={padding.left}
                y1={yScale(tick)}
                x2={chartWidth - padding.right}
                y2={yScale(tick)}
                stroke={theme.border}
                strokeWidth={1}
              />
            ))}

            {yTicks.map((tick) => (
              <SvgText
                key={tick}
                x={padding.left - 8}
                y={yScale(tick) + 4}
                textAnchor="end"
                fontSize={10}
                fontWeight="600"
                fill={theme.secondaryText}
              >
                {tick}
              </SvgText>
            ))}

            {yAxisLabel && (
              <SvgText
                x={12}
                y={chartHeight / 2}
                textAnchor="middle"
                fontSize={10}
                fontWeight="600"
                fill={theme.secondaryText}
                rotation={-90}
                origin={`12, ${chartHeight / 2}`}
              >
                {yAxisLabel}
              </SvgText>
            )}

            {data.map((d, idx) => {
              const cx = padding.left + idx * (boxWidth + 40) + boxWidth / 2 + 20;
              const isSelected = selectedIdx === idx;

              return (
                <React.Fragment key={d.label}>
                  <Line
                    x1={cx}
                    y1={yScale(d.min)}
                    x2={cx}
                    y2={yScale(d.max)}
                    stroke={isSelected ? theme.text : theme.secondaryText}
                    strokeWidth={isSelected ? 2 : 1.5}
                  />

                  <Line
                    x1={cx - 6}
                    y1={yScale(d.min)}
                    x2={cx + 6}
                    y2={yScale(d.min)}
                    stroke={isSelected ? theme.text : theme.secondaryText}
                    strokeWidth={2}
                  />

                  <Line
                    x1={cx - 6}
                    y1={yScale(d.max)}
                    x2={cx + 6}
                    y2={yScale(d.max)}
                    stroke={isSelected ? theme.text : theme.secondaryText}
                    strokeWidth={2}
                  />

                  <Rect
                    x={cx - boxWidth / 2}
                    y={yScale(d.q3)}
                    width={boxWidth}
                    height={yScale(d.q1) - yScale(d.q3)}
                    rx={3}
                    fill={d.boxColor || getBoxColor(theme, d.median)}
                    fillOpacity={isSelected ? 0.85 : 0.6}
                    stroke={d.boxColor || getBoxColor(theme, d.median)}
                    strokeWidth={isSelected ? 2 : 1}
                  />

                  <Line
                    x1={cx - boxWidth / 2}
                    y1={yScale(d.median)}
                    x2={cx + boxWidth / 2}
                    y2={yScale(d.median)}
                    stroke={theme.text}
                    strokeWidth={isSelected ? 3 : 2}
                  />

                  <Pressable
                    onPress={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                    style={{
                      position: "absolute",
                      left: cx - boxWidth / 2 - 4,
                      top: yScale(d.q3) - 4,
                      width: boxWidth + 8,
                      height: Math.abs(yScale(d.q1) - yScale(d.q3)) + 8,
                    }}
                  />

                  {d.outliers.map((outlier, oi) => (
                    <React.Fragment key={`out-${idx}-${oi}`}>
                      <Line
                        x1={cx - 4}
                        y1={yScale(outlier)}
                        x2={cx + 4}
                        y2={yScale(outlier)}
                        stroke={theme.status.error}
                        strokeWidth={2}
                      />
                      <Line
                        x1={cx}
                        y1={yScale(outlier) - 4}
                        x2={cx}
                        y2={yScale(outlier) + 4}
                        stroke={theme.status.error}
                        strokeWidth={2}
                      />
                      <SvgText
                        x={cx + 10}
                        y={yScale(outlier) + 3}
                        textAnchor="start"
                        fontSize={8}
                        fontWeight="700"
                        fill={theme.status.error}
                      >
                        {outlier}
                      </SvgText>
                    </React.Fragment>
                  ))}
                </React.Fragment>
              );
            })}

            {data.map((d, idx) => {
              const cx = padding.left + idx * (boxWidth + 40) + boxWidth / 2 + 20;
              return (
                <SvgText
                  key={`label-${idx}`}
                  x={cx}
                  y={chartHeight - 8}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight="700"
                  fill={selectedIdx === idx ? theme.text : theme.secondaryText}
                >
                  {d.label}
                </SvgText>
              );
            })}
          </Svg>
        </View>
      </ScrollView>

      {selectedBox && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipTitle}>{selectedBox.label}</Text>
          <View style={styles.tooltipGrid}>
            <View style={styles.tooltipCol}>
              <Text style={styles.tooltipStat}>
                Min: <Text style={styles.tooltipBold}>{selectedBox.min}</Text>
              </Text>
              <Text style={styles.tooltipStat}>
                Q1: <Text style={styles.tooltipBold}>{selectedBox.q1}</Text>
              </Text>
              <Text style={styles.tooltipStat}>
                Median: <Text style={styles.tooltipBold}>{selectedBox.median}</Text>
              </Text>
            </View>
            <View style={styles.tooltipCol}>
              <Text style={styles.tooltipStat}>
                Q3: <Text style={styles.tooltipBold}>{selectedBox.q3}</Text>
              </Text>
              <Text style={styles.tooltipStat}>
                Max: <Text style={styles.tooltipBold}>{selectedBox.max}</Text>
              </Text>
              <Text style={styles.tooltipStat}>
                IQR: <Text style={styles.tooltipBold}>{selectedBox.q3 - selectedBox.q1}</Text>
              </Text>
            </View>
          </View>
          <Text style={styles.tooltipStat}>
            Students: <Text style={styles.tooltipBold}>{selectedBox.count}</Text>
          </Text>
          {selectedBox.outliers.length > 0 && (
            <Text style={styles.tooltipOutlier}>
              Outliers: {selectedBox.outliers.join(", ")}
            </Text>
          )}
          <View style={styles.varianceBar}>
            <Text style={styles.varianceLabel}>Variance Width</Text>
            <View style={styles.varianceTrack}>
              <View
                style={[
                  styles.varianceFill,
                  {
                    width: `${Math.min((selectedBox.q3 - selectedBox.q1) / range * 100, 100)}%`,
                    backgroundColor: selectedBox.boxColor || getBoxColor(theme, selectedBox.median),
                  },
                ]}
              />
            </View>
          </View>
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
    containerWide: { padding: 28 },
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
      marginBottom: 10,
    },
    tooltipGrid: {
      flexDirection: "row",
      gap: 24,
      marginBottom: 8,
    },
    tooltipCol: {
      gap: 4,
    },
    tooltipStat: {
      fontSize: 13,
      color: theme.secondaryText,
      lineHeight: 20,
    },
    tooltipBold: {
      fontWeight: "700",
      color: theme.text,
    },
    tooltipOutlier: {
      fontSize: 12,
      color: theme.status.error,
      fontWeight: "600",
      marginTop: 6,
    },
    varianceBar: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    varianceLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.secondaryText,
      minWidth: 80,
    },
    varianceTrack: {
      flex: 1,
      height: 6,
      backgroundColor: theme.softPurple,
      borderRadius: 3,
      overflow: "hidden",
    },
    varianceFill: {
      height: "100%",
      borderRadius: 3,
    },
    emptyText: {
      fontSize: 14,
      color: theme.secondaryText,
      textAlign: "center",
      paddingVertical: 24,
      fontWeight: "500",
    },
  });
