import { useAuth } from "@/hooks/AuthContext";
import { useConstellation } from "@/hooks/useConstellation";
import { useAchievements } from "@/hooks/useAchievements";
import { useJournal } from "@/hooks/useJournal";
import { MindCareTheme } from "@/constants/theme";
import { auth } from "@/constants/firebase";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import { ConstellationSky } from "@/components/constellation/ConstellationSky";
import { ConstellationProgress } from "@/components/constellation/ConstellationProgress";
import { StarDetailModal } from "@/components/constellation/StarDetailModal";
import { constellationStorage } from "@/storage/constellationStorage";
import { ConstellationStar } from "@/types/constellation";
import { JOURNAL_MILESTONES } from "@/utils/constellationOptions";
import { getMood } from "@/utils/journalOptions";
import { useFocusEffect } from "@react-navigation/native";
import { Redirect, router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SKY_PROGRESSION: Array<{ min: number; message: string }> = [
  { min: 0, message: "Your sky is just beginning." },
  { min: 3, message: "Your sky is growing." },
  { min: 10, message: "Your constellation is taking shape." },
  { min: 20, message: "Your night sky is becoming something special." },
];

export default function ConstellationScreen() {
  const { user, role } = useAuth();
  const { theme } = useMindCareTheme();
  const {
    stars,
    loading,
    loadStars,
    sync,
    addAchievementStar,
    addMilestoneStar,
  } = useConstellation();
  const { achievements } = useAchievements();
  const { entries } = useJournal();
  const { width } = useWindowDimensions();

  const [selectedStar, setSelectedStar] = useState<ConstellationStar | null>(
    null,
  );
  const [celebration, setCelebration] = useState<{
    emoji: string;
    title: string;
    count: number;
  } | null>(null);
  const checkingMilestones = useRef(false);

  // Mint a golden star for every unlocked achievement (idempotent by
  // achievementId, so re-runs on focus/sync never create duplicates).
  const processedAchievements = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (role === "admin" || !user) return;
    for (const achievement of achievements) {
      if (!achievement.unlocked) continue;
      if (processedAchievements.current.has(achievement.id)) continue;
      processedAchievements.current.add(achievement.id);
      addAchievementStar({
        id: achievement.id,
        emoji: achievement.emoji,
        title: achievement.title,
        category: achievement.category,
        unlockedAt: achievement.unlockedAt,
      });
    }
  }, [achievements, user, role, addAchievementStar]);

  useFocusEffect(
    useCallback(() => {
      loadStars();
      sync();
    }, [loadStars, sync]),
  );

  const skyHeight = Math.min(Math.max(width * 0.78, 280), 380);

  const stats = useMemo(() => {
    const constellationIds = new Set(stars.map((s) => s.constellationId));
    return {
      total: stars.length,
      constellations: constellationIds.size,
      reflections: stars.filter((s) => s.source === "journal").length,
      gratitude: stars.filter((s) => s.source === "gratitude").length,
    };
  }, [stars]);

  // Journal milestones count reflections and gratitude — achievement stars are
  // bonus lights, not journal counts.
  const journalStarCount = useMemo(
    () =>
      stars.filter(
        (s) => s.source !== "achievement" && s.source !== "milestone",
      ).length,
    [stars],
  );

  const achievementGlyphs = useMemo(() => {
    const map = new Map<string, string>();
    for (const achievement of achievements) {
      if (achievement.unlocked) map.set(`star_ach_${achievement.id}`, achievement.emoji);
    }
    return map;
  }, [achievements]);

  const milestoneGlyphs = useMemo(() => {
    const map = new Map<string, string>();
    for (const milestone of JOURNAL_MILESTONES) {
      map.set(`star_milestone_${milestone.count}`, milestone.emoji);
    }
    return map;
  }, []);

  /**
   * When the journal-star count crosses an uncelebrated milestone, mint its
   * golden nova and show the celebration once (persisted per milestone).
   */
  const maybeCelebrate = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || role === "admin" || checkingMilestones.current) return;
    const celebrated = await constellationStorage.getCelebratedMilestones(uid);
    const pending = JOURNAL_MILESTONES.filter(
      (m) => m.count <= journalStarCount && !celebrated.includes(m.count),
    );
    if (pending.length === 0) return;
    checkingMilestones.current = true;
    const next = pending[pending.length - 1];
    try {
      await addMilestoneStar({
        count: next.count,
        createdAt: new Date().toISOString(),
      });
      setCelebration({ emoji: next.emoji, title: next.title, count: next.count });
    } finally {
      checkingMilestones.current = false;
    }
  }, [journalStarCount, role, addMilestoneStar]);

  const dismissCelebration = async () => {
    const uid = auth.currentUser?.uid;
    if (uid && celebration) {
      await constellationStorage.markMilestoneCelebrated(
        uid,
        celebration.count,
      );
      setCelebration(null);
      maybeCelebrate();
    }
  };

  // Check for uncelebrated milestones each time the tab gains focus.
  useFocusEffect(
    useCallback(() => {
      maybeCelebrate();
    }, [maybeCelebrate]),
  );

  // Also re-check once stars finish loading / a new star appears.
  useEffect(() => {
    maybeCelebrate();
  }, [journalStarCount, maybeCelebrate]);

  const progressionMessage = useMemo(() => {
    const entry =
      [...SKY_PROGRESSION].reverse().find((p) => stats.total >= p.min) ??
      SKY_PROGRESSION[0];
    return entry.message;
  }, [stats.total]);

  const selectedEntry = selectedStar
    ? entries.find((e) => e.id === selectedStar.journalId)
    : undefined;

  const selectedAchievement =
    selectedStar?.source === "achievement" && selectedStar.achievementId
      ? achievements.find((a) => a.id === selectedStar.achievementId)
      : undefined;

  const selectedMilestone =
    selectedStar?.source === "milestone" && selectedStar.milestoneCount
      ? JOURNAL_MILESTONES.find((m) => m.count === selectedStar.milestoneCount)
      : undefined;

  // Atmosphere: the sky tints toward the most recently written mood.
  const currentMood = useMemo(() => {
    const latest = entries[0];
    return latest?.mood ? getMood(latest.mood) : undefined;
  }, [entries]);

  if (role === "admin") {
    return <Redirect href="/admin-panel" />;
  }

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  const goToJournal = (journalId: string) => {
    setSelectedStar(null);
    router.push({ pathname: "/journal-detail", params: { id: journalId } });
  };

  const goToAchievements = () => {
    setSelectedStar(null);
    router.push("/achievements");
  };

  const writeJournal = () => {
    router.push({
      pathname: "/new-journal-entry",
      params: { date: new Date().toISOString() },
    });
  };

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
            Every thought becomes a little light.
          </Text>
        </View>

        {loading ? (
          <View style={[styles.loadingBox, { height: skyHeight }]}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : stars.length === 0 ? (
          /* Empty state */
          <View style={[styles.emptyBox, { height: skyHeight + 20 }]}>
            <ConstellationSky
              stars={[]}
              theme={theme}
              onPressStar={() => {}}
              moodColor={currentMood?.color}
            />
            <View style={styles.emptyOverlay}>
              <Text style={styles.emptyTitle}>
                ✨ Your constellation is waiting for its first star.
              </Text>
              <Text style={styles.emptySubtitle}>
                Write your first journal entry and watch your night sky begin.
              </Text>
              <Pressable
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={writeJournal}
                accessibilityRole="button"
                accessibilityLabel="Write a journal"
              >
                <Text style={styles.primaryButtonText}>Write a Journal</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {/* Night sky */}
            <View style={[styles.skyWrap, { height: skyHeight }]}>
              <ConstellationSky
                stars={stars}
                theme={theme}
                onPressStar={setSelectedStar}
                moodColor={currentMood?.color}
                glyphForStar={(star) =>
                  star.source === "achievement"
                    ? achievementGlyphs.get(star.id)
                    : star.source === "milestone"
                      ? milestoneGlyphs.get(star.id)
                      : undefined
                }
              />
              <View pointerEvents="none" style={styles.skyFooter}>
                <View style={styles.skyMessagePill}>
                  <Text style={styles.skyMessage}>
                    {currentMood ? `${currentMood.emoji} ` : ""}
                    {progressionMessage}
                  </Text>
                </View>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <StatChip emoji="✨" value={stats.total} label="Stars" theme={theme} />
              <StatChip
                emoji="🌌"
                value={stats.constellations}
                label="Constellations"
                theme={theme}
              />
              <StatChip
                emoji="📖"
                value={stats.reflections}
                label="Reflections"
                theme={theme}
              />
              <StatChip
                emoji="💜"
                value={stats.gratitude}
                label="Gratitude"
                theme={theme}
              />
            </View>

            {/* Progress */}
            <View style={styles.progressWrap}>
              <ConstellationProgress starCount={journalStarCount} theme={theme} />
            </View>
          </>
        )}
      </ScrollView>

      {/* Milestone celebration */}
      <Modal
        visible={celebration !== null}
        transparent
        animationType="fade"
        onRequestClose={dismissCelebration}
        statusBarTranslucent
      >
        <View style={styles.celebrationOverlay}>
          <View
            style={[
              styles.celebrationCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <View
              style={[
                styles.celebrationStar,
                { backgroundColor: theme.mode === "dark" ? "#3A2E5E" : "#F3EEFB" },
              ]}
            >
              <Text style={styles.celebrationEmoji}>
                {celebration?.emoji ?? "✨"}
              </Text>
            </View>
            <Text style={[styles.celebrationTitle, { color: theme.text }]}>
              Milestone Reached!
            </Text>
            <Text style={[styles.celebrationSubtitle, { color: theme.primary }]}>
              {celebration?.title}
            </Text>
            <Text style={[styles.celebrationBody, { color: theme.secondaryText }]}>
              {celebration
                ? `${celebration.count} reflections now shine in your night sky.`
                : ""}
            </Text>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: theme.primary }]}
              onPress={dismissCelebration}
              accessibilityRole="button"
              accessibilityLabel="Keep going"
            >
              <Text style={styles.primaryButtonText}>Keep Going ✨</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <StarDetailModal
        star={selectedStar}
        entry={selectedEntry}
        achievement={
          selectedAchievement
            ? {
                emoji: selectedAchievement.emoji,
                title: selectedAchievement.title,
                description: selectedAchievement.description,
                category: selectedAchievement.category,
                unlockedAt: selectedAchievement.unlockedAt,
              }
            : null
        }
        milestone={
          selectedMilestone
            ? {
                emoji: selectedMilestone.emoji,
                title: selectedMilestone.title,
                count: selectedMilestone.count,
              }
            : null
        }
        theme={theme}
        onClose={() => setSelectedStar(null)}
        onViewJournal={goToJournal}
        onViewAchievements={goToAchievements}
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
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
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
    flexBasis: "45%",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
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
  celebrationOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 8, 18, 0.6)",
    paddingHorizontal: 32,
  },
  celebrationCard: {
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 28,
    paddingVertical: 32,
    alignItems: "center",
    maxWidth: 360,
  },
  celebrationStar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  celebrationEmoji: {
    fontSize: 44,
  },
  celebrationTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  celebrationSubtitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  celebrationBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 22,
  },
});
