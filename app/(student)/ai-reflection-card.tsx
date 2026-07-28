import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
  analyzeJournalViaBackend,
  analyzeJournal,
} from "@/services/geminiService";
import NetInfo from "@react-native-community/netinfo";

export default function AIReflectionCardScreen() {
  const params = useLocalSearchParams<{
    title?: string;
    thoughts?: string;
    mood?: string;
    category?: string;
  }>();

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    generateInsight();
  }, []);

  useEffect(() => {
    if (aiInsight) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
    }
  }, [aiInsight]);

  const generateInsight = async () => {
    setLoading(true);
    setError(null);
    setIsOffline(false);

    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        setIsOffline(true);
        setLoading(false);
        return;
      }

      const journalText = `Title: ${params.title || "Untitled"}\nMood: ${params.mood || ""}\nCategory: ${params.category || ""}\nThoughts: ${params.thoughts || ""}`;

      // Try backend first, falls back to client-side Gemini
      const insight = await analyzeJournalViaBackend(journalText);

      if (insight) {
        setAiInsight(insight);
      } else {
        // Last-resort client-side fallback
        const analysis = await analyzeJournal(journalText);
        if (analysis) {
          setAiInsight(
            [analysis.encouragement, analysis.summary ? ` ${analysis.summary}` : ""].join(""),
          );
        } else {
          setError("Unable to generate insight. Please try again.");
        }
      }
    } catch (err: any) {
      console.error("Journal insight error:", err);
      setError(err?.message || "Unable to generate insight. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToJournal = () => {
    router.replace("/daily-journal");
  };

  const handleRetry = () => {
    generateInsight();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={["#E8E0F5", "#F4F2F8", "#E8E0F5"]}
          style={styles.gradient}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8A63D2" />
            <Text style={styles.loadingTitle}>🌱 Creating Your Reflection</Text>
            <Text style={styles.loadingSubtitle}>
              Mindy is reading your journal entry and preparing a thoughtful
              wellness insight...
            </Text>
            <View style={styles.loadingDots}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        i === 0 ? "#8A63D2" : i === 1 ? "#9C7EEB" : "#7C5AC8",
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#E8E0F5", "#F4F2F8", "#E8E0F5"]}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBackToJournal}>
            <Ionicons name="close" size={24} color="#666" />
          </Pressable>
          <Text style={styles.headerTitle}>🌱 Reflection for today</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color="#D32F2F" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {isOffline && (
            <View style={styles.offlineContainer}>
              <Ionicons name="cloud-offline-outline" size={20} color="#B45309" />
              <Text style={styles.offlineText}>
                You&apos;re offline. AI wellness insight will generate when back
                online.
              </Text>
            </View>
          )}

          {aiInsight && (
            <Animated.View
              style={[
                styles.insightContainer,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              {/* Wellness Insight Card */}
              <View style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <View
                    style={[styles.iconCircle, { backgroundColor: "#F3EAFF" }]}
                  >
                    <Text style={styles.emojiIcon}>💚</Text>
                  </View>
                  <Text style={styles.insightTitle}>Wellness Insight</Text>
                </View>
                <Text style={styles.insightBody}>{aiInsight}</Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                <Pressable
                  style={styles.primaryButton}
                  onPress={handleBackToJournal}
                >
                  <LinearGradient
                    colors={["#9C7EEB", "#8A63D2"]}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="journal" size={20} color="white" />
                    <Text style={styles.primaryButtonText}>
                      Back to Journal
                    </Text>
                  </LinearGradient>
                </Pressable>

                <Pressable style={styles.secondaryButton} onPress={handleRetry}>
                  <Ionicons name="refresh" size={18} color="#8A63D2" />
                  <Text style={styles.secondaryButtonText}>Regenerate</Text>
                </Pressable>
              </View>
            </Animated.View>
          )}

          {/* Fallback: no insight and no error — show encouragement */}
          {!aiInsight && !error && !isOffline && (
            <View style={styles.fallbackContainer}>
              <Text style={styles.fallbackEmoji}>🌸</Text>
              <Text style={styles.fallbackTitle}>Entry Saved</Text>
              <Text style={styles.fallbackText}>
                Your journal entry has been saved. AI insight will be available
                shortly.
              </Text>
              <Pressable style={styles.primaryButton} onPress={handleBackToJournal}>
                <LinearGradient
                  colors={["#9C7EEB", "#8A63D2"]}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="journal" size={20} color="white" />
                  <Text style={styles.primaryButtonText}>Back to Journal</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
    marginTop: 24,
    textAlign: "center",
  },
  loadingSubtitle: {
    fontSize: 15,
    color: "#888",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
  },
  loadingDots: {
    flexDirection: "row",
    marginTop: 32,
    gap: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    opacity: 0.6,
  },
  // Error
  errorContainer: {
    flexDirection: "row",
    backgroundColor: "#FFE0E0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    color: "#D32F2F",
    marginLeft: 8,
    flex: 1,
  },
  // Offline
  offlineContainer: {
    flexDirection: "row",
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  offlineText: {
    fontSize: 14,
    color: "#92400E",
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  // Insight Card
  insightContainer: {
    gap: 16,
  },
  insightCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    ...(shadows.custom(2, 12, 0.08, 3, "#8A63D2") as any),
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  emojiIcon: {
    fontSize: 22,
  },
  insightTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  insightBody: {
    fontSize: 16,
    color: "#4B4453",
    lineHeight: 26,
    letterSpacing: 0.2,
  },
  // Actions
  actionsContainer: {
    marginTop: 8,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 25,
    overflow: "hidden",
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: "#8A63D2",
    backgroundColor: "white",
    gap: 6,
  },
  secondaryButtonText: {
    color: "#8A63D2",
    fontSize: 15,
    fontWeight: "600",
  },
  // Fallback
  fallbackContainer: {
    alignItems: "center",
    paddingTop: 40,
    gap: 12,
  },
  fallbackEmoji: {
    fontSize: 48,
  },
  fallbackTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  fallbackText: {
    fontSize: 15,
    color: "#888",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 8,
  },
});
