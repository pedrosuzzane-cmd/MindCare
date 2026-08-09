import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { getTodaysEncouragement } from "@/constants/encouragements";
import { getWellnessActivities } from "@/constants/wellnessActivities";
import { JournalEntry } from "@/services/journalService";
import { getCategory, getMood } from "@/utils/journalOptions";
import { getReflectionSummary } from "@/utils/journalReflection";
import { shadows } from "@/utils/shadows";

interface WellnessJourneyCardProps {
  entries: JournalEntry[];
  getMoodEmoji: (mood: string) => string;
  onWriteJournal: () => void;
  onOpenEntry: (id: string) => void;
}

const ACCENT = "#8A63D2";
const ACCENT_LIGHT = "#9C7EEB";
const ACCENT_DARK = "#7C5AC8";

const MOODS_NEEDING_CARE = new Set([
  "stressed",
  "sad",
  "overwhelmed",
  "worried",
  "exhausted",
  "burnout",
  "mad",
  "fearful",
  "flushed",
  "very-upset",
]);

const CATEGORY_PHRASES: Record<string, string> = {
  personal: "Personal growth",
  academic: "Academic pressure",
  wellness: "Building healthier routines",
  social: "Connecting with others",
  goals: "Working toward goals",
  gratitude: "Practicing gratitude",
  work: "Work responsibilities",
  spiritual: "Spiritual well-being",
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

function getLast7Days() {
  const days: { date: Date; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({
      date: d,
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
    });
  }
  return days;
}

export function WellnessJourneyCard({
  entries,
  getMoodEmoji,
  onWriteJournal,
  onOpenEntry,
}: WellnessJourneyCardProps) {
  const scheme = useColorScheme() ?? "light";
  const dark = scheme === "dark";

  const colors = {
    card: dark ? "#1E1E24" : "#FFFFFF",
    textPrimary: dark ? "#ECEDEE" : "#2D2640",
    textSecondary: dark ? "#9BA1A6" : "#8B7FA8",
    border: dark ? "rgba(156, 126, 235, 0.22)" : "rgba(156, 126, 235, 0.06)",
    softBg: dark ? "#2A2A33" : "#F5F3F8",
    accentSoft: dark ? "#2A2138" : "#F9F4FF",
  };

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) =>
          new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime(),
      ),
    [entries],
  );

  const latest = sorted[0];

  const hasTodayEntry = useMemo(() => {
    const today = new Date();
    return entries.some((e) => sameDay(new Date(e.entryDate), today));
  }, [entries]);

  const stats = useMemo(() => {
    const total = entries.length;
    const days = new Set(entries.map((e) => dateKey(new Date(e.entryDate))));
    let streak = 0;
    const cursor = new Date();
    if (!days.has(dateKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (days.has(dateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    const moodCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    entries.forEach((e) => {
      if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
      if (e.category)
        categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
    });
    const dominantMood = Object.keys(moodCounts).sort(
      (a, b) => moodCounts[b] - moodCounts[a],
    )[0];
    const favoriteCategory = Object.keys(categoryCounts).sort(
      (a, b) => categoryCounts[b] - categoryCounts[a],
    )[0];
    return { total, streak, dominantMood, favoriteCategory };
  }, [entries]);

  const weekDays = useMemo(() => getLast7Days(), []);

  const weeklyTimeline = useMemo(
    () =>
      weekDays.map((day) => {
        const entry = entries.find((e) =>
          sameDay(new Date(e.entryDate), day.date),
        );
        return { day, mood: entry?.mood ?? null };
      }),
    [entries, weekDays],
  );

  const reflectionSummary = useMemo(() => {
    const bullets: string[] = [];
    if (stats.dominantMood && MOODS_NEEDING_CARE.has(stats.dominantMood)) {
      const label = getMood(stats.dominantMood)?.label ?? "stress";
      bullets.push(`Managing ${label.toLowerCase()}`);
    }
    const categoryCounts: Record<string, number> = {};
    entries.forEach((e) => {
      if (e.category)
        categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
    });
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
    for (const id of topCategories) {
      if (bullets.length >= 3) break;
      bullets.push(CATEGORY_PHRASES[id] ?? getCategory(id)?.name ?? id);
    }
    return bullets;
  }, [entries, stats.dominantMood]);

  const encouragement = useMemo(() => getTodaysEncouragement(), []);

  const suggestedActivities = useMemo(
    () => getWellnessActivities(latest?.mood, 3),
    [latest?.mood],
  );

  const latestReflection = useMemo(
    () => (latest ? getReflectionSummary(latest)?.trim() : null),
    [latest],
  );

  if (entries.length === 0) {
    return (
      <Animated.View entering={FadeIn.duration(250)}>
        <LinearGradient
          colors={[ACCENT_LIGHT, ACCENT, ACCENT_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroEmojiWrap}>
            <Text style={styles.heroEmoji}>🌱</Text>
          </View>
          <Text style={styles.heroTitle}>Your Wellness Journey</Text>
          <Text style={styles.heroSubtitle}>
            Your wellness journey starts today.{"\n\n"}
            Writing even a few sentences every day can help you understand your
            emotions and build healthier habits.
          </Text>

          <Text style={styles.heroGoalLabel}>Today's Goal</Text>
          <View style={styles.heroGoalRow}>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color="#FFFFFF"
              accessible={true}
              accessibilityLabel="Goal: write your first journal"
            />
            <Text style={styles.heroGoalText}>Write your first journal</Text>
          </View>

          <Pressable
            onPress={onWriteJournal}
            accessibilityRole="button"
            accessibilityLabel="Write today's journal"
            style={styles.heroButton}
          >
            <Ionicons
              name="create-outline"
              size={20}
              color={ACCENT}
              accessible={true}
              accessibilityLabel=""
            />
            <Text style={styles.heroButtonText}>Write Today's Journal</Text>
          </Pressable>
        </LinearGradient>
      </Animated.View>
    );
  }

  const beginner = entries.length < 3;

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <Ionicons
            name="flower-outline"
            size={20}
            color="#FFFFFF"
            accessible={true}
            accessibilityLabel="Wellness journey"
          />
        </View>
        <View style={styles.headerText}>
          <Text
            style={[styles.headerTitle, { color: colors.textPrimary }]}
            accessibilityRole="header"
          >
            Your Wellness Journey
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {beginner
              ? "You're just getting started"
              : "Insights from your journal"}
          </Text>
        </View>
      </View>

      {/* Beginner: congratulations + stats */}
      {beginner ? (
        <>
          <View style={[styles.congratsCard, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.congratsTitle, { color: colors.textPrimary }]}>
              Congratulations!
            </Text>
            <Text style={[styles.congratsText, { color: colors.textSecondary }]}>
              You've completed your first journal. Every reflection helps you
              understand your emotions better.
            </Text>
          </View>

          <SectionLabel label="Statistics" colors={colors} />
          <Animated.View entering={FadeIn.duration(250)}>
            <View style={styles.statsGrid}>
              <StatTile
                icon="book-outline"
                label="Journal Entries"
                value={`${stats.total}`}
                colors={colors}
              />
              <StatTile
                icon="happy-outline"
                label="Current Mood"
                value={getMood(latest?.mood)?.label ?? "Balanced"}
                valueEmoji={getMood(latest?.mood)?.emoji}
                colors={colors}
              />
              <StatTile
                icon="flame-outline"
                label="Current Streak"
                value={`${stats.streak} Day${stats.streak === 1 ? "" : "s"}`}
                colors={colors}
              />
            </View>
          </Animated.View>
        </>
      ) : (
        <>
          {/* Section 1: Journal Statistics */}
          <SectionLabel label="Journal Statistics" colors={colors} />
          <Animated.View entering={FadeIn.duration(250)}>
            <View style={styles.statsGrid}>
              <StatTile
                icon="book-outline"
                label="Total Journals"
                value={`${stats.total}`}
                colors={colors}
              />
              <StatTile
                icon="flame-outline"
                label="Current Streak"
                value={`${stats.streak} day${stats.streak === 1 ? "" : "s"}`}
                colors={colors}
              />
              <StatTile
                icon="happy-outline"
                label="Dominant Mood"
                value={getMood(stats.dominantMood)?.label ?? "Balanced"}
                valueEmoji={getMood(stats.dominantMood)?.emoji}
                colors={colors}
              />
              <StatTile
                icon="pricetag-outline"
                label="Favorite Category"
                value={getCategory(stats.favoriteCategory)?.name ?? "General"}
                colors={colors}
              />
            </View>
          </Animated.View>

          {/* Section 2: Weekly Mood Timeline */}
          <WeeklyTimeline
            timeline={weeklyTimeline}
            getMoodEmoji={getMoodEmoji}
            colors={colors}
          />

          {/* Section 3: Reflection Summary */}
          <SectionLabel label="Reflection Summary" colors={colors} />
          <Animated.View entering={FadeIn.duration(250)}>
            <View style={[styles.reflectionCard, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.reflectionText, { color: colors.textPrimary }]}>
                You've recently focused on:
              </Text>
              {reflectionSummary.length > 0 ? (
                reflectionSummary.map((bullet, idx) => (
                  <View key={idx} style={styles.reflectionBulletRow}>
                    <Text style={styles.reflectionBullet}>•</Text>
                    <Text
                      style={[
                        styles.reflectionText,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {bullet}
                    </Text>
                  </View>
                ))
              ) : (
                <Text
                  style={[styles.reflectionText, { color: colors.textPrimary }]}
                >
                  Keep journaling and your patterns will start to appear.
                </Text>
              )}
            </View>
          </Animated.View>

          {/* Section 4: Today's Encouragement */}
          <SectionLabel label="Today's Encouragement" colors={colors} />
          <Animated.View entering={FadeIn.duration(250)}>
            <View style={[styles.encouragement, { backgroundColor: colors.softBg }]}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={18}
                color={ACCENT}
                accessible={true}
                accessibilityLabel="Encouragement"
              />
              <Text style={[styles.encouragementText, { color: colors.textPrimary }]}>
                {encouragement}
              </Text>
            </View>
          </Animated.View>

          {/* Section 5: Today's Goal */}
          <GoalRow
            hasTodayEntry={hasTodayEntry}
            onPress={onWriteJournal}
            colors={colors}
          />

          {/* Section 6: Recent Reflection Preview */}
          <SectionLabel label="Recent Reflection" colors={colors} />
          {latestReflection ? (
            <Animated.View entering={FadeIn.duration(250)}>
              <Pressable
                onPress={() => onOpenEntry(latest.id)}
                accessibilityRole="button"
                accessibilityLabel={`Reflection ready. View reflection for ${
                  latest.title || "recent journal"
                }`}
                style={styles.reflectionPreview}
              >
                <View style={styles.reflectionReadyRow}>
                  <MaterialCommunityIcons
                    name="star-four-points"
                    size={18}
                    color={ACCENT}
                    accessible={true}
                    accessibilityLabel=""
                  />
                  <Text style={styles.reflectionReadyText}>Reflection Ready</Text>
                </View>
                <Text
                  style={[styles.previewText, { color: colors.textSecondary }]}
                  numberOfLines={3}
                >
                  {latestReflection}
                </Text>
                <View style={styles.viewReflectionRow}>
                  <Text style={styles.viewReflectionText}>View Reflection</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={ACCENT}
                    accessible={true}
                    accessibilityLabel=""
                  />
                </View>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(250)}>
              <View style={[styles.reflectionEmpty, { backgroundColor: colors.softBg }]}>
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={ACCENT}
                  accessible={true}
                  accessibilityLabel=""
                />
                <Text
                  style={[
                    styles.reflectionEmptyText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Reflection will appear after saving your journal.
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Section 7: Suggested Wellness Activity */}
          <SectionLabel label="Suggested Wellness Activity" colors={colors} />
          <Animated.View entering={FadeIn.duration(250)}>
            <View style={[styles.activityCard, { backgroundColor: colors.softBg }]}>
              <View style={styles.activityHeader}>
                <Feather
                  name="activity"
                  size={16}
                  color={ACCENT}
                  accessible={true}
                  accessibilityLabel=""
                />
                <Text
                  style={[styles.activityHeaderText, { color: colors.textSecondary }]}
                >
                  {getMood(latest?.mood)?.label ?? "General"} mood pick
                </Text>
              </View>
              {suggestedActivities.map((activity, idx) => (
                <View key={idx} style={styles.activityRow}>
                  <Text style={styles.activityIcon}>{activity.icon}</Text>
                  <Text style={[styles.activityTitle, { color: colors.textPrimary }]}>
                    {activity.title}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </>
      )}
    </Animated.View>
  );
}

function SectionLabel({
  label,
  colors,
}: {
  label: string;
  colors: { textSecondary: string };
}) {
  return (
    <View style={styles.sectionLabelRow}>
      <View style={styles.sectionLabelDot} accessible={false} />
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

function StatTile({
  icon,
  label,
  value,
  valueEmoji,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueEmoji?: string;
  colors: { softBg: string; textPrimary: string; textSecondary: string };
}) {
  return (
    <View style={[styles.statTile, { backgroundColor: colors.softBg }]}>
      <Ionicons
        name={icon}
        size={18}
        color={ACCENT}
        accessible={true}
        accessibilityLabel={label}
      />
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <View style={styles.statValueRow}>
        {valueEmoji ? (
          <Text style={styles.statValueEmoji}>{valueEmoji}</Text>
        ) : null}
        <Text
          style={[styles.statValue, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function GoalRow({
  hasTodayEntry,
  onPress,
  colors,
}: {
  hasTodayEntry: boolean;
  onPress: () => void;
  colors: { softBg: string; textPrimary: string; textSecondary: string };
}) {
  return (
    <>
      <SectionLabel label="Today's Goal" colors={colors} />
      <Pressable
        onPress={onPress}
        disabled={hasTodayEntry}
        accessibilityRole="button"
        accessibilityLabel={
          hasTodayEntry
            ? "Today's journal goal completed"
            : "Write a journal entry to complete today's goal"
        }
        style={[styles.goalRow, { backgroundColor: colors.softBg }]}
      >
        <View
          style={[styles.goalCheck, hasTodayEntry && styles.goalCheckDone]}
          accessible={false}
        >
          <Ionicons
            name={hasTodayEntry ? "checkmark" : "ellipse-outline"}
            size={18}
            color={hasTodayEntry ? "#FFFFFF" : ACCENT}
            accessible={false}
          />
        </View>
        <Text
          style={[styles.goalText, { color: colors.textPrimary }]}
          numberOfLines={2}
        >
          {hasTodayEntry ? "Completed ✓" : "Write one journal today"}
        </Text>
      </Pressable>
    </>
  );
}

function WeeklyTimeline({
  timeline,
  getMoodEmoji,
  colors,
}: {
  timeline: { day: { date: Date; label: string }; mood: string | null }[];
  getMoodEmoji: (mood: string) => string;
  colors: { textSecondary: string; textPrimary: string };
}) {
  return (
    <>
      <SectionLabel label="Weekly Mood Timeline" colors={colors} />
      <View style={styles.timelineRow}>
        {timeline.map(({ day, mood }) => {
          const isToday = sameDay(day.date, new Date());
          return (
            <View key={dateKey(day.date)} style={styles.timelineItem}>
              <View style={styles.timelineDotWrap} accessible={false}>
                {mood ? (
                  <Text style={styles.timelineEmoji}>{getMoodEmoji(mood)}</Text>
                ) : (
                  <Text
                    style={[styles.timelineEmpty, { color: colors.textSecondary }]}
                  >
                    ○
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.timelineDay,
                  { color: colors.textSecondary },
                  isToday && { color: ACCENT, fontWeight: "800" },
                ]}
              >
                {day.label}
              </Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    ...(shadows.sm("#000") as any),
    borderWidth: 1,
  },
  hero: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    alignItems: "center",
    ...(shadows.md("#000") as any),
  },
  heroEmojiWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroEmoji: {
    fontSize: 36,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.92)",
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 18,
  },
  heroGoalLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 8,
  },
  heroGoalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
    marginBottom: 18,
  },
  heroGoalText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  heroButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 48,
  },
  heroButtonText: {
    color: ACCENT,
    fontSize: 15,
    fontWeight: "700",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  congratsCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  congratsTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  congratsText: {
    fontSize: 14,
    lineHeight: 21,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  sectionLabelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  statTile: {
    flexGrow: 1,
    flexBasis: "45%",
    borderRadius: 14,
    padding: 14,
    minHeight: 88,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 4,
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "800",
    flexShrink: 1,
  },
  statValueEmoji: {
    fontSize: 15,
  },
  timelineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  timelineItem: {
    alignItems: "center",
    flex: 1,
  },
  timelineDotWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  timelineEmoji: {
    fontSize: 22,
  },
  timelineEmpty: {
    fontSize: 20,
  },
  timelineDay: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  reflectionCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  reflectionText: {
    fontSize: 14,
    lineHeight: 21,
  },
  reflectionBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 6,
  },
  reflectionBullet: {
    fontSize: 14,
    color: ACCENT,
    fontWeight: "800",
  },
  encouragement: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  encouragementText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    padding: 14,
    minHeight: 56,
    marginBottom: 20,
  },
  goalCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  goalCheckDone: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  goalText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  reflectionPreview: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.18)",
  },
  reflectionReadyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  reflectionReadyText: {
    fontSize: 15,
    fontWeight: "800",
    color: ACCENT,
  },
  previewText: {
    fontSize: 13,
    lineHeight: 19,
  },
  viewReflectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
    minHeight: 24,
  },
  viewReflectionText: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT,
  },
  reflectionEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    padding: 14,
    minHeight: 48,
    marginBottom: 20,
  },
  reflectionEmptyText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  activityCard: {
    borderRadius: 14,
    padding: 14,
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  activityHeaderText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    minHeight: 48,
  },
  activityIcon: {
    fontSize: 20,
  },
  activityTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
});
