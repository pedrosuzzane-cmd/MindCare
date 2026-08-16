import React from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Circle, G, Text as SvgText } from "react-native-svg";
import type { MindCareTheme } from "@/constants/theme";
import { useMindCareTheme } from "@/contexts/ThemeContext";

interface DonutGaugeProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  centerText?: string;
  centerSubtext?: string;
  label?: string;
}

export function DonutGauge({
  percentage,
  size = 160,
  strokeWidth = 14,
  color,
  trackColor,
  centerText,
  centerSubtext,
  label,
}: DonutGaugeProps) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const resolvedColor = color ?? theme.primary;
  const resolvedTrackColor = trackColor ?? theme.softPurple;
  const clamped = Math.min(Math.max(percentage, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${center}, ${center}`}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={resolvedTrackColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>
        <SvgText
          x={center}
          y={center - 8}
          textAnchor="middle"
          fontSize={size * 0.18}
          fontWeight="900"
          fill={theme.text}
        >
          {centerText || `${clamped}%`}
        </SvgText>
        {centerSubtext && (
          <SvgText
            x={center}
            y={center + 16}
            textAnchor="middle"
            fontSize={size * 0.08}
            fontWeight="600"
            fill={theme.primary}
          >
            {centerSubtext}
          </SvgText>
        )}
      </Svg>
      {label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

interface MultiDonutGaugeProps {
  segments: {
    label: string;
    percentage: number;
    color: string;
    valueText: string;
  }[];
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
}

export function MultiDonutGauge({
  segments,
  size = 140,
  strokeWidth = 12,
  trackColor,
}: MultiDonutGaugeProps) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 900;
  const resolvedTrackColor = trackColor ?? theme.softPurple;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulativeAngle = 0;

  return (
    <View style={[styles.multiContainer, isWide && styles.multiContainerWide]}>
      {segments.map((seg, idx) => {
        const clamped = Math.min(Math.max(seg.percentage, 0), 100);
        const segCircumference = circumference * (clamped / 100);
        const angleDeg = (cumulativeAngle / 100) * 360;
        cumulativeAngle += seg.percentage;

        return (
          <View key={idx} style={styles.segmentRow}>
            <Svg width={size} height={size}>
              <G rotation="-90" origin={`${center}, ${center}`}>
                <Circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={resolvedTrackColor}
                  strokeWidth={strokeWidth}
                  fill="none"
                />
                <Circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - clamped / 100)}
                  strokeLinecap="round"
                />
              </G>
              <SvgText
                x={center}
                y={center - 6}
                textAnchor="middle"
                fontSize={size * 0.16}
                fontWeight="900"
                fill={seg.color}
              >
                {seg.valueText}
              </SvgText>
              <SvgText
                x={center}
                y={center + 14}
                textAnchor="middle"
                fontSize={size * 0.07}
                fontWeight="600"
                fill={theme.secondaryText}
              >
                {seg.label}
              </SvgText>
            </Svg>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    container: {
      alignItems: "center",
      gap: 8,
    },
    label: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.primaryDeep,
      textAlign: "center",
    },
    multiContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 16,
      justifyContent: "center",
    },
    multiContainerWide: {
      gap: 24,
    },
    segmentRow: {
      alignItems: "center",
    },
  });
