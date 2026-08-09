import { JournalEntry } from "@/services/journalService";
import { MindCareTheme } from "@/constants/theme";
import { ConstellationStar } from "@/types/constellation";
import { STAR_TYPE_CONFIG, starCategoryColor } from "@/utils/constellationOptions";
import { ACHIEVEMENT_CATEGORIES } from "@/hooks/useAchievements";
import { getCategory, getMood } from "@/utils/journalOptions";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface StarDetailModalProps {
  star: ConstellationStar | null;
  entry?: JournalEntry;
  achievement?: {
    emoji: string;
    title: string;
    description: string;
    category: string;
    unlockedAt?: Date;
  } | null;
  milestone?: {
    emoji: string;
    title: string;
    count: number;
  } | null;
  theme: MindCareTheme;
  onClose: () => void;
  onViewJournal: (journalId: string) => void;
  onViewAchievements: () => void;
}

export function StarDetailModal({
  star,
  entry,
  achievement,
  milestone,
  theme,
  onClose,
  onViewJournal,
  onViewAchievements,
}: StarDetailModalProps) {
  const visible = star !== null;

  const config = star ? STAR_TYPE_CONFIG[star.type] : null;
  const isGratitude = star?.source === "gratitude";
  const isAchievement = star?.source === "achievement";
  const isMilestone = star?.source === "milestone";
  const title = isAchievement
    ? achievement?.title || "Achievement Unlocked"
    : isMilestone
      ? milestone?.title || "Milestone Star"
      : isGratitude
        ? entry?.title || "Gratitude Star"
        : entry?.title || "Your Reflection";

  const mood = entry ? getMood(entry.mood) : undefined;
  const category = entry ? getCategory(entry.category) : undefined;
  const starColor = star
    ? starCategoryColor(star.category) ?? theme.primary
    : theme.primary;

  const formatDate = (iso?: string) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.grabber} />

          {star && config && (
            <>
              <Text
                style={[
                  styles.starGlyph,
                  !isAchievement && !isMilestone && { color: starColor },
                ]}
              >
                {isAchievement
                  ? achievement?.emoji || "🏆"
                  : isMilestone
                    ? milestone?.emoji || "🌟"
                    : isGratitude
                      ? "💜"
                      : config.glyph}
              </Text>
              <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              <Text style={[styles.date, { color: theme.secondaryText }]}>
                {formatDate(star.createdAt)}
              </Text>

              {isMilestone ? (
                <>
                  <View style={styles.tags}>
                    <View style={[styles.tag, { backgroundColor: theme.inputBg }]}>
                      <Text style={[styles.tagText, { color: theme.text }]}>
                        ✨ Milestone
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.description, { color: theme.secondaryText }]}>
                    {milestone
                      ? `This bright nova marks ${milestone.count} reflections in your night sky.`
                      : "A bright nova shines for a milestone in your night sky."}
                  </Text>
                </>
              ) : isAchievement ? (
                <>
                  <View style={styles.tags}>
                    <View style={[styles.tag, { backgroundColor: theme.inputBg }]}>
                      <Text style={[styles.tagText, { color: theme.text }]}>
                        🏆 Achievement
                      </Text>
                    </View>
                    {achievement?.category && (
                      <View style={[styles.tag, { backgroundColor: theme.inputBg }]}>
                        <Text style={[styles.tagText, { color: theme.text }]}>
                          {
                            ACHIEVEMENT_CATEGORIES.find(
                              (c) => c.id === achievement.category,
                            )?.label
                          }
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.description, { color: theme.secondaryText }]}>
                    {achievement?.description ||
                      "A golden star for a milestone on your wellness journey."}
                  </Text>
                </>
              ) : (
                <>
                  {(mood || category) && (
                    <View style={styles.tags}>
                      {mood && (
                        <View style={[styles.tag, { backgroundColor: theme.inputBg }]}>
                          <Text style={[styles.tagText, { color: theme.text }]}>
                            {mood.emoji} {mood.label}
                          </Text>
                        </View>
                      )}
                      {category && (
                        <View style={[styles.tag, { backgroundColor: theme.inputBg }]}>
                          <Text style={[styles.tagText, { color: theme.text }]}>
                            {category.emoji} {category.name}
                          </Text>
                        </View>
                      )}
                      {entry?.customCategory && (
                        <View style={[styles.tag, { backgroundColor: theme.inputBg }]}>
                          <Text style={[styles.tagText, { color: theme.text }]}>
                            {entry.customCategory}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  <Text style={[styles.description, { color: theme.secondaryText }]}>
                    {isGratitude
                      ? "This special star was created from a gratitude journal entry."
                      : "This star was created from your journal entry."}
                  </Text>

                  {entry?.thoughts ? (
                    <View
                      style={[
                        styles.preview,
                        { backgroundColor: theme.inputBg },
                      ]}
                    >
                      <Text
                        style={[styles.previewText, { color: theme.text }]}
                        numberOfLines={4}
                      >
                        {entry.thoughts}
                      </Text>
                    </View>
                  ) : null}
                </>
              )}

              {isAchievement ? (
                <Pressable
                  style={[styles.button, { backgroundColor: theme.primary }]}
                  onPress={onViewAchievements}
                  accessibilityRole="button"
                  accessibilityLabel="View achievements"
                >
                  <Ionicons name="trophy-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.buttonText}>View Achievements</Text>
                </Pressable>
              ) : isMilestone ? null : (
                star.journalId && (
                  <Pressable
                    style={[styles.button, { backgroundColor: theme.primary }]}
                    onPress={() => onViewJournal(star.journalId)}
                    accessibilityRole="button"
                    accessibilityLabel="View journal"
                  >
                    <Ionicons name="book-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.buttonText}>View Journal</Text>
                  </Pressable>
                )
              )}

              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close star details"
              >
                <Text style={[styles.closeText, { color: theme.secondaryText }]}>
                  Close
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(10, 8, 18, 0.55)",
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    alignItems: "center",
  },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(138, 99, 210, 0.35)",
    marginBottom: 18,
  },
  starGlyph: {
    fontSize: 44,
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  date: {
    fontSize: 13,
    marginBottom: 16,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  tag: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 13,
    fontWeight: "600",
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 16,
  },
  preview: {
    alignSelf: "stretch",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
  },
  previewText: {
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    paddingVertical: 15,
    borderRadius: 25,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  closeButton: {
    marginTop: 16,
    padding: 6,
  },
  closeText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
