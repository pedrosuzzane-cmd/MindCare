import { MindCareTheme } from "@/constants/theme";
import { formatMonthName } from "@/utils/constellationMonthUtils";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface MonthlyProgressProps {
  count: number;
  goal: number;
  monthLabel: string;
  theme: MindCareTheme;
}

export function MonthlyProgress({
  count,
  goal,
  monthLabel,
  theme,
}: MonthlyProgressProps) {
  const monthName = formatMonthName(monthLabel);
  const progress = Math.min(1, count / goal);
  const complete = count >= goal;
  const remaining = Math.max(0, goal - count);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.icon, { color: theme.primary }]}>🌙</Text>
        <Text style={[styles.title, { color: theme.text }]}>
          {monthName} Reflection Goal
        </Text>
      </View>

      <Text style={[styles.count, { color: theme.text }]}>
        {count} / {goal} reflections
      </Text>

      <View
        style={[styles.bar, { backgroundColor: theme.inputBg }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: goal, now: count }}
      >
        <View
          style={[
            styles.fill,
            { width: `${progress * 100}%`, backgroundColor: theme.primary },
          ]}
        />
      </View>

      {complete ? (
        <Text style={[styles.complete, { color: theme.primary }]}>
          🌟 {monthName} Constellation Complete!
          {"\n"}
          You filled your {monthName} sky with reflections.
        </Text>
      ) : (
        <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
          {remaining} more{" "}
          {remaining === 1 ? "reflection" : "reflections"} to complete your{" "}
          {monthName} constellation.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginTop: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  icon: {
    fontSize: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  count: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  bar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  complete: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    marginTop: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
  },
});
