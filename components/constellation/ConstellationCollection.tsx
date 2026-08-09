import { MindCareTheme } from "@/constants/theme";
import { JOURNAL_MILESTONES } from "@/utils/constellationOptions";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface ConstellationCollectionProps {
  starCount: number;
  theme: MindCareTheme;
  onSelect: (count: number) => void;
}

/**
 * "My Constellations" — the long-term progression trail. Unlocked
 * constellations are tappable and open their milestone detail; locked ones
 * show how many more journals are needed.
 */
export function ConstellationCollection({
  starCount,
  theme,
  onSelect,
}: ConstellationCollectionProps) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.text }]}>🌌 My Constellations</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {JOURNAL_MILESTONES.map((m) => {
          const unlocked = starCount >= m.count;
          const remaining = Math.max(0, m.count - starCount);
          return (
            <Pressable
              key={m.count}
              disabled={!unlocked}
              onPress={() => onSelect(m.count)}
              style={[
                styles.card,
                {
                  backgroundColor: theme.secondaryCard,
                  borderColor: theme.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${m.title}, ${unlocked ? "unlocked" : `locked, ${remaining} more journals`}`}
            >
              <Text style={[styles.emoji, !unlocked && styles.emojiLocked]}>
                {unlocked ? m.emoji : "🔒"}
              </Text>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
                {m.title}
              </Text>
              <Text
                style={[
                  styles.state,
                  { color: unlocked ? theme.primary : theme.secondaryText },
                ]}
              >
                {unlocked ? "Unlocked" : `Locked · ${remaining} more`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },
  row: {
    gap: 10,
    paddingRight: 8,
  },
  card: {
    width: 132,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  emoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  emojiLocked: {
    opacity: 0.4,
  },
  name: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
    minHeight: 34,
  },
  state: {
    fontSize: 11,
    fontWeight: "700",
  },
});
