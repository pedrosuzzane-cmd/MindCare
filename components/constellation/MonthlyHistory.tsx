import { MindCareTheme } from "@/constants/theme";
import { MonthGroup } from "@/utils/constellationMonthUtils";
import {
  STAR_TYPE_CONFIG,
  buildConstellationStars,
} from "@/utils/constellationOptions";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const HISTORY_LIMIT = 6;
const MINI_STAR_CAP = 5;
const CARD_EMOJIS = ["🌌", "🌙", "✨", "🌟"];

interface MonthlyHistoryProps {
  months: MonthGroup[];
  theme: MindCareTheme;
  onSelect: (monthKey: string) => void;
}

export function MonthlyHistory({
  months,
  theme,
  onSelect,
}: MonthlyHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  if (months.length === 0) return null;

  const visible = expanded ? months : months.slice(0, HISTORY_LIMIT);
  const hasMore = months.length > HISTORY_LIMIT;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: theme.text }]}>
        📖 Constellation Journal History
      </Text>
      <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
        Every month becomes a new chapter.
      </Text>

      {visible.map((month, index) => (
        <HistoryCard
          key={month.monthKey}
          month={month}
          emoji={CARD_EMOJIS[index % CARD_EMOJIS.length]}
          theme={theme}
          onPress={() => onSelect(month.monthKey)}
        />
      ))}

      {hasMore && (
        <Pressable
          style={styles.moreButton}
          onPress={() => setExpanded((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? "Show fewer months" : "View more months"
          }
        >
          <Text style={[styles.moreText, { color: theme.primary }]}>
            {expanded
              ? "Show fewer months"
              : `View More Months (${months.length - HISTORY_LIMIT} more)`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function HistoryCard({
  month,
  emoji,
  theme,
  onPress,
}: {
  month: MonthGroup;
  emoji: string;
  theme: MindCareTheme;
  onPress: () => void;
}) {
  const miniStars = useMemo(
    () => buildConstellationStars(month.entries.slice(0, MINI_STAR_CAP)),
    [month.entries],
  );

  return (
    <Pressable
      style={[
        styles.card,
        {
          backgroundColor: theme.mode === "dark" ? "#1E1B2E" : "#FFFFFF",
          borderColor: theme.border,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${month.label}, ${month.count} stars, ${month.journalDays} journal days`}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardEmoji}>{emoji}</Text>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          {month.label}
        </Text>
      </View>

      <View
        style={[
          styles.miniSky,
          {
            backgroundColor: theme.mode === "dark" ? "#241C40" : "#EFE9FB",
          },
        ]}
        pointerEvents="none"
      >
        {miniStars.map((s) => {
          const config = STAR_TYPE_CONFIG[s.type];
          const x = Math.min(0.92, Math.max(0.08, s.position.x)) * 100;
          const y = Math.min(0.9, Math.max(0.1, s.position.y)) * 100;
          return (
            <Text
              key={s.journalId}
              style={[
                styles.miniStar,
                {
                  left: `${x}%`,
                  top: `${y}%`,
                  color: s.color,
                  fontSize: Math.max(8, config.sizePx * 0.75),
                },
              ]}
            >
              {config.glyph}
            </Text>
          );
        })}
      </View>

      <Text style={[styles.cardStats, { color: theme.secondaryText }]}>
        {month.count} {month.count === 1 ? "star" : "stars"} •{" "}
        {month.journalDays} journal{" "}
        {month.journalDays === 1 ? "day" : "days"}
      </Text>

      <Text style={[styles.cardCta, { color: theme.primary }]}>
        View Constellation →
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 22,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  cardEmoji: {
    fontSize: 18,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  miniSky: {
    height: 64,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 10,
  },
  miniStar: {
    position: "absolute",
  },
  cardStats: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  cardCta: {
    fontSize: 14,
    fontWeight: "800",
  },
  moreButton: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  moreText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
