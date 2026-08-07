import { useJournal } from "@/hooks/useJournal";
import { getCategory, getMood } from "@/utils/journalOptions";
import {
  getActiveReflection,
  getReflectionStatusLabel,
} from "@/utils/journalReflection";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  ZoomIn,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { shadows } from "@/utils/shadows";

export default function JournalSavedScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { entries, loading } = useJournal();
  const [showReflection, setShowReflection] = useState(false);

  const entry = params.id
    ? entries.find((e) => e.id === params.id)
    : undefined;

  const reflection = useMemo(
    () => (entry ? getActiveReflection(entry) : null),
    [entry],
  );

  const mood = getMood(entry?.mood);
  const category = getCategory(entry?.category);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8A63D2" />
        </View>
      </SafeAreaView>
    );
  }

  if (!entry || !reflection) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.notFoundText}>Journal entry not found.</Text>
          <Pressable onPress={() => router.replace("/daily-journal")}>
            <Text style={styles.backLink}>Back to Journal</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={ZoomIn.duration(500)} style={styles.emojiWrap}>
          <Text style={styles.emoji}>🎉</Text>
        </Animated.View>

        <Text style={styles.title}>Journal Saved!</Text>
        <Text style={styles.subtitle}>
          Great job taking time to reflect today.{"\n"}Your reflection is now
          ready.
        </Text>

        {!showReflection ? (
          <Animated.View entering={FadeInDown.delay(150).duration(450)}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => setShowReflection(true)}
            >
              <LinearGradient
                colors={["#9C7EEB", "#8A63D2"]}
                style={styles.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="sparkles" size={20} color="white" />
                <Text style={styles.primaryButtonText}>View Reflection</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.replace("/daily-journal")}
            >
              <Text style={styles.secondaryButtonText}>Back to Journal</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(500)}>
            {/* Today's Entry */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Today's Entry</Text>
              <View style={styles.entryHeader}>
                {mood && (
                  <View
                    style={[
                      styles.moodCircle,
                      { backgroundColor: mood.color + "33" },
                    ]}
                  >
                    <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                  </View>
                )}
                <View style={styles.entryMeta}>
                  <Text style={styles.entryTitle}>{entry.title}</Text>
                  <View style={styles.entryTags}>
                    {mood && (
                      <Text style={styles.entryTag}>
                        {mood.emoji} {mood.label}
                      </Text>
                    )}
                    {category && (
                      <Text style={[styles.entryTag, { color: category.color }]}>
                        {category.name}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
              {entry.thoughts ? (
                <Text style={styles.entryThoughts} numberOfLines={4}>
                  {entry.thoughts}
                </Text>
              ) : null}
            </View>

            {/* Reflection Insight */}
            <View style={[styles.card, styles.reflectionCard]}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardLabel}>🧠 Your Reflection</Text>
                <View style={styles.localBadge}>
                  <Text style={styles.localBadgeText}>
                    {getReflectionStatusLabel(entry.reflectionSource) ||
                      "Generated locally"}
                  </Text>
                </View>
              </View>
              {reflection.summary ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionEmoji}>😊</Text>
                  <View style={styles.sectionBody}>
                    <Text style={styles.sectionTitle}>Mood Summary</Text>
                    <Text style={styles.reflectionText}>
                      {reflection.summary}
                    </Text>
                  </View>
                </View>
              ) : null}
              {reflection.positive ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionEmoji}>💡</Text>
                  <View style={styles.sectionBody}>
                    <Text style={styles.sectionTitle}>Positive Observation</Text>
                    <Text style={styles.reflectionText}>
                      {reflection.positive}
                    </Text>
                  </View>
                </View>
              ) : null}
              {reflection.suggestion ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionEmoji}>🌿</Text>
                  <View style={styles.sectionBody}>
                    <Text style={styles.sectionTitle}>Gentle Suggestion</Text>
                    <Text style={styles.reflectionText}>
                      {reflection.suggestion}
                    </Text>
                  </View>
                </View>
              ) : null}
              {reflection.encouragement ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionEmoji}>⭐</Text>
                  <View style={styles.sectionBody}>
                    <Text style={styles.sectionTitle}>Encouragement</Text>
                    <Text style={styles.reflectionText}>
                      {reflection.encouragement}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            {/* Wellness Tips */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>💜 Suggested Wellness Activity</Text>
              {entry.wellnessTips?.length ? (
                entry.wellnessTips.map((tip, idx) => (
                  <View key={idx} style={styles.tipRow}>
                    <Ionicons name="checkmark-circle" size={18} color="#8A63D2" />
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.tipRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color="#8A63D2"
                  />
                  <Text style={styles.tipText}>
                    Take a short walk to reset your mind.
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              style={styles.primaryButton}
              onPress={() => router.replace("/daily-journal")}
            >
              <LinearGradient
                colors={["#9C7EEB", "#8A63D2"]}
                style={styles.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="book-outline" size={20} color="white" />
                <Text style={styles.primaryButtonText}>Back to Journal</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F2F8",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  notFoundText: {
    color: "#666",
    fontSize: 15,
  },
  backLink: {
    color: "#8A63D2",
    fontWeight: "600",
    marginTop: 12,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
    alignItems: "center",
  },
  emojiWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#2D2640",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#8B7FA8",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  primaryButton: {
    borderRadius: 25,
    overflow: "hidden",
    alignSelf: "stretch",
    marginBottom: 12,
  },
  primaryGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: "#E2D6F5",
    backgroundColor: "white",
  },
  secondaryButtonText: {
    color: "#8A63D2",
    fontSize: 16,
    fontWeight: "600",
  },
  card: {
    alignSelf: "stretch",
    backgroundColor: "white",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    ...(shadows.sm("#000") as any),
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8B7FA8",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reflectionCard: {
    backgroundColor: "#F9F4FF",
    borderColor: "#E9D5FF",
  },
  localBadge: {
    backgroundColor: "#EDE6F7",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  localBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8A63D2",
  },
  reflectionText: {
    fontSize: 15,
    color: "#4B4453",
    lineHeight: 24,
  },
  sectionBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  sectionEmoji: {
    fontSize: 20,
    marginTop: 1,
  },
  sectionBody: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8A63D2",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  entryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  moodCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  moodEmoji: {
    fontSize: 26,
  },
  entryMeta: {
    flex: 1,
  },
  entryTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#2D2640",
    marginBottom: 6,
  },
  entryTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  entryTag: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    backgroundColor: "#F5F3F8",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  entryThoughts: {
    fontSize: 14,
    color: "#4B4453",
    lineHeight: 21,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: "#4B4453",
    lineHeight: 20,
  },
});
