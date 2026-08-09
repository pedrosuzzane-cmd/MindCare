import { MindCareTheme } from "@/constants/theme";
import { JOURNAL_MILESTONES } from "@/utils/constellationOptions";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface ConstellationProgressProps {
  starCount: number;
  theme: MindCareTheme;
}

export function ConstellationProgress({
  starCount,
  theme,
}: ConstellationProgressProps) {
  const milestoneCounts = JOURNAL_MILESTONES.map((m) => m.count);
  const nextMilestone =
    milestoneCounts.find((m) => starCount < m) ??
    milestoneCounts[milestoneCounts.length - 1];
  const remaining = Math.max(0, nextMilestone - starCount);
  const progress = Math.min(1, starCount / nextMilestone);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.mode === "dark" ? "#2A2240" : "#FFFFFF",
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.icon, { color: theme.primary }]}>✨</Text>
        <Text style={[styles.title, { color: theme.text }]}>
          Next Constellation
        </Text>
      </View>
      <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
        {remaining === 0
          ? "A new constellation is ready!"
          : `${remaining} more ${remaining === 1 ? "star" : "stars"} to unlock`}
      </Text>
      <View
        style={[styles.bar, { backgroundColor: theme.inputBg }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: nextMilestone, now: starCount }}
      >
        <View
          style={[
            styles.fill,
            { width: `${progress * 100}%`, backgroundColor: theme.primary },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  icon: {
    fontSize: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 12,
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
});
