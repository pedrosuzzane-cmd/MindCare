import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { shadows } from "@/utils/shadows";

import {
  AchievementCategory,
  AchievementWithStatus,
  ACHIEVEMENT_CATEGORIES,
  useAchievements,
} from "@/hooks/useAchievements";

const PRIMARY = "#8A63D2";
const PRIMARY_LIGHT = "#9C7EEB";

interface LevelInfo {
  level: number;
  name: string;
}

const LEVELS: LevelInfo[] = [
  { level: 1, name: "First Step" },
  { level: 2, name: "Little Sprout" },
  { level: 3, name: "Growing Mind" },
  { level: 4, name: "Reflective Soul" },
  { level: 5, name: "Flourishing Self" },
  { level: 6, name: "Full Bloom" },
];

function levelInfo(count: number): LevelInfo {
  let info = LEVELS[0];
  for (const l of LEVELS) {
    if (count >= (l.level - 1) * 4) info = l;
  }
  return info;
}

function progressPercent(current: number, target: number): number {
  if (target <= 0) return 100;
  return Math.min(100, Math.round((current / target) * 100));
}

const UNIT_BY_ID: Record<string, string> = {
  "first-reflection": "reflections",
  "journal-explorer": "reflections",
  "reflective-mind": "reflections",
  "deep-reflection": "reflections",
  "reflection-journey": "reflections",
  "self-care-champion": "check-ins",
  "calm-moment": "check-ins",
  "guardian-of-wellness": "days",
  "took-a-break": "returns",
  "three-day-journey": "days journaled",
  "seven-day-journey": "days journaled",
  "fourteen-day-journey": "days journaled",
  "one-month-reflection": "days journaled",
  "emotional-explorer": "moods",
  "monthly-reflection": "days in a month",
  "night-owl-reflector": "evening entries",
  "early-bird-growth": "morning entries",
  "category-explorer": "categories",
  "honest-reflection": "categories",
  "goal-starter": "goal reflections",
};

function unitFor(id: string): string {
  return UNIT_BY_ID[id] || "steps";
}

function singularUnitFor(id: string): string {
  const map: Record<string, string> = {
    reflections: "reflection",
    "check-ins": "check-in",
    days: "day",
    returns: "return",
    "days journaled": "day journaled",
    moods: "mood",
    "days in a month": "day in a month",
    "evening entries": "evening entry",
    "morning entries": "morning entry",
    categories: "category",
    "goal reflections": "goal reflection",
    steps: "step",
  };
  return map[unitFor(id)] || unitFor(id).replace(/s$/, "");
}

function remainingLabel(id: string, remaining: number): string {
  if (remaining === 1) {
    return `1 more ${singularUnitFor(id)}`;
  }
  return `${remaining} more ${unitFor(id)}`;
}

function categoryLabel(id: AchievementCategory): string {
  return ACHIEVEMENT_CATEGORIES.find((c) => c.id === id)?.label || "All";
}

export default function AchievementsScreen() {
  const { achievements, totalEarned, loading } = useAchievements();
  const [selectedAchievement, setSelectedAchievement] =
    useState<AchievementWithStatus | null>(null);
  const [activeCategory, setActiveCategory] = useState<
    AchievementCategory | "all"
  >("all");

  const totalCount = achievements.length;

  const nextAchievement = useMemo(() => {
    const locked = achievements
      .filter((a) => !a.unlocked)
      .sort((a, b) => {
        const ratioA = a.target > 0 ? a.current / a.target : 0;
        const ratioB = b.target > 0 ? b.current / b.target : 0;
        if (ratioA !== ratioB) return ratioB - ratioA;
        return a.target - b.target;
      });
    return locked[0] || null;
  }, [achievements]);

  const visibleAchievements = useMemo(
    () =>
      activeCategory === "all"
        ? achievements
        : achievements.filter((a) => a.category === activeCategory),
    [achievements, activeCategory],
  );

  const activeMeta = ACHIEVEMENT_CATEGORIES.find(
    (c) => c.id === activeCategory,
  )!;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#9C7EEB", "#8A63D2", "#7C5AC8"]}
        style={styles.headerGradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>Achievements</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Summary */}
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryEmoji}>🏆</Text>
          <Text style={styles.summaryTitle}>Your Wellness Journey</Text>
          <Text style={styles.summarySubtitle}>
            Every small step counts. Keep caring for yourself.
          </Text>
          <Text style={styles.summaryCount}>
            {totalEarned} / {totalCount} Achievements
          </Text>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${
                    totalCount > 0 ? (totalEarned / totalCount) * 100 : 0
                  }%`,
                },
              ]}
            />
          </View>
          <Text style={styles.summaryLevel}>
            Level {levelInfo(totalEarned).level} · {levelInfo(totalEarned).name}
          </Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Next Achievement */}
          {nextAchievement ? (
            <NextAchievementCard achievement={nextAchievement} />
          ) : (
            <View style={styles.allCompleteCard}>
              <Text style={styles.allCompleteEmoji}>🌳</Text>
              <Text style={styles.allCompleteTitle}>
                Your garden is in full bloom
              </Text>
              <Text style={styles.allCompleteSubtitle}>
                You've unlocked every achievement. Keep caring for yourself —
                your journey is what matters most.
              </Text>
            </View>
          )}

          {/* Category filter */}
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              {ACHIEVEMENT_CATEGORIES.map((cat) => {
                const isActive = cat.id === activeCategory;
                return (
                  <Pressable
                    key={cat.id}
                    style={[
                      styles.categoryPill,
                      isActive && styles.categoryPillActive,
                    ]}
                    onPress={() => setActiveCategory(cat.id)}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        isActive && styles.categoryPillTextActive,
                      ]}
                    >
                      {cat.emoji} {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Section heading */}
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitle}>
              {activeMeta.emoji} {activeMeta.label.toUpperCase()}
            </Text>
            <Text style={styles.sectionCount}>
              {
                visibleAchievements.filter((a) => a.unlocked).length
              }{" "}
              of {visibleAchievements.length} unlocked
            </Text>
          </View>

          {/* Achievement list */}
          <View style={styles.list}>
            {visibleAchievements.map((achievement) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                onPress={() => setSelectedAchievement(achievement)}
              />
            ))}
          </View>
        </ScrollView>
      )}

      {/* Detail Modal */}
      {selectedAchievement && (
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedAchievement(null)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View
              style={[
                styles.modalEmojiCircle,
                selectedAchievement.unlocked && styles.modalEmojiCircleUnlocked,
              ]}
            >
              <Text style={styles.modalEmoji}>{selectedAchievement.emoji}</Text>
            </View>
            <Text style={styles.modalTitle}>{selectedAchievement.title}</Text>
            <Text style={styles.modalCategory}>
              {categoryLabel(selectedAchievement.category)}
            </Text>
            <Text style={styles.modalDescription}>
              {selectedAchievement.description}
            </Text>
            <View style={styles.modalDivider} />
            <Text style={styles.modalRequirement}>
              {selectedAchievement.requirement}
            </Text>

            {selectedAchievement.unlocked && selectedAchievement.unlockedAt && (
              <Text style={styles.modalDate}>
                Unlocked on{" "}
                {selectedAchievement.unlockedAt.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            )}

            {!selectedAchievement.unlocked && (
              <View style={styles.modalProgressContainer}>
                <Text style={styles.modalProgressCount}>
                  {selectedAchievement.current} / {selectedAchievement.target}{" "}
                  {unitFor(selectedAchievement.id)}
                </Text>
                <View style={styles.modalProgressBar}>
                  <View
                    style={[
                      styles.modalProgressFill,
                      {
                        width: `${progressPercent(
                          selectedAchievement.current,
                          selectedAchievement.target,
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.modalProgressText}>
                  {progressPercent(
                    selectedAchievement.current,
                    selectedAchievement.target,
                  )}
                  % complete
                </Text>
              </View>
            )}

            <View style={styles.modalRewardRow}>
              <Text style={styles.modalRewardText}>
                Reward: {selectedAchievement.reward}
              </Text>
            </View>

            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setSelectedAchievement(null)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

function NextAchievementCard({
  achievement,
}: {
  achievement: AchievementWithStatus;
}) {
  const remaining = Math.max(0, achievement.target - achievement.current);
  const percent = progressPercent(
    achievement.current,
    achievement.target,
  );

  return (
    <View style={styles.nextCard}>
      <View style={styles.nextHeaderRow}>
        <Text style={styles.nextLabel}>🌱 YOUR NEXT STEP</Text>
      </View>
      <View style={styles.nextBody}>
        <View style={styles.nextEmojiCircle}>
          <Text style={styles.nextEmoji}>{achievement.emoji}</Text>
        </View>
        <View style={styles.nextInfo}>
          <Text style={styles.nextTitle}>{achievement.title}</Text>
          <Text style={styles.nextProgressText}>
            {achievement.current} / {achievement.target}{" "}
            {unitFor(achievement.id)}
          </Text>
        </View>
      </View>
      <View style={styles.nextProgressBar}>
        <View style={[styles.nextProgressFill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.nextRemaining}>
        {remainingLabel(achievement.id, remaining)}
      </Text>
    </View>
  );
}

function AchievementCard({
  achievement,
  onPress,
}: {
  achievement: AchievementWithStatus;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  };

  const percent = progressPercent(
    achievement.current,
    achievement.target,
  );

  return (
    <Animated.View
      style={[styles.card, { transform: [{ scale: scaleAnim }] }]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.cardPressable}
      >
        <View
          style={[
            styles.cardEmojiContainer,
            achievement.unlocked && styles.cardEmojiUnlocked,
          ]}
        >
          <Text style={styles.cardEmoji}>
            {achievement.unlocked ? achievement.emoji : "🔒"}
          </Text>
        </View>

        <View style={styles.cardBody}>
          <Text
            style={[
              styles.cardTitle,
              !achievement.unlocked && styles.cardTitleLocked,
            ]}
          >
            {achievement.title}
          </Text>
          <Text style={styles.cardDescription} numberOfLines={2}>
            {achievement.description}
          </Text>

          {achievement.unlocked ? (
            <View style={styles.cardCompletedRow}>
              <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
              <Text style={styles.cardCompletedText}>Completed</Text>
              <View style={styles.cardRewardPill}>
                <Text style={styles.cardRewardText}>
                  {achievement.reward}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.cardProgressBlock}>
              <View style={styles.cardProgressTopRow}>
                <Text style={styles.cardProgressCount}>
                  {achievement.current} / {achievement.target}{" "}
                  {unitFor(achievement.id)}
                </Text>
                <Text style={styles.cardProgressPercent}>{percent}%</Text>
              </View>
              <View style={styles.cardProgressBar}>
                <View
                  style={[styles.cardProgressFill, { width: `${percent}%` }]}
                />
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F2F8",
  },
  headerGradient: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "white",
  },
  placeholder: {
    width: 40,
  },
  summaryContainer: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  summaryEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "white",
    marginBottom: 6,
  },
  summarySubtitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 14,
  },
  summaryCount: {
    fontSize: 14,
    fontWeight: "700",
    color: "white",
    marginBottom: 8,
  },
  progressBarContainer: {
    width: "80%",
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "white",
    borderRadius: 4,
  },
  summaryLevel: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.95)",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },
  // Next step card
  nextCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.18)",
    ...(shadows.sm("#8A63D2") as any),
    marginBottom: 18,
  },
  nextHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  nextLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: PRIMARY,
    letterSpacing: 0.5,
  },
  nextBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  nextEmojiCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F3EEFB",
    justifyContent: "center",
    alignItems: "center",
  },
  nextEmoji: {
    fontSize: 26,
  },
  nextInfo: {
    flex: 1,
  },
  nextTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#333",
    marginBottom: 3,
  },
  nextProgressText: {
    fontSize: 13,
    color: "#777",
    fontWeight: "600",
  },
  nextProgressBar: {
    width: "100%",
    height: 8,
    backgroundColor: "#F0EBF9",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  nextProgressFill: {
    height: "100%",
    backgroundColor: PRIMARY_LIGHT,
    borderRadius: 4,
  },
  nextRemaining: {
    fontSize: 12,
    color: "#8A63D2",
    fontWeight: "700",
  },
  // All-complete state
  allCompleteCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.18)",
    ...(shadows.sm("#8A63D2") as any),
    marginBottom: 18,
  },
  allCompleteEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  allCompleteTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#333",
    marginBottom: 6,
    textAlign: "center",
  },
  allCompleteSubtitle: {
    fontSize: 13,
    color: "#777",
    lineHeight: 18,
    textAlign: "center",
  },
  // Category pills
  categoryRow: {
    gap: 8,
    paddingRight: 8,
    marginBottom: 18,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.25)",
  },
  categoryPillActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B5B8A",
  },
  categoryPillTextActive: {
    color: "white",
  },
  // Section heading
  sectionHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#333",
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 12,
    color: "#999",
    fontWeight: "600",
  },
  list: {
    gap: 12,
  },
  // Achievement cards (single column)
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.1)",
    ...(shadows.sm("#000") as any),
  },
  cardPressable: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  cardEmojiContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  cardEmojiUnlocked: {
    backgroundColor: "#F0FDF4",
  },
  cardEmoji: {
    fontSize: 26,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#333",
    marginBottom: 3,
  },
  cardTitleLocked: {
    color: "#555",
  },
  cardDescription: {
    fontSize: 12,
    color: "#999",
    lineHeight: 16,
    marginBottom: 8,
  },
  cardCompletedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardCompletedText: {
    fontSize: 13,
    color: "#16A34A",
    fontWeight: "700",
  },
  cardRewardPill: {
    marginLeft: "auto",
    backgroundColor: "#F3EEFB",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cardRewardText: {
    fontSize: 11,
    color: PRIMARY,
    fontWeight: "700",
  },
  cardProgressBlock: {
    width: "100%",
  },
  cardProgressTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  cardProgressCount: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  cardProgressPercent: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: "800",
  },
  cardProgressBar: {
    width: "100%",
    height: 6,
    backgroundColor: "#F0EBF9",
    borderRadius: 3,
    overflow: "hidden",
  },
  cardProgressFill: {
    height: "100%",
    backgroundColor: PRIMARY_LIGHT,
    borderRadius: 3,
  },
  // Modal
  modalOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  modalContent: {
    width: "82%",
    backgroundColor: "white",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 16px 48px rgba(0,0,0,0.15)",
  },
  modalEmojiCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  modalEmojiCircleUnlocked: {
    backgroundColor: "#F0FDF4",
  },
  modalEmoji: {
    fontSize: 36,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#333",
    textAlign: "center",
    marginBottom: 4,
  },
  modalCategory: {
    fontSize: 12,
    fontWeight: "700",
    color: PRIMARY,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  modalDescription: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 12,
  },
  modalDivider: {
    width: "60%",
    height: 1,
    backgroundColor: "#F0F0F0",
    marginBottom: 12,
  },
  modalRequirement: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: 12,
  },
  modalDate: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: "500",
    marginBottom: 16,
  },
  modalProgressContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 14,
  },
  modalProgressCount: {
    fontSize: 13,
    color: "#555",
    fontWeight: "700",
    marginBottom: 6,
  },
  modalProgressBar: {
    width: "100%",
    height: 8,
    backgroundColor: "#F0F0F0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  modalProgressFill: {
    height: "100%",
    backgroundColor: PRIMARY_LIGHT,
    borderRadius: 4,
  },
  modalProgressText: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
  },
  modalRewardRow: {
    backgroundColor: "#F3EEFB",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 18,
  },
  modalRewardText: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: "700",
  },
  modalCloseButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: PRIMARY,
    borderRadius: 25,
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
});
