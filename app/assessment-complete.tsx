import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

export default function AssessmentCompleteScreen() {
  const handleBackToHome = () => {
    router.push("/dashboard");
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
            colors={["#9C27B0", "#2196F3"]}
            style={styles.iconGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="checkmark" size={40} color="white" />
          </LinearGradient>
        </View>

        {/* Title */}
        <Text style={styles.title}>Assessment Complete!</Text>

        {/* Description */}
        <Text style={styles.description}>
          Thank you for taking the time to check in with yourself. Your
          responses help us understand your wellness journey better.
        </Text>

        {/* Recommendations */}
        <View style={styles.recommendationsCard}>
          <Text style={styles.recommendationsTitle}>
            Based on your responses, we recommend:
          </Text>

          <View style={styles.recommendationsList}>
            <View style={styles.recommendationItem}>
              <View style={styles.bulletPoint} />
              <Text style={styles.recommendationText}>
                Continue with your daily journaling
              </Text>
            </View>

            <View style={styles.recommendationItem}>
              <View style={styles.bulletPoint} />
              <Text style={styles.recommendationText}>
                Practice mindfulness exercises
              </Text>
            </View>

            <View style={styles.recommendationItem}>
              <View style={styles.bulletPoint} />
              <Text style={styles.recommendationText}>
                Connect with support if needed
              </Text>
            </View>
          </View>
        </View>

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
    color: "#9C27B0",
    textAlign: "center",
    marginBottom: 16,
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
    backgroundColor: "#9C27B0",
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
});
