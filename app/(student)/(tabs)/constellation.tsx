import { useAuth } from "@/hooks/AuthContext";
import { useJournal } from "@/hooks/useJournal";
import { MindCareTheme } from "@/constants/theme";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import { ConstellationSky } from "@/components/constellation/ConstellationSky";
import { ConstellationProgress } from "@/components/constellation/ConstellationProgress";
import { ConstellationCollection } from "@/components/constellation/ConstellationCollection";
import { DailyReflectionModal } from "@/components/constellation/DailyReflectionModal";
import { ConstellationStar } from "@/types/constellation";
import {
  STAR_CATEGORY_COLORS,
  buildConstellationStars,
  normalizeJournalDate,
} from "@/utils/constellationOptions";
import { getCategory, getMood } from "@/utils/journalOptions";
import { useFocusEffect } from "@react-navigation/native";
import { Redirect, router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [fullSky, setFullSky] = useState(false);

  // Refresh from the journal sync whenever the tab gains focus. Offline stays
  // cached, so the sky still renders from stored journal entries.
  useFocusEffect(
    useCallback(() => {
      manualSync();
    }, [manualSync]),
  );

  /** Every journal entry projects to one deterministic star. */
  const stars = useMemo(() => buildConstellationStars(entries), [entries]);

  const stats = useMemo(() => {
    const days = new Set(
      entries.map((e) => normalizeJournalDate(e.createdAt)),
    );
    const categories = new Set(
      entries.map((e) => e.category).filter(Boolean),
    );
    return {
      reflections: entries.length,
      days: days.size,
      categories: categories.size,
    };
  }, [entries]);

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
    for (const e of entries) {
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
  }, [entries, theme.primary]);

  // Atmosphere: the sky tints toward the most recently written mood.
  const currentMood = useMemo(() => {
    const latest = entries[0];
    return latest?.mood ? getMood(latest.mood) : undefined;
  }, [entries]);

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

  const handleSelectMilestone = (count: number) => {
    const star = stars.find((s) => s.ordinal === count);
    if (star) openStar(star);
  };

  const showLoading = loading && entries.length === 0 && !loadError;
  const showError = !loading && loadError && entries.length === 0;
  const showEmpty = !loading && !loadError && entries.length === 0;

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
            ✨ My Constellation
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.secondaryText }]}>
            Every reflection adds a little light to your sky.
          </Text>
        </View>

        {showLoading ? (
          <View style={[styles.centerBox, { height: skyHeight }]}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.centerText, { color: theme.secondaryText }]}>
              ✨ Preparing your sky...
            </Text>
          </View>
        ) : showError ? (
          <View style={[styles.centerBox, { height: skyHeight }]}>
            <Text style={[styles.centerTitle, { color: theme.text }]}>
              Your constellation couldn't be loaded.
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
        ) : showEmpty ? (
          /* Empty state */
          <View style={[styles.emptyBox, { height: skyHeight + 20 }]}>
            <ConstellationSky
              stars={[]}
              theme={theme}
              onPressStar={() => {}}
              moodColor={currentMood?.color}
            />
            <View style={styles.emptyOverlay}>
              <Text style={styles.emptyTitle}>✨ Your sky is waiting.</Text>
              <Text style={styles.emptySubtitle}>
                Your first reflection will become the first star in your
                constellation.
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
                  <Text style={styles.skyMessage}>
                    {currentMood ? `${currentMood.emoji} ` : ""}
                    Your journal is becoming a personal night sky.
                  </Text>
                </View>
              </View>
            </View>

            {stars.length > SKY_STAR_LIMIT && (
              <Pressable
                style={styles.fullSkyToggle}
                onPress={() => setFullSky((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel={fullSky ? "Show fewer stars" : "View full sky"}
              >
                <Text style={[styles.fullSkyToggleText, { color: theme.primary }]}>
                  {fullSky
                    ? "Show fewer stars"
                    : `View Full Sky (${stars.length} stars)`}
                </Text>
              </Pressable>
            )}

            {/* Stats */}
            <View style={styles.statsRow}>
              <StatChip emoji="📖" value={stats.reflections} label="Reflections" theme={theme} />
              <StatChip emoji="🗓️" value={stats.days} label="Days" theme={theme} />
              <StatChip emoji="🎨" value={stats.categories} label="Categories" theme={theme} />
            </View>

            {/* Progress */}
            <View style={styles.progressWrap}>
              <ConstellationProgress journalCount={entries.length} theme={theme} />
            </View>

            {/* Star guide */}
            {legendCategories.length > 0 && (
              <View style={styles.legendWrap}>
                <View style={styles.legendHeader}>
                  <Text style={[styles.legendTitle, { color: theme.text }]}>
                    ✨ Star Guide
                  </Text>
                  <Pressable
                    onPress={() => setLegendExpanded((prev) => !prev)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={
                      legendExpanded ? "Hide star guide" : "Show star guide"
                    }
                  >
                    <Text style={[styles.legendToggle, { color: theme.primary }]}>
                      {legendExpanded ? "Hide" : "Show"}
                    </Text>
                  </Pressable>
                </View>
                {legendExpanded && (
                  <View style={styles.legendRow}>
                    {legendCategories.map((c) => (
                      <View key={c.id} style={styles.legendItem}>
                        <View
                          style={[styles.legendDot, { backgroundColor: c.color }]}
                        />
                        <Text
                          style={[styles.legendLabel, { color: theme.secondaryText }]}
                        >
                          {c.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* My Constellations */}
            <ConstellationCollection
              journalCount={entries.length}
              theme={theme}
              onSelect={handleSelectMilestone}
            />
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
    </SafeAreaView>
  );
}

function StatChip({
  emoji,
  value,
  label,
  theme,
}: {
  emoji: string;
  value: number;
  label: string;
  theme: MindCareTheme;
}) {
  return (
    <View
      style={[
        styles.statChip,
        {
          backgroundColor: theme.mode === "dark" ? "#2A2240" : "#FFFFFF",
          borderColor: theme.border,
        },
      ]}
      accessible
      accessibilityLabel={`${value} ${label}`}
    >
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.secondaryText }]}>
        {label}
      </Text>
    </View>
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
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  statChip: {
    flexGrow: 1,
    flexBasis: "28%",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  statEmoji: {
    fontSize: 18,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  progressWrap: {
    marginTop: 14,
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
  legendHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  legendTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  legendToggle: {
    fontSize: 13,
    fontWeight: "700",
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
    marginBottom: 18,
    color: "rgba(255, 255, 255, 0.8)",
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
