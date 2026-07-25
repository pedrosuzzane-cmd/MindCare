import { API_URL } from "@/constants/config";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ReflectionData {
  summary: string;
  positiveMoment: string;
  stressors: string[];
  recommendations: string[];
  encouragement: string;
}

export default function AIReflectionCardScreen() {
  const params = useLocalSearchParams<{
    title?: string;
    thoughts?: string;
    mood?: string;
    category?: string;
  }>();

  const [reflection, setReflection] = useState<ReflectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    generateReflection();
  }, []);

  useEffect(() => {
    if (reflection) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [reflection]);

  const generateReflection = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/ai-reflection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: params.title || "",
          thoughts: params.thoughts || "",
          mood: params.mood || "",
          category: params.category || "",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `API Error: ${response.status}`);
      }

      const data = await response.json();
      setReflection(data);
    } catch (err: any) {
      console.error("Reflection error:", err);
      setError(
        err?.message || "Unable to generate reflection. Please try again.",
      );
      // Provide a fallback reflection
      setReflection({
        summary:
          "Thank you for sharing your thoughts today. Every journal entry is a step toward greater self-awareness and emotional well-being.",
        positiveMoment:
          "💚 The fact that you took time to write down your thoughts shows self-awareness and a commitment to your mental health.",
        stressors: ["Reflection unavailable"],
        recommendations: [
          "Take a few deep breaths and check in with how you're feeling right now.",
          "Consider talking to a friend, family member, or counselor about your thoughts.",
          "Practice self-compassion — be kind to yourself today.",
        ],
        encouragement:
          "🌸 You are doing the best you can, and that is enough. Keep showing up for yourself, one day at a time.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackToJournal = () => {
    router.replace("/daily-journal");
  };

  const handleRetry = () => {
    generateReflection();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={["#E8F5E9", "#F1F8E9", "#E8F5E9"]}
          style={styles.gradient}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingTitle}>🌱 Creating Your Reflection</Text>
            <Text style={styles.loadingSubtitle}>
              Mindy is reading your journal entry and preparing a thoughtful
              reflection...
            </Text>
            <View style={styles.loadingDots}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        i === 0 ? "#4CAF50" : i === 1 ? "#00BCD4" : "#2196F3",
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
        colors={["#E8F5E9", "#F1F8E9", "#E8F5E9"]}
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

          {reflection && (
            <Animated.View
              style={[
                styles.reflectionContainer,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              {/* Summary Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View
                    style={[styles.iconCircle, { backgroundColor: "#E8F5E9" }]}
                  >
                    <Ionicons name="document-text" size={22} color="#4CAF50" />
                  </View>
                  <Text style={styles.cardTitle}>Summary</Text>
                </View>
                <Text style={styles.cardBody}>{reflection.summary}</Text>
              </View>

              {/* Positive Moment Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View
                    style={[styles.iconCircle, { backgroundColor: "#FFF3E0" }]}
                  >
                    <Text style={styles.emojiIcon}>💚</Text>
                  </View>
                  <Text style={styles.cardTitle}>Positive Moment</Text>
                </View>
                <Text style={styles.cardBody}>{reflection.positiveMoment}</Text>
              </View>

              {/* Stressors Card */}
              {reflection.stressors && reflection.stressors.length > 0 && (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: "#FFEBEE" },
                      ]}
                    >
                      <Ionicons
                        name="heart-dislike"
                        size={22}
                        color="#E53935"
                      />
                    </View>
                    <Text style={styles.cardTitle}>Identified Themes</Text>
                  </View>
                  <View style={styles.tagsContainer}>
                    {reflection.stressors.map((stressor, idx) => (
                      <View key={idx} style={styles.tag}>
                        <Text style={styles.tagText}>{stressor}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Recommendations Card */}
              {reflection.recommendations &&
                reflection.recommendations.length > 0 && (
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View
                        style={[
                          styles.iconCircle,
                          { backgroundColor: "#E3F2FD" },
                        ]}
                      >
                        <Ionicons name="bulb" size={22} color="#2196F3" />
                      </View>
                      <Text style={styles.cardTitle}>Suggestions</Text>
                    </View>
                    {reflection.recommendations.map((rec, idx) => (
                      <View key={idx} style={styles.recommendationRow}>
                        <Text style={styles.recommendationBullet}>📚</Text>
                        <Text style={styles.recommendationText}>{rec}</Text>
                      </View>
                    ))}
                  </View>
                )}

              {/* Encouragement Card */}
              <View style={[styles.card, styles.encouragementCard]}>
                <View style={styles.cardHeader}>
                  <View
                    style={[styles.iconCircle, { backgroundColor: "#FCE4EC" }]}
                  >
                    <Text style={styles.emojiIcon}>🌸</Text>
                  </View>
                  <Text style={styles.cardTitle}>Encouragement</Text>
                </View>
                <Text style={styles.encouragementText}>
                  {reflection.encouragement}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                <Pressable
                  style={styles.primaryButton}
                  onPress={handleBackToJournal}
                >
                  <LinearGradient
                    colors={["#4CAF50", "#43A047"]}
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
                  <Ionicons name="refresh" size={18} color="#4CAF50" />
                  <Text style={styles.secondaryButtonText}>Regenerate</Text>
                </Pressable>
              </View>
            </Animated.View>
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
  // Reflection Cards
  reflectionContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  emojiIcon: {
    fontSize: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  cardBody: {
    fontSize: 15,
    color: "#555",
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  // Tags
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  tagText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  // Recommendations
  recommendationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  recommendationBullet: {
    fontSize: 16,
    marginRight: 10,
    marginTop: 2,
  },
  recommendationText: {
    fontSize: 15,
    color: "#555",
    lineHeight: 22,
    flex: 1,
  },
  // Encouragement
  encouragementCard: {
    backgroundColor: "#FFF8E1",
    borderWidth: 1,
    borderColor: "#FFE082",
  },
  encouragementText: {
    fontSize: 16,
    color: "#5D4037",
    lineHeight: 26,
    fontStyle: "italic",
    letterSpacing: 0.3,
  },
  // Actions
  actionsContainer: {
    marginTop: 8,
    marginBottom: 20,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 16,
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
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#4CAF50",
    backgroundColor: "white",
    gap: 6,
  },
  secondaryButtonText: {
    color: "#4CAF50",
    fontSize: 15,
    fontWeight: "600",
  },
});
