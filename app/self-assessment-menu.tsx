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

export default function SelfAssessmentMenuScreen() {
  const handleBack = () => {
    router.back();
  };

  const handleInitialProfile = () => {
    router.push("/initial-profile-survey");
  };

  const handleSurveyProper = () => {
    router.push("/self-assessment");
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#9C27B0", "#7B1FA2"]}
        style={styles.headerGradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <Text style={styles.headerTitle}>Self-Assessment</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Subtitle */}
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>
            Check in with your mental wellness
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Assessment Options */}
        <View style={styles.optionsContainer}>
          {/* Initial Profile Survey */}
          <Pressable style={styles.optionCard} onPress={handleInitialProfile}>
            <View style={styles.cardContent}>
              <View style={[styles.cardIcon, { backgroundColor: "#9C27B0" }]}>
                <Ionicons name="person-add" size={32} color="white" />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>Initial Profile Survey</Text>
                <Text style={styles.cardDescription}>
                  Complete your initial mental wellness profile and baseline
                  assessment
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#ccc" />
            </View>
          </Pressable>

          {/* Survey Proper */}
          <Pressable style={styles.optionCard} onPress={handleSurveyProper}>
            <View style={styles.cardContent}>
              <View style={[styles.cardIcon, { backgroundColor: "#7B1FA2" }]}>
                <Ionicons name="clipboard" size={32} color="white" />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>Survey Proper</Text>
                <Text style={styles.cardDescription}>
                  Take your regular mental wellness check-in assessment
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#ccc" />
            </View>
          </Pressable>
        </View>

        {/* Info Section */}
        <View style={styles.infoContainer}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color="#9C27B0" />
            <Text style={styles.infoText}>
              Regular self-assessments help track your mental wellness journey
              and provide personalized insights for better self-care.
            </Text>
          </View>
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
  headerGradient: {
    paddingBottom: 20,
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
  subtitleContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  optionsContainer: {
    gap: 16,
    marginBottom: 30,
  },
  optionCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  cardText: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  infoContainer: {
    marginTop: 20,
  },
  infoCard: {
    backgroundColor: "rgba(156, 39, 176, 0.1)",
    borderRadius: 12,
    padding: 20,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
});
