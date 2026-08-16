import { MindCareTheme } from "@/constants/theme";
import { nextMilestoneFor } from "@/utils/constellationOptions";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface ConstellationProgressProps {
  journalCount: number;
  theme: MindCareTheme;
}

export function ConstellationProgress({
  journalCount,
  theme,
}: ConstellationProgressProps) {
  const { next, reachedAll, remaining, progress } = nextMilestoneFor(journalCount);

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
        <Text style={[styles.icon, { color: theme.primary }]}>✨</Text>
        <Text style={[styles.title, { color: theme.text }]}>
          Next Constellation
        </Text>
      </View>

      <Text style={[styles.milestone, { color: theme.primary }]}>
        {next.emoji} {next.title}
      </Text>

      <Text style={[styles.count, { color: theme.text }]}>
        {journalCount} / {next.count} reflections
      </Text>

      <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
        {reachedAll
          ? "Your sky is complete — a legend among stars!"
          : `${remaining} more ${remaining === 1 ? "reflection" : "reflections"} to unlock`}
      </Text>

      <View
        style={[styles.bar, { backgroundColor: theme.inputBg }]}
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: next.count,
          now: journalCount,
        }}
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
    marginBottom: 8,
  },
  icon: {
    fontSize: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  milestone: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 2,
  },
  count: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
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
