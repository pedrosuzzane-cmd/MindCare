import { useAuth } from "@/hooks/AuthContext";
import { useJournal } from "@/hooks/useJournal";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import { ConstellationSky } from "@/components/constellation/ConstellationSky";
import { DailyReflectionModal } from "@/components/constellation/DailyReflectionModal";
import { MonthlySummary } from "@/components/constellation/MonthlySummary";
import { MonthlyProgress } from "@/components/constellation/MonthlyProgress";
import { MonthlyCelebrationModal } from "@/components/constellation/MonthlyCelebrationModal";
import { constellationCelebrationStorage } from "@/storage/constellationCelebrationStorage";
import { ConstellationStar } from "@/types/constellation";
import {
  STAR_CATEGORY_COLORS,
  buildConstellationStars,
  normalizeJournalDate,
} from "@/utils/constellationOptions";
import {
  currentMonthKey,
  formatMonthLabel,
  formatMonthName,
  getMonthEntries,
  getMonthMoodCount,
  getMonthlyGoal,
  getMonthlyStreak,
  getNextMonth,
  getPreviousMonth,
  getUniqueJournalDays,
  isCurrentMonth,
} from "@/utils/constellationMonthUtils";
import { getCategory, getMood } from "@/utils/journalOptions";
import { useFocusEffect } from "@react-navigation/native";
import { Redirect, router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/** Render cap — keeps the sky smooth on mid-range devices. */
const SKY_STAR_LIMIT = 80;

export default function ConstellationScreen() {
  const { user, role } = useAuth();
  const { theme } = useMindCareTheme();
  const { entries, loading, loadError, reload, manualSync } = useJournal();
  const { width } = useWindowDimensions();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedStarId, setSelectedStarId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    currentMonthKey(),
  );
  const [celebrationMonth, setCelebrationMonth] = useState<string | null>(null);
  const [fullSky, setFullSky] = useState(false);

  const goal = getMonthlyGoal();

  // Refresh from the journal sync whenever the tab gains focus. Offline stays
  // cached, so the sky still renders from stored journal entries. The student
  // always lands on the current month's constellation.
  useFocusEffect(
    useCallback(() => {
      manualSync();
      setSelectedMonth(currentMonthKey());
    }, [manualSync]),
  );

  /**
   * Announce a completed month only once. When the current month reaches the
   * goal, the celebration is stored so it never replays on later visits.
   */
  useEffect(() => {
    if (!user || loading || entries.length === 0) return;
    const monthKey = currentMonthKey();
    const count = getMonthEntries(entries, monthKey).length;
    if (count < goal) return;
    let cancelled = false;
    (async () => {
      const celebrated = await constellationCelebrationStorage.getCelebratedMonths(
        user.uid,
      );
      if (cancelled) return;
      if (!celebrated.includes(monthKey)) {
        setCelebrationMonth(formatMonthLabel(monthKey));
        await constellationCelebrationStorage.markMonthCelebrated(
          user.uid,
          monthKey,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, entries, goal]);

  /** Entries belonging to the selected month — the source of the sky. */
  const monthEntries = useMemo(
    () => getMonthEntries(entries, selectedMonth),
    [entries, selectedMonth],
  );

  /** Every journal entry in the month projects to one deterministic star. */
  const stars = useMemo(() => buildConstellationStars(monthEntries), [
    monthEntries,
  ]);

  const stats = useMemo(() => {
    return {
      reflections: monthEntries.length,
      days: getUniqueJournalDays(monthEntries),
      moods: getMonthMoodCount(monthEntries),
      streak: getMonthlyStreak(monthEntries),
    };
  }, [monthEntries]);

  const monthLabel = formatMonthLabel(selectedMonth);
  const monthName = formatMonthName(selectedMonth);
  const viewingCurrentMonth = isCurrentMonth(selectedMonth);

  const visibleStars = useMemo(() => {
    if (fullSky || stars.length <= SKY_STAR_LIMIT) return stars;
    const newestFirst = [...stars].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const kept: ConstellationStar[] = [];
    const seen = new Set<string>();
    for (const s of newestFirst) {
      if (s.isMilestone || s.isNewest) {
        kept.push(s);
        seen.add(s.journalId);
      }
    }
    for (const s of newestFirst) {
      if (kept.length >= SKY_STAR_LIMIT) break;
      if (!seen.has(s.journalId)) {
        kept.push(s);
        seen.add(s.journalId);
      }
    }
    return kept;
  }, [stars, fullSky]);

  const dayEntries = useMemo(() => {
    if (!selectedDate) return [];
    return entries
      .filter((e) => normalizeJournalDate(e.createdAt) === selectedDate)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  }, [entries, selectedDate]);

  const legendCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of monthEntries) {
      if (!e.category) continue;
      counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => ({
        id,
        name: getCategory(id)?.name ?? id,
        color: STAR_CATEGORY_COLORS[id] ?? theme.primary,
      }));
  }, [monthEntries, theme]);

  // Atmosphere: the sky tints toward the most recently written mood in the
  // selected month.
  const currentMood = useMemo(() => {
    const latest = monthEntries[0];
    return latest?.mood ? getMood(latest.mood) : undefined;
  }, [monthEntries]);

  const skyHeight = Math.min(Math.max(width * 0.78, 280), 380);

  if (role === "admin") {
    return <Redirect href="/admin-panel" />;
  }

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  const openStar = (star: ConstellationStar) => {
    setSelectedStarId(star.journalId);
    setSelectedDate(star.date);
  };

  const closeModal = () => {
    setSelectedDate(null);
    setSelectedStarId(null);
  };

  const goToJournal = (journalId: string) => {
    closeModal();
    router.push({ pathname: "/journal-detail", params: { id: journalId } });
  };

  const writeJournal = () => {
    router.push({
      pathname: "/new-journal-entry",
      params: { date: new Date().toISOString() },
    });
  };

  const goPrevMonth = () => setSelectedMonth(getPreviousMonth(selectedMonth));

  const goNextMonth = () => {
    if (!viewingCurrentMonth) {
      setSelectedMonth(getNextMonth(selectedMonth));
    }
  };

  const showLoading = loading && entries.length === 0 && !loadError;
  const showError = !loading && loadError && entries.length === 0;
  const showOnboarding = !loading && !loadError && entries.length === 0;
  const showEmptyMonth = !showLoading && !showError && monthEntries.length === 0;

  const skyMessage =
    monthEntries.length === 1
      ? "Your first star is shining ✨"
      : `${currentMood ? `${currentMood.emoji} ` : ""}Your ${monthName} sky is growing.`;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={["top", "bottom"]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            ✨ Constellation Journal
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
            Your reflections, written in the stars.
          </Text>
        </View>

        {showLoading ? (
          <View style={[styles.centerBox, { height: skyHeight }]}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.centerText, { color: theme.secondaryText }]}>
              ✨ Preparing your constellation...
            </Text>
          </View>
        ) : showError ? (
          <View style={[styles.centerBox, { height: skyHeight }]}>
            <Text style={[styles.centerTitle, { color: theme.text }]}>
              Your constellation could not be loaded.
            </Text>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: theme.primary }]}
              onPress={reload}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </Pressable>
          </View>
        ) : showOnboarding ? (
          /* New student — nothing written yet. */
          <View style={[styles.emptyBox, { height: skyHeight + 20 }]}>
            <ConstellationSky
              stars={[]}
              theme={theme}
              onPressStar={() => {}}
              moodColor={undefined}
            />
            <View style={styles.emptyOverlay}>
              <Text style={styles.emptyTitle}>
                ✨ Your constellation is waiting
              </Text>
              <Text style={styles.emptySubtitle}>
                Every journal entry becomes a star in your personal sky.
              </Text>
              <Text style={styles.emptyStar}>🌟</Text>
              <Text style={styles.emptyPrompt}>
                Start writing to light up your first constellation.
              </Text>
              <Pressable
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={writeJournal}
                accessibilityRole="button"
                accessibilityLabel="Write my first journal"
              >
                <Text style={styles.primaryButtonText}>
                  Write Your First Journal
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {/* Month navigation */}
            <View style={styles.monthNav}>
              <Pressable
                onPress={goPrevMonth}
                hitSlop={10}
                style={[styles.monthArrow, { borderColor: theme.border }]}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
              >
                <Text style={[styles.monthArrowText, { color: theme.primary }]}>
                  ◀
                </Text>
              </Pressable>
              <Text style={[styles.monthLabel, { color: theme.text }]}>
                {monthLabel}
              </Text>
              <Pressable
                onPress={goNextMonth}
                disabled={viewingCurrentMonth}
                hitSlop={10}
                style={[
                  styles.monthArrow,
                  { borderColor: theme.border },
                  viewingCurrentMonth && styles.monthArrowDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Next month"
                accessibilityState={{ disabled: viewingCurrentMonth }}
              >
                <Text
                  style={[
                    styles.monthArrowText,
                    {
                      color: viewingCurrentMonth
                        ? theme.secondaryText
                        : theme.primary,
                    },
                  ]}
                >
                  ▶
                </Text>
              </Pressable>
            </View>

            {showEmptyMonth ? (
              /* Selected month has no reflections. */
              <View style={[styles.emptyBox, { height: skyHeight + 20 }]}>
                <ConstellationSky
                  stars={[]}
                  theme={theme}
                  onPressStar={() => {}}
                  moodColor={undefined}
                />
                <View style={styles.emptyOverlay}>
                  <Text style={styles.emptyStar}>🌙</Text>
                  <Text style={styles.emptyTitle}>Your sky is waiting</Text>
                  <Text style={styles.emptySubtitle}>
                    No reflections have been added to this constellation yet.
                  </Text>
                  <Text style={styles.emptyPrompt}>
                    Write a journal entry to light your first star ✨
                  </Text>
                  <Pressable
                    style={[
                      styles.primaryButton,
                      { backgroundColor: theme.primary },
                    ]}
                    onPress={writeJournal}
                    accessibilityRole="button"
                    accessibilityLabel="Write a journal entry"
                  >
                    <Text style={styles.primaryButtonText}>
                      Write Journal Entry
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                {/* Night sky */}
                <View style={[styles.skyWrap, { height: skyHeight }]}>
                  <ConstellationSky
                    stars={visibleStars}
                    theme={theme}
                    onPressStar={openStar}
                    selectedId={selectedStarId}
                    moodColor={currentMood?.color}
                  />
                  <View pointerEvents="none" style={styles.skyFooter}>
                    <View style={styles.skyMessagePill}>
                      <Text style={styles.skyMessage}>{skyMessage}</Text>
                    </View>
                  </View>
                </View>

                {stars.length > SKY_STAR_LIMIT && (
                  <Pressable
                    style={styles.fullSkyToggle}
                    onPress={() => setFullSky((prev) => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      fullSky ? "Show fewer stars" : "View full sky"
                    }
                  >
                    <Text
                      style={[styles.fullSkyToggleText, { color: theme.primary }]}
                    >
                      {fullSky
                        ? "Show fewer stars"
                        : `View Full Sky (${stars.length} stars)`}
                    </Text>
                  </Pressable>
                )}

                {/* Monthly summary */}
                <MonthlySummary
                  reflections={stats.reflections}
                  journalDays={stats.days}
                  streak={stats.streak}
                  moods={stats.moods}
                  theme={theme}
                />

                {/* Monthly progress */}
                <MonthlyProgress
                  count={stats.reflections}
                  goal={goal}
                  monthLabel={monthLabel}
                  theme={theme}
                />

                {/* Star guide */}
                {legendCategories.length > 0 && (
                  <View style={styles.legendWrap}>
                    <Text style={[styles.legendTitle, { color: theme.text }]}>
                      ✨ Star Guide
                    </Text>
                    <View style={styles.legendRow}>
                      {legendCategories.map((c) => (
                        <View key={c.id} style={styles.legendItem}>
                          <View
                            style={[
                              styles.legendDot,
                              { backgroundColor: c.color },
                            ]}
                          />
                          <Text
                            style={[
                              styles.legendLabel,
                              { color: theme.secondaryText },
                            ]}
                          >
                            {c.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <DailyReflectionModal
        date={selectedDate}
        entries={dayEntries}
        theme={theme}
        onClose={closeModal}
        onViewJournal={goToJournal}
      />

      <MonthlyCelebrationModal
        monthLabel={celebrationMonth}
        onClose={() => setCelebrationMonth(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 16,
  },
  monthArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  monthArrowDisabled: {
    opacity: 0.35,
  },
  monthArrowText: {
    fontSize: 14,
    fontWeight: "800",
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: "800",
    minWidth: 130,
    textAlign: "center",
  },
  centerBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  centerText: {
    fontSize: 14,
    fontWeight: "600",
  },
  centerTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  skyWrap: {
    borderRadius: 24,
    overflow: "hidden",
  },
  skyFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 14,
    alignItems: "center",
  },
  skyMessagePill: {
    backgroundColor: "rgba(20, 14, 40, 0.42)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  skyMessage: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.95)",
  },
  fullSkyToggle: {
    alignSelf: "center",
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  fullSkyToggleText: {
    fontSize: 13,
    fontWeight: "700",
  },
  legendWrap: {
    marginTop: 16,
  },
  legendTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    paddingVertical: 4,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyBox: {
    borderRadius: 24,
    overflow: "hidden",
  },
  emptyOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(20, 14, 40, 0.38)",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "rgba(255, 255, 255, 0.95)",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  emptyStar: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyPrompt: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 18,
    color: "rgba(255, 255, 255, 0.95)",
    fontWeight: "600",
  },
  primaryButton: {
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
