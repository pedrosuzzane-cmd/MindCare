import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { auth, db } from "@/constants/firebase";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";

const DISCLAIMER =
  "This assessment is intended for educational and self-awareness purposes only. It does not diagnose mental health conditions or replace evaluation by a licensed mental health professional. If your responses indicate higher levels of emotional distress, or if you feel unable to cope, please consider reaching out to a trusted adult, school guidance counselor, psychologist, or other qualified mental health professional.";

const COOLDOWN_DAYS = 30;

export default function SelfAssessmentMenuScreen() {
  const [loading, setLoading] = useState(true);
  const [cooldownActive, setCooldownActive] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          if (mounted) setLoading(false);
          return;
        }

        // Check the most recent assessment date
        const assessmentsRef = collection(
          doc(db, "users", user.uid),
          "selfAssessments",
        );
        const q = query(assessmentsRef, orderBy("createdAt", "desc"), limit(1));
        const snap = await getDocs(q);

        if (!snap.empty && mounted) {
          const latest = snap.docs[0].data();
          const createdAt = latest.createdAt?.toDate
            ? latest.createdAt.toDate()
            : latest.createdAt
              ? new Date(latest.createdAt)
              : null;

          if (createdAt) {
            const now = new Date();
            const diffMs = now.getTime() - createdAt.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            const remaining = Math.ceil(COOLDOWN_DAYS - diffDays);

            if (remaining > 0) {
              setCooldownActive(true);
              setDaysRemaining(remaining);
            }
          }
        }
      } catch (err) {
        console.error("Error checking assessment cooldown", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSurveyProper = () => {
    router.push("/self-assessment");
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#9C7EEB", "#8A63D2"]}
        style={styles.headerGradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ width: 40 }} />
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

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8A63D2" />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Assessment Options */}
          <View style={styles.optionsContainer}>
            {cooldownActive ? (
              <View style={styles.cooldownCard}>
                <Ionicons name="lock-closed" size={28} color="#8A63D2" />
                <Text style={styles.cooldownTitle}>
                  Assessment Locked
                </Text>
                <Text style={styles.cooldownText}>
                  Your next wellness assessment will be available{" "}
                  <Text style={styles.cooldownBold}>once a month</Text> (
                  {COOLDOWN_DAYS} days). Come back in{" "}
                  <Text style={styles.cooldownBold}>{daysRemaining} day{daysRemaining !== 1 ? "s" : ""}</Text>.
                </Text>
                <Text style={styles.cooldownSuggestion}>
                  In the meantime, continue using your daily journal to reflect on your thoughts and emotions.
                </Text>
                <Pressable
                  style={styles.journalButton}
                  onPress={() => router.push("/daily-journal")}
                >
                  <Text style={styles.journalButtonText}>Go to Journal</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.optionCard} onPress={handleSurveyProper}>
                <View style={styles.cardContent}>
                  <View style={[styles.cardIcon, { backgroundColor: "#7B1FA2" }]}>
                    <Ionicons name="clipboard" size={32} color="white" />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>Start Assessment</Text>
                    <Text style={styles.cardDescription}>
                      Take your regular mental wellness check-in assessment
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="#ccc" />
                </View>
              </Pressable>
            )}
          </View>

          {/* Disclaimer */}
          <View style={styles.disclaimerCard}>
            <Ionicons name="information-circle-outline" size={20} color="#8A63D2" />
            <Text style={styles.disclaimerText}>{DISCLAIMER}</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F2F8",
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
    fontWeight: "700",
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    marginBottom: 16,
  },
  optionCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 4px 16px rgba(138, 99, 210, 0.08)",
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
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
  cooldownCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 4px 16px rgba(138, 99, 210, 0.08)",
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
  },
  cooldownTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#8A63D2",
    marginTop: 12,
    marginBottom: 8,
  },
  cooldownText: {
    fontSize: 15,
    color: "#555",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 8,
  },
  cooldownBold: {
    fontWeight: "800",
    color: "#333",
  },
  cooldownSuggestion: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  journalButton: {
    backgroundColor: "#8A63D2",
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  journalButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  disclaimerCard: {
    backgroundColor: "rgba(138, 99, 210, 0.08)",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  disclaimerText: {
    fontSize: 12,
    color: "#666",
    flex: 1,
    lineHeight: 18,
  },
});