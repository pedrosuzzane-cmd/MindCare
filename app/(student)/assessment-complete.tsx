import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { shadows } from "@/utils/shadows";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

type RiskLevel = "low" | "normal" | "high";

/**
 * Configuration for each risk tier — colours, titles, messages, and
 * tailored recommendations shown to the user after assessment.
 */
const getRiskConfig = (
  theme: MindCareTheme,
): Record<
  RiskLevel,
  {
    gradient: [string, string];
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
    recommendations: string[];
  }
> => ({
  low: {
    gradient: [theme.status.success, theme.status.success],
    icon: "checkmark-circle",
    title: "You\u2019re doing great!",
    description:
      "Your responses show that you\u2019re in a really good place mentally. Keep up the amazing work and continue nurturing the habits that are helping you thrive!",
    recommendations: [
      "Keep journaling \u2014 it\u2019s clearly working for you",
      "Share your positivity with others; connection strengthens well-being",
      "Continue practicing mindfulness or activities that bring you joy",
    ],
  },
  normal: {
    gradient: [theme.status.info, theme.status.info],
    icon: "thumbs-up",
    title: "You\u2019re doing great \u2014 keep it up!",
    description:
      "Your mental health is in a healthy range. You may experience ups and downs, and that\u2019s completely normal. Stay mindful and keep taking care of yourself.",
    recommendations: [
      "Maintain a consistent self-care routine",
      "Stay connected with the people who matter to you",
      "Try new stress-relief techniques like deep breathing or exercise",
      "Check in with yourself regularly through journaling",
    ],
  },
  high: {
    gradient: [theme.status.error, theme.status.error],
    icon: "heart",
    title: "Help is available \u2014 you\u2019re not alone",
    description:
      "Your responses suggest you may be going through a difficult time. Please know that seeking help is a sign of strength, and there are people ready to support you.",
    recommendations: [
      "Reach out to a mental health professional for guidance",
      "Contact a crisis hotline if you\u2019re in immediate distress",
      "Talk to someone you trust \u2014 you don\u2019t have to face this alone",
      "Use the Support Hotlines page in this app for immediate resources",
    ],
  },
});

export default function AssessmentCompleteScreen() {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const params = useLocalSearchParams<{
    riskLevel?: string;
    totalScore?: string;
  }>();

  // Safely parse params to avoid crashes from invalid router data
  const isValidRisk =
    params.riskLevel && ["low", "normal", "high"].includes(params.riskLevel);
  const riskLevel: RiskLevel = isValidRisk
    ? (params.riskLevel as RiskLevel)
    : "low";

  const parsedScore = Number(params.totalScore);
  const totalScore =
    !isNaN(parsedScore) && params.totalScore ? parsedScore : null;
  const config = getRiskConfig(theme)[riskLevel];

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
            style={[styles.iconGradient, Platform.select<any>({ web: { boxShadow: `0px 2px 8px ${config.gradient[0]}` }, default: { shadowColor: config.gradient[0] } })]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name={config.icon} size={40} color="white" />
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
            <Text style={styles.scoreText}>Score: {totalScore} / 80</Text>
            <View
              style={[styles.riskPill, { backgroundColor: config.gradient[0] }]}
            >
              <Text style={styles.riskPillText}>
                {riskLevel === "low"
                  ? "LOW CONCERN"
                  : riskLevel === "high"
                    ? "HIGH CONCERN"
                    : "MODERATE CONCERN"}
              </Text>
            </View>
          </View>
        )}

        {/* Clarify direction: higher scores indicate greater concern */}
        <Text style={{ textAlign: "center", color: theme.secondaryText, marginTop: 6 }}>
          Higher score indicates greater level of concern
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

        {/* Support Hotlines link for high risk */}
        {riskLevel === "high" && (
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
              colors={theme.headerGradient}
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

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
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
      ...(shadows.custom(8, 16, 0.3, 12) as any),
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.text,
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
      color: theme.text,
    },
    riskPill: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    riskPillText: {
      color: theme.onPrimary,
      fontSize: 12,
      fontWeight: "700",
    },
    description: {
      fontSize: 16,
      color: theme.secondaryText,
      textAlign: "center",
      lineHeight: 24,
      marginBottom: 32,
      paddingHorizontal: 10,
    },
    recommendationsCard: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 24,
      marginBottom: 40,
      ...(shadows.md("#000") as any),
      borderWidth: 1,
      borderColor: theme.borderSoft,
    },
    recommendationsTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
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
      color: theme.secondaryText,
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
      color: theme.onPrimary,
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
      color: theme.onPrimary,
    },
  });
