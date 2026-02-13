import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type RiskLevel = "low" | "medium" | "high";

/**
 * Configuration for each risk tier — colours, titles, messages, and
 * tailored recommendations shown to the user after assessment.
 */
const RISK_CONFIG: Record<
  RiskLevel,
  {
    gradient: [string, string];
    title: string;
    description: string;
    recommendations: string[];
  }
> = {
  low: {
    gradient: ["#4CAF50", "#66BB6A"],
    title: "You\u2019re doing well!",
    description:
      "Your responses suggest you are coping well overall. Keep building on the positive habits you already have.",
    recommendations: [
      "Continue your daily journaling to maintain self-awareness",
      "Practice mindfulness or relaxation exercises regularly",
      "Stay connected with friends, family, or support groups",
    ],
  },
  medium: {
    gradient: ["#FF9800", "#FFA726"],
    title: "Some areas need attention",
    description:
      "Your responses indicate moderate stress or emotional difficulty in some areas. Consider exploring additional support to stay on track.",
    recommendations: [
      "Try scheduling regular breaks and self-care activities",
      "Talk to a trusted friend, mentor, or counselor about how you feel",
      "Explore stress-management techniques such as deep breathing or exercise",
      "Consider reaching out to a mental health professional for guidance",
    ],
  },
  high: {
    gradient: ["#F44336", "#E53935"],
    title: "We\u2019re here for you",
    description:
      "Your responses suggest you may be experiencing significant distress. Please know that help is available and reaching out is a sign of strength.",
    recommendations: [
      "Please reach out to a mental health professional as soon as possible",
      "Contact a crisis hotline if you are in immediate distress",
      "Talk to someone you trust \u2014 you don\u2019t have to go through this alone",
      "Use the Support Hotlines page in this app for immediate resources",
    ],
  },
};

export default function AssessmentCompleteScreen() {
  const params = useLocalSearchParams<{
    riskLevel?: string;
    totalScore?: string;
  }>();

  const riskLevel: RiskLevel = (params.riskLevel as RiskLevel) ?? "low";
  const totalScore = params.totalScore ? Number(params.totalScore) : null;
  const config = RISK_CONFIG[riskLevel];

  const handleBackToHome = () => {
    router.replace("/dashboard");
  };

  const handleSupportHotlines = () => {
    router.push("/support-hotlines");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={config.gradient}
            style={styles.iconGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons
              name={
                riskLevel === "low"
                  ? "checkmark"
                  : riskLevel === "medium"
                    ? "alert"
                    : "heart"
              }
              size={40}
              color="white"
            />
          </LinearGradient>
        </View>

        {/* Title */}
        <Text style={styles.title}>Assessment Complete!</Text>

        {/* Risk-specific heading */}
        <Text style={[styles.riskTitle, { color: config.gradient[0] }]}>
          {config.title}
        </Text>

        {/* Score badge */}
        {totalScore !== null && (
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>Score: {totalScore} / 70</Text>
            <View
              style={[styles.riskPill, { backgroundColor: config.gradient[0] }]}
            >
              <Text style={styles.riskPillText}>
                {riskLevel.toUpperCase()} RISK
              </Text>
            </View>
          </View>
        )}

        {/* Clarify direction: higher scores indicate better mental health */}
        <Text style={{ textAlign: "center", color: "#666", marginTop: 6 }}>
          Higher score indicates better overall mental health
        </Text>

        {/* Description */}
        <Text style={styles.description}>{config.description}</Text>

        {/* Recommendations */}
        <View style={styles.recommendationsCard}>
          <Text style={styles.recommendationsTitle}>
            Based on your responses, we recommend:
          </Text>

          <View style={styles.recommendationsList}>
            {config.recommendations.map((rec, idx) => (
              <View key={idx} style={styles.recommendationItem}>
                <View
                  style={[
                    styles.bulletPoint,
                    { backgroundColor: config.gradient[0] },
                  ]}
                />
                <Text style={styles.recommendationText}>{rec}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Support Hotlines link for medium / high risk */}
        {riskLevel !== "low" && (
          <Pressable
            style={styles.hotlineButton}
            onPress={handleSupportHotlines}
          >
            <LinearGradient
              colors={config.gradient}
              style={styles.hotlineGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="call-outline" size={20} color="white" />
              <Text style={styles.hotlineText}>View Support Hotlines</Text>
            </LinearGradient>
          </Pressable>
        )}

        {/* Back to Home Button */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={styles.backButtonContainer}
            onPress={handleBackToHome}
          >
            <LinearGradient
              colors={["#9C27B0", "#2196F3"]}
              style={styles.backButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.backButtonText}>Back to Home</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "center",
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#9C27B0",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
    marginBottom: 8,
  },
  riskTitle: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 16,
  },
  scoreText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#333",
  },
  riskPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskPillText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  description: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  recommendationsCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    marginBottom: 40,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  recommendationsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 20,
    textAlign: "center",
  },
  recommendationsList: {
    gap: 16,
  },
  recommendationItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },
  recommendationText: {
    fontSize: 16,
    color: "#555",
    flex: 1,
    lineHeight: 22,
  },
  buttonContainer: {
    marginTop: 20,
  },
  backButtonContainer: {
    borderRadius: 25,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 25,
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  hotlineButton: {
    borderRadius: 25,
    marginBottom: 16,
  },
  hotlineGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 25,
    gap: 8,
  },
  hotlineText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});
