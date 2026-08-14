import {
  HIGH_RISK_SAVED_NOTE,
  HIGH_RISK_SUPPORT_MESSAGE,
  HIGH_RISK_TITLE,
  MODERATE_SUPPORT_MESSAGE,
  MODERATE_SUPPORT_TITLE,
} from "@/constants/crisisSupport";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import { useJournal } from "@/hooks/useJournal";
import { getCategory, getMood } from "@/utils/journalOptions";
import {
  getActiveReflection,
  getReflectionStatusLabel,
} from "@/utils/journalReflection";
import { shadows } from "@/utils/shadows";
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
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

export default function JournalSavedScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { entries, loading } = useJournal();
  const { theme } = useMindCareTheme();
  const [showReflection, setShowReflection] = useState(false);

  const entry = params.id ? entries.find((e) => e.id === params.id) : undefined;

  const reflection = useMemo(
    () => (entry ? getActiveReflection(entry) : null),
    [entry],
  );

  const mood = getMood(entry?.mood);
  const category = getCategory(entry?.category);
  const isHighRisk = entry?.riskLevel === "high";
  const isModerate = entry?.riskLevel === "moderate";

  const successMessage = useMemo(() => {
    const moodId = mood?.id;
    if (
      moodId === "sad" ||
      moodId === "stressed" ||
      moodId === "anxious" ||
      moodId === "overwhelmed" ||
      moodId === "lonely"
    ) {
      return "Thank you for taking a moment to put your feelings into words.";
    }
    if (moodId === "happy" || moodId === "calm" || moodId === "hopeful") {
      return "Great job taking time to reflect today.";
    }
    return "Taking time to reflect can be meaningful.";
  }, [mood]);

  const reassuranceText = "Your journal entry has been saved.";

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={styles.center}>
          <Text style={[styles.notFoundText, { color: theme.secondaryText }]}>
            Journal entry not found.
          </Text>
          <Pressable onPress={() => router.replace("/daily-journal")}>
            <Text style={[styles.backLink, { color: theme.primary }]}>
              Back to Journal
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // High-risk entries skip the casual reflection flow entirely and route the
  // student toward crisis support. The journal itself is always saved.
  if (isHighRisk) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={["top", "bottom"]}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { backgroundColor: theme.background },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <CrisisSupportView theme={theme} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!reflection) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={["top", "bottom"]}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { backgroundColor: theme.background },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={ZoomIn.duration(450)}
            style={[
              styles.emojiWrap,
              { backgroundColor: theme.softPurple, borderColor: theme.border },
            ]}
          >
            <Text style={styles.emoji}>✅</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(420)}>
            <Text style={[styles.title, { color: theme.text }]}>
              Journal Saved!
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(420)}>
            <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
              {successMessage}
            </Text>
            <Text style={[styles.reassuranceText, { color: theme.primary }]}>
              {reassuranceText}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(280).duration(420)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to journal"
              style={styles.primaryButton}
              onPress={() => router.replace("/daily-journal")}
            >
              <LinearGradient
                colors={[theme.primary, theme.primaryDeep]}
                style={styles.primaryGradient}
              >
                <Ionicons
                  name="book-outline"
                  size={20}
                  color={theme.onPrimary}
                />
                <Text style={styles.primaryButtonText}>Back to Journal</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={["top", "bottom"]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { backgroundColor: theme.background },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={ZoomIn.duration(450)}
          style={[
            styles.emojiWrap,
            { backgroundColor: theme.softPurple, borderColor: theme.border },
          ]}
        >
          <Text style={styles.emoji}>🎉</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(420)}>
          <Text style={[styles.title, { color: theme.text }]}>
            Journal Saved!
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(420)}>
          <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
            {successMessage}
          </Text>
          <Text style={[styles.reassuranceText, { color: theme.primary }]}>
            {reassuranceText}
          </Text>
        </Animated.View>

        {isModerate && (
          <Animated.View entering={FadeIn.duration(400)}>
            <View
              style={[
                styles.moderateCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={styles.moderateHeader}>
                <Text style={styles.moderateEmoji}>💜</Text>
                <Text style={[styles.moderateTitle, { color: theme.text }]}>
                  {MODERATE_SUPPORT_TITLE}
                </Text>
              </View>
              <Text
                style={[styles.moderateMessage, { color: theme.secondaryText }]}
              >
                {MODERATE_SUPPORT_MESSAGE}
              </Text>
              <Pressable
                onPress={() => router.push("/support-hotlines")}
                hitSlop={6}
              >
                <Text style={[styles.moderateLink, { color: theme.primary }]}>
                  View support contacts →
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {!showReflection ? (
          <Animated.View entering={FadeInDown.delay(280).duration(420)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View reflection"
              style={styles.primaryButton}
              onPress={() => setShowReflection(true)}
            >
              <LinearGradient
                colors={[theme.primary, theme.primaryDeep]}
                style={styles.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="sparkles" size={20} color={theme.onPrimary} />
                <Text style={styles.primaryButtonText}>View Reflection</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to journal"
              style={[
                styles.secondaryButton,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => router.replace("/daily-journal")}
            >
              <Text
                style={[styles.secondaryButtonText, { color: theme.primary }]}
              >
                Back to Journal
              </Text>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(500)}>
            {/* Today's Entry */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.cardLabel, { color: theme.secondaryText }]}>
                Entry for Today
              </Text>
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
                  <Text style={[styles.entryTitle, { color: theme.text }]}>
                    {entry.title}
                  </Text>
                  <View style={styles.entryTags}>
                    {mood && (
                      <Text style={[styles.entryTag, { color: theme.primary }]}>
                        {mood.emoji} {mood.label}
                      </Text>
                    )}
                    {category && (
                      <Text
                        style={[styles.entryTag, { color: category.color }]}
                      >
                        {category.emoji} {category.name}
                      </Text>
                    )}
                    {entry.customCategory && (
                      <Text
                        style={[
                          styles.entryTag,
                          { color: category?.color ?? theme.primary },
                        ]}
                      >
                        {entry.customCategory}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
              {entry.thoughts ? (
                <Text
                  style={[styles.entryThoughts, { color: theme.secondaryText }]}
                  numberOfLines={4}
                >
                  {entry.thoughts}
                </Text>
              ) : null}
            </View>

            {/* Reflection Insight */}
            <View
              style={[
                styles.card,
                styles.reflectionCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <Text
                  style={[styles.cardLabel, { color: theme.secondaryText }]}
                >
                  🧠 Your Reflection
                </Text>
                <View
                  style={[
                    styles.localBadge,
                    { backgroundColor: theme.softPurple },
                  ]}
                >
                  <Text
                    style={[styles.localBadgeText, { color: theme.primary }]}
                  >
                    {getReflectionStatusLabel(entry.reflectionSource) ||
                      "Generated locally"}
                  </Text>
                </View>
              </View>
              {reflection.topicLabel || reflection.emotion ? (
                <View style={styles.metaRow}>
                  {reflection.topicLabel ? (
                    <View
                      style={[
                        styles.metaBadge,
                        { backgroundColor: theme.softPurple },
                      ]}
                    >
                      <Text
                        style={[styles.metaBadgeText, { color: theme.text }]}
                      >
                        📍 {reflection.topicLabel}
                        {typeof reflection.topicConfidence === "number"
                          ? ` · ${reflection.topicConfidence}%`
                          : ""}
                      </Text>
                    </View>
                  ) : null}
                  {reflection.emotion ? (
                    <View
                      style={[
                        styles.metaBadge,
                        { backgroundColor: theme.softPurple },
                      ]}
                    >
                      <Text
                        style={[styles.metaBadgeText, { color: theme.text }]}
                      >
                        💭 {reflection.emotion}
                        {reflection.emotionIntensity
                          ? ` · ${reflection.emotionIntensity}`
                          : ""}
                      </Text>
                    </View>
                  ) : null}
                  {reflection.sentiment ? (
                    <View
                      style={[
                        styles.metaBadge,
                        { backgroundColor: theme.softPurple },
                      ]}
                    >
                      <Text
                        style={[styles.metaBadgeText, { color: theme.text }]}
                      >
                        {reflection.sentiment === "positive"
                          ? "☀️"
                          : reflection.sentiment === "negative"
                            ? "🌧️"
                            : "⛅"}{" "}
                        {reflection.sentiment[0].toUpperCase() +
                          reflection.sentiment.slice(1)}
                      </Text>
                    </View>
                  ) : null}
                  {reflection.stressLevel ? (
                    <View
                      style={[
                        styles.metaBadge,
                        { backgroundColor: theme.softPurple },
                      ]}
                    >
                      <Text
                        style={[styles.metaBadgeText, { color: theme.text }]}
                      >
                        ⚠️ Stress:{" "}
                        {reflection.stressLevel[0].toUpperCase() +
                          reflection.stressLevel.slice(1)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              {reflection.summary ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionEmoji}>😊</Text>
                  <View style={styles.sectionBody}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      Mood Summary
                    </Text>
                    <Text
                      style={[
                        styles.reflectionText,
                        { color: theme.secondaryText },
                      ]}
                    >
                      {reflection.summary}
                    </Text>
                  </View>
                </View>
              ) : null}
              {reflection.positive ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionEmoji}>💡</Text>
                  <View style={styles.sectionBody}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      Positive Observation
                    </Text>
                    <Text
                      style={[
                        styles.reflectionText,
                        { color: theme.secondaryText },
                      ]}
                    >
                      {reflection.positive}
                    </Text>
                  </View>
                </View>
              ) : null}
              {reflection.suggestion ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionEmoji}>🌿</Text>
                  <View style={styles.sectionBody}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      Gentle Suggestion
                    </Text>
                    <Text
                      style={[
                        styles.reflectionText,
                        { color: theme.secondaryText },
                      ]}
                    >
                      {reflection.suggestion}
                    </Text>
                  </View>
                </View>
              ) : null}
              {reflection.encouragement ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionEmoji}>⭐</Text>
                  <View style={styles.sectionBody}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      Encouragement
                    </Text>
                    <Text
                      style={[
                        styles.reflectionText,
                        { color: theme.secondaryText },
                      ]}
                    >
                      {reflection.encouragement}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            {/* Wellness Tips */}
            <View
              style={[
                styles.card,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.cardLabel, { color: theme.secondaryText }]}>
                💜 Suggested Wellness Activity
              </Text>
              {entry.wellnessTips?.length ? (
                entry.wellnessTips.map((tip, idx) => (
                  <View key={idx} style={styles.tipRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={theme.primary}
                    />
                    <Text
                      style={[styles.tipText, { color: theme.secondaryText }]}
                    >
                      {tip}
                    </Text>
                  </View>
                ))
              ) : (
                <View style={styles.tipRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={theme.primary}
                  />
                  <Text
                    style={[styles.tipText, { color: theme.secondaryText }]}
                  >
                    Take a short walk to reset your mind.
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to journal"
              style={styles.primaryButton}
              onPress={() => router.replace("/daily-journal")}
            >
              <LinearGradient
                colors={[theme.primary, theme.primaryDeep]}
                style={styles.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons
                  name="book-outline"
                  size={20}
                  color={theme.onPrimary}
                />
                <Text style={styles.primaryButtonText}>Back to Journal</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CrisisSupportView({
  theme,
}: {
  theme: ReturnType<typeof useMindCareTheme>["theme"];
}) {
  return (
    <>
      <Animated.View
        entering={ZoomIn.duration(450)}
        style={[
          styles.supportHeartWrap,
          { backgroundColor: theme.softPurple, borderColor: theme.border },
        ]}
      >
        <Text style={styles.supportHeart}>💜</Text>
      </Animated.View>

      <Text style={[styles.supportTitle, { color: theme.text }]}>
        {HIGH_RISK_TITLE}
      </Text>
      <Text style={[styles.supportMessage, { color: theme.secondaryText }]}>
        {HIGH_RISK_SUPPORT_MESSAGE}
      </Text>

      <Animated.View
        entering={FadeInDown.delay(150).duration(450)}
        style={styles.supportActions}
      >
        <Pressable
          style={styles.emergencyButton}
          onPress={() => router.push("/support-hotlines")}
        >
          <LinearGradient
            colors={["#EF4444", "#DC2626"]}
            style={styles.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="call" size={20} color="white" />
            <Text style={styles.primaryButtonText}>Emergency Contacts</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          style={[
            styles.secondaryButton,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
          onPress={() => router.push("/support-hotlines")}
        >
          <Ionicons name="business-outline" size={18} color={theme.primary} />
          <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
            Campus Guidance Information
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.continueButton,
            { backgroundColor: theme.secondaryCard, borderColor: theme.border },
          ]}
          onPress={() => router.replace("/daily-journal")}
        >
          <Text style={[styles.continueButtonText, { color: theme.primary }]}>
            Continue to Journal
          </Text>
        </Pressable>
      </Animated.View>

      <Text style={[styles.supportNote, { color: theme.secondaryText }]}>
        {HIGH_RISK_SAVED_NOTE}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    borderWidth: 1,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 8,
  },
  reassuranceText: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 28,
    fontWeight: "600",
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
    backgroundColor: "white",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  // ── Crisis support view ──────────────────────────────────────────────
  supportHeartWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  supportHeart: {
    fontSize: 48,
  },
  supportTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#2D2640",
    marginBottom: 12,
    textAlign: "center",
  },
  supportMessage: {
    fontSize: 15,
    color: "#4B4453",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  supportActions: {
    alignSelf: "stretch",
  },
  emergencyButton: {
    borderRadius: 25,
    overflow: "hidden",
    marginBottom: 12,
  },
  continueButton: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 25,
    marginBottom: 16,
  },
  continueButtonText: {
    color: "#8A63D2",
    fontSize: 16,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  supportNote: {
    fontSize: 13,
    color: "#8B7FA8",
    textAlign: "center",
    lineHeight: 19,
  },
  // ── Moderate support banner ──────────────────────────────────────────
  moderateCard: {
    alignSelf: "stretch",
    backgroundColor: "#F3E8FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    ...(shadows.sm("#000") as any),
  },
  moderateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  moderateEmoji: {
    fontSize: 20,
  },
  moderateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6D28D9",
  },
  moderateMessage: {
    fontSize: 14,
    color: "#4B4453",
    lineHeight: 21,
    marginBottom: 10,
  },
  moderateLink: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8A63D2",
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
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  metaBadge: {
    backgroundColor: "#EDE6F7",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8A63D2",
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
