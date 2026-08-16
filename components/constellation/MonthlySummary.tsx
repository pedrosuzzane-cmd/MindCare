import { MindCareTheme } from "@/constants/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface Stat {
  emoji: string;
  value: number;
  label: string;
}

interface MonthlySummaryProps {
  reflections: number;
  journalDays: number;
  streak: number;
  moods: number;
  theme: MindCareTheme;
}

export function MonthlySummary({
  reflections,
  journalDays,
  streak,
  moods,
  theme,
}: MonthlySummaryProps) {
  const stats: Stat[] = [
    { emoji: "⭐", value: reflections, label: "Reflections" },
    { emoji: "📅", value: journalDays, label: "Journal Days" },
    { emoji: "🔥", value: streak, label: "Day Streak" },
    { emoji: "💜", value: moods, label: "Moods" },
  ];

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.text }]}>
        Monthly Reflection Summary
      </Text>
      <View style={styles.row}>
        {stats.map((s) => (
          <View
            key={s.label}
            style={[
              styles.chip,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
            accessible
            accessibilityLabel={`${s.value} ${s.label}`}
          >
            <Text style={styles.emoji}>{s.emoji}</Text>
            <Text style={[styles.value, { color: theme.text }]}>{s.value}</Text>
            <Text style={[styles.label, { color: theme.secondaryText }]}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    flexGrow: 1,
    flexBasis: "44%",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  emoji: {
    fontSize: 18,
    marginBottom: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: "800",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
});
