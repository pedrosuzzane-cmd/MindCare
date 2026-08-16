import { useJournal } from "@/hooks/useJournal";
import { getCategory } from "@/utils/journalOptions";
import {
  getActiveReflection,
  getReflectionStatusLabel,
} from "@/utils/journalReflection";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

export const options = {
  headerShown: false,
};

export default function JournalDetailScreen() {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;
  const { getJournalEntry, loading } = useJournal();
  const entry = id ? getJournalEntry(id) : undefined;

  useEffect(() => {
    if (!id) {
      router.replace("/daily-journal");
    }
  }, [id]);

  const reflection = entry ? getActiveReflection(entry) : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={{ color: theme.secondaryText }}>Entry not found.</Text>
          <Pressable onPress={() => router.replace("/daily-journal")}>
            <Text style={{ color: theme.primary, marginTop: 12 }}>
              Back to Journal
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={theme.headerGradient} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>Journal Entry</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ padding: 20 }}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{entry.title}</Text>
          <Text style={styles.date}>
            {new Date(entry.entryDate).toLocaleString()}
          </Text>
          {entry.category ? (
            <View style={styles.categoryRow}>
              <Text style={styles.categoryText}>
                {getCategory(entry.category)?.emoji}{" "}
                {getCategory(entry.category)?.name ?? entry.category}
              </Text>
              {entry.customCategory ? (
                <Text style={styles.categoryText}>{entry.customCategory}</Text>
              ) : null}
            </View>
          ) : null}
          <View style={{ height: 12 }} />
          <Text style={styles.body}>{entry.thoughts}</Text>
        </View>

        {reflection ? (
          <View style={[styles.card, styles.reflectionCard]}>
            <View style={styles.reflectionHeader}>
              <Text style={styles.reflectionLabel}>🧠 Your Reflection</Text>
              {getReflectionStatusLabel(entry.reflectionSource) ? (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>
                    {getReflectionStatusLabel(entry.reflectionSource)}
                  </Text>
                </View>
              ) : null}
            </View>
            {(reflection.topicLabel || reflection.emotion) ? (
              <View style={styles.metaRow}>
                {reflection.topicLabel ? (
                  <View style={styles.metaBadge}>
                    <Text style={styles.metaBadgeText}>
                      📍 {reflection.topicLabel}
                      {typeof reflection.topicConfidence === "number"
                        ? ` · ${reflection.topicConfidence}%`
                        : ""}
                    </Text>
                  </View>
                ) : null}
                {reflection.emotion ? (
                  <View style={styles.metaBadge}>
                    <Text style={styles.metaBadgeText}>
                      💭 {reflection.emotion}
                      {reflection.emotionIntensity
                        ? ` · ${reflection.emotionIntensity}`
                        : ""}
                    </Text>
                  </View>
                ) : null}
                {reflection.sentiment ? (
                  <View style={styles.metaBadge}>
                    <Text style={styles.metaBadgeText}>
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
                  <View style={styles.metaBadge}>
                    <Text style={styles.metaBadgeText}>
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
                  <Text style={styles.sectionTitle}>Mood Summary</Text>
                  <Text style={styles.sectionText}>{reflection.summary}</Text>
                </View>
              </View>
            ) : null}
            {reflection.positive ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionEmoji}>💡</Text>
                <View style={styles.sectionBody}>
                  <Text style={styles.sectionTitle}>Positive Observation</Text>
                  <Text style={styles.sectionText}>{reflection.positive}</Text>
                </View>
              </View>
            ) : null}
            {reflection.suggestion ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionEmoji}>🌿</Text>
                <View style={styles.sectionBody}>
                  <Text style={styles.sectionTitle}>Gentle Suggestion</Text>
                  <Text style={styles.sectionText}>{reflection.suggestion}</Text>
                </View>
              </View>
            ) : null}
            {reflection.encouragement ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionEmoji}>⭐</Text>
                <View style={styles.sectionBody}>
                  <Text style={styles.sectionTitle}>Encouragement</Text>
                  <Text style={styles.sectionText}>
                    {reflection.encouragement}
                  </Text>
                </View>
              </View>
            ) : null}
            {entry.wellnessTips?.length ? (
              <View style={styles.tipsWrap}>
                <Text style={styles.tipsLabel}>💜 Suggested Wellness</Text>
                {entry.wellnessTips.map((tip, idx) => (
                  <View key={idx} style={styles.tipRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={theme.primary}
                    />
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <Pressable
          style={styles.editButton}
          onPress={() =>
            router.push({
              pathname: "/new-journal-entry",
              params: { entryId: id },
            })
          }
        >
          <LinearGradient
            colors={theme.headerGradient}
            style={styles.editBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="create-outline" size={20} color={theme.onPrimary} />
            <Text style={styles.editButtonText}>Edit Entry</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { paddingVertical: 18, paddingHorizontal: 16 },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: { color: theme.onPrimary, fontSize: 18, fontWeight: "700" },
    content: { flex: 1 },
    card: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 20,
      elevation: 3,
      // @ts-ignore — web-only shadow property
      boxShadow: "0px 4px 16px rgba(138, 99, 210, 0.08)",
      borderWidth: 1,
      borderColor: theme.borderSoft,
    },
    title: { fontSize: 20, fontWeight: "700", color: theme.text },
    date: { fontSize: 12, color: theme.secondaryText, marginTop: 6 },
    tagsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
    tag: {
      backgroundColor: theme.softPurple,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    tagText: { color: theme.primary, fontSize: 12, fontWeight: "600" },
    body: { marginTop: 12, fontSize: 16, color: theme.text, lineHeight: 22 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    editButton: { borderRadius: 14, overflow: "hidden", marginTop: 20 },
    editBtnGradient: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      gap: 8,
    },
    editButtonText: { color: theme.onPrimary, fontSize: 16, fontWeight: "600" },
    categoryRow: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 },
    categoryText: {
      alignSelf: "flex-start",
      backgroundColor: `${theme.status.warning}14`,
      color: theme.status.warning,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      fontWeight: "600",
    },
    reflectionCard: {
      marginTop: 16,
      backgroundColor: theme.verySoftPurple,
      borderColor: theme.borderSoft,
    },
    reflectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    reflectionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.secondaryText,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    statusBadge: {
      backgroundColor: theme.softPurple,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.primary,
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 14,
    },
    metaBadge: {
      backgroundColor: theme.softPurple,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    metaBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.primary,
    },
    sectionBlock: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 12,
    },
    sectionEmoji: { fontSize: 18, marginTop: 1 },
    sectionBody: { flex: 1 },
    sectionTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.primary,
      textTransform: "uppercase",
      letterSpacing: 0.3,
      marginBottom: 3,
    },
    sectionText: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 21,
    },
    tipsWrap: {
      borderTopWidth: 1,
      borderTopColor: theme.borderSoft,
      paddingTop: 12,
      marginTop: 4,
    },
    tipsLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.primary,
      marginBottom: 8,
    },
    tipRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginBottom: 6,
    },
    tipText: {
      flex: 1,
      fontSize: 13,
      color: theme.text,
      lineHeight: 19,
    },
  });
