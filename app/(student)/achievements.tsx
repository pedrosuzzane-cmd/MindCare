  import { Ionicons } from "@expo/vector-icons";
  import { LinearGradient } from "expo-linear-gradient";
  import { router } from "expo-router";
  import { useRef, useState } from "react";
  import {
      Animated,
      Dimensions,
      Pressable,
      Platform,
      SafeAreaView,
      ScrollView,
      StyleSheet,
      Text,
      View,
  } from "react-native";

  import {
      AchievementWithStatus,
      useAchievements,
  } from "@/hooks/useAchievements";

  const { width: SCREEN_WIDTH } = Dimensions.get("window");
  const CARD_GAP = 12;
  const CARD_WIDTH = (SCREEN_WIDTH - 40 - CARD_GAP) / 2;

  export default function AchievementsScreen() {
    const { achievements, totalEarned, loading } = useAchievements();
    const [selectedAchievement, setSelectedAchievement] =
      useState<AchievementWithStatus | null>(null);

    const handleBack = () => {
      router.back();
    };

    const unlockedCount = totalEarned;
    const totalCount = achievements.length;

    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={["#FF9800", "#FF5722", "#E91E63"]}
          style={styles.headerGradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </Pressable>
            <Text style={styles.headerTitle}>Achievements</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Summary */}
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryEmoji}>🏆</Text>
            <Text style={styles.summaryTitle}>Your Achievements</Text>
            <Text style={styles.summarySubtitle}>
              {unlockedCount} of {totalCount} unlocked
            </Text>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${(unlockedCount / totalCount) * 100}%` },
                ]}
              />
            </View>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>
            🌟 Keep building healthy habits!
          </Text>
          <Text style={styles.sectionSubtitle}>
            Every journal entry, check-in, and goal brings you closer to your next
            achievement.
          </Text>

          {/* Achievements Grid */}
          <View style={styles.grid}>
            {achievements.map((achievement) => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                onPress={() => setSelectedAchievement(achievement)}
              />
            ))}
          </View>
        </ScrollView>

        {/* Detail Modal */}
        {selectedAchievement && (
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setSelectedAchievement(null)}
          >
            <Pressable style={styles.modalContent} onPress={() => {}}>
              <Text style={styles.modalEmoji}>{selectedAchievement.emoji}</Text>
              <Text style={styles.modalTitle}>{selectedAchievement.title}</Text>
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
                  <View style={styles.modalProgressBar}>
                    <View
                      style={[
                        styles.modalProgressFill,
                        { width: `${selectedAchievement.progress || 0}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.modalProgressText}>
                    {selectedAchievement.progress || 0}% complete
                  </Text>
                </View>
              )}
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
        toValue: 0.95,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    };

    return (
      <Animated.View
        style={[
          styles.card,
          { transform: [{ scale: scaleAnim }] },
          !achievement.unlocked && styles.cardLocked,
        ]}
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
            <Text style={styles.cardEmoji}>{achievement.emoji}</Text>
          </View>
          <Text
            style={[
              styles.cardTitle,
              !achievement.unlocked && styles.cardTitleLocked,
            ]}
            numberOfLines={2}
          >
            {achievement.title}
          </Text>
          {achievement.unlocked ? (
            <View style={styles.unlockedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.unlockedText}>Unlocked</Text>
            </View>
          ) : (
            <View style={styles.progressContainer}>
              <View style={styles.cardProgressBar}>
                <View
                  style={[
                    styles.cardProgressFill,
                    { width: `${achievement.progress || 0}%` },
                  ]}
                />
              </View>
              <Text style={styles.cardProgressText}>
                {achievement.progress || 0}%
              </Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#F5F5F5",
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
      fontWeight: "600",
      color: "white",
    },
    placeholder: {
      width: 40,
    },
    summaryContainer: {
      alignItems: "center",
      paddingHorizontal: 20,
    },
    summaryEmoji: {
      fontSize: 40,
      marginBottom: 8,
    },
    summaryTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: "white",
      marginBottom: 4,
    },
    summarySubtitle: {
      fontSize: 14,
      color: "rgba(255, 255, 255, 0.85)",
      marginBottom: 12,
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
    scrollContainer: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 40,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: "#333",
      marginBottom: 4,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: "#888",
      lineHeight: 18,
      marginBottom: 20,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: CARD_GAP,
    },
    card: {
      width: CARD_WIDTH,
      backgroundColor: "white",
      borderRadius: 16,
      boxShadow: "0px 2px 8px rgba(0,0,0,0.08)",
      elevation: 3,
      overflow: "hidden",
    },
    cardLocked: {
      opacity: 0.7,
    },
    cardPressable: {
      padding: 16,
      alignItems: "center",
    },
    cardEmojiContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "#F5F5F5",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    cardEmojiUnlocked: {
      backgroundColor: "#FFF3E0",
    },
    cardEmoji: {
      fontSize: 28,
    },
    cardTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: "#333",
      textAlign: "center",
      marginBottom: 8,
      lineHeight: 18,
    },
    cardTitleLocked: {
      color: "#999",
    },
    unlockedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    unlockedText: {
      fontSize: 12,
      color: "#4CAF50",
      fontWeight: "600",
    },
    progressContainer: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    cardProgressBar: {
      flex: 1,
      height: 4,
      backgroundColor: "#F0F0F0",
      borderRadius: 2,
      overflow: "hidden",
    },
    cardProgressFill: {
      height: "100%",
      backgroundColor: "#FF9800",
      borderRadius: 2,
    },
    cardProgressText: {
      fontSize: 11,
      color: "#999",
      fontWeight: "500",
      minWidth: 28,
      textAlign: "right",
    },
    // Modal styles
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
      borderRadius: 20,
      padding: 28,
      alignItems: "center",
    },
    modalEmoji: {
      fontSize: 48,
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: "#333",
      textAlign: "center",
      marginBottom: 8,
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
      color: "#4CAF50",
      fontWeight: "500",
      marginBottom: 16,
    },
    modalProgressContainer: {
      width: "100%",
      alignItems: "center",
      marginBottom: 16,
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
      backgroundColor: "#FF9800",
      borderRadius: 4,
    },
    modalProgressText: {
      fontSize: 12,
      color: "#999",
      fontWeight: "500",
    },
    modalCloseButton: {
      paddingHorizontal: 32,
      paddingVertical: 12,
      backgroundColor: "#FF9800",
      borderRadius: 20,
    },
    modalCloseText: {
      fontSize: 14,
      fontWeight: "600",
      color: "white",
    },
  });
