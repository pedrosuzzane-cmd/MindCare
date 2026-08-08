import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { shadows } from "@/utils/shadows";

import { auth, db } from "@/constants/firebase";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

interface Question {
  id: string;
  question: string;
  type: "rating";
  group: string;
  reversed: boolean;
}

type RiskLevel = "low" | "normal" | "high";

interface AssessmentResult {
  totalScore: number;
  riskLevel: RiskLevel;
}

/** Positively-worded items that need reverse scoring */
const REVERSE_SCORED_IDS = [
  "q1",
  "q4",
  "q8",
  "q9",
  "q11",
  "q12",
  "q13",
  "q15",
  "q17",
  "q18",
  "q19",
  "q20",
];

const QUESTION_IDS = [
  "q1",
  "q2",
  "q3",
  "q4",
  "q5",
  "q6",
  "q7",
  "q8",
  "q9",
  "q10",
  "q11",
  "q12",
  "q13",
  "q14",
  "q15",
  "q16",
  "q17",
  "q18",
  "q19",
  "q20",
];

function reverseScore(value: number): number {
  return 4 - value;
}

function classifyRisk(answers: Record<string, number>): AssessmentResult {
  const totalScore = QUESTION_IDS.reduce((sum, id) => {
    const raw = answers[id] ?? 0;
    const adjusted = REVERSE_SCORED_IDS.includes(id) ? reverseScore(raw) : raw;
    return sum + adjusted;
  }, 0);

  // 0–20  → low (Low Concern)    → "Low"
  // 21–50 → normal (Moderate Concern) → "Moderate"
  // 51–80 → high (High Concern)  → "High"
  let riskLevel: RiskLevel = "low";
  if (totalScore >= 51) {
    riskLevel = "high";
  } else if (totalScore >= 21) {
    riskLevel = "normal";
  }

  return { totalScore, riskLevel };
}

const QUESTIONS: Question[] = [
  // ── Emotional Well-being ──
  {
    id: "q1",
    question: "I have felt calm and emotionally balanced.",
    type: "rating",
    group: "Emotional Well-being",
    reversed: true,
  },
  {
    id: "q2",
    question: "I have felt overwhelmed by my responsibilities.",
    type: "rating",
    group: "Emotional Well-being",
    reversed: false,
  },
  {
    id: "q3",
    question: "I have had difficulty controlling my worries.",
    type: "rating",
    group: "Emotional Well-being",
    reversed: false,
  },
  {
    id: "q4",
    question: "I have felt hopeful about my future.",
    type: "rating",
    group: "Emotional Well-being",
    reversed: true,
  },

  // ── Academic Stress ──
  {
    id: "q5",
    question:
      "Schoolwork or academic requirements have caused me significant stress.",
    type: "rating",
    group: "Academic Stress",
    reversed: false,
  },
  {
    id: "q6",
    question:
      "I find it difficult to concentrate during classes or while studying.",
    type: "rating",
    group: "Academic Stress",
    reversed: false,
  },
  {
    id: "q7",
    question: "I feel pressured to meet academic expectations.",
    type: "rating",
    group: "Academic Stress",
    reversed: false,
  },
  {
    id: "q8",
    question: "I can manage my school responsibilities effectively.",
    type: "rating",
    group: "Academic Stress",
    reversed: true,
  },

  // ── Sleep and Energy ──
  {
    id: "q9",
    question: "I get enough restful sleep each night.",
    type: "rating",
    group: "Sleep and Energy",
    reversed: true,
  },
  {
    id: "q10",
    question: "I feel tired even after sleeping.",
    type: "rating",
    group: "Sleep and Energy",
    reversed: false,
  },
  {
    id: "q11",
    question: "I have enough energy to complete my daily activities.",
    type: "rating",
    group: "Sleep and Energy",
    reversed: true,
  },

  // ── Daily Functioning ──
  {
    id: "q12",
    question: "I enjoy participating in activities that I usually like.",
    type: "rating",
    group: "Daily Functioning",
    reversed: true,
  },
  {
    id: "q13",
    question: "I have been able to complete my daily tasks.",
    type: "rating",
    group: "Daily Functioning",
    reversed: true,
  },
  {
    id: "q14",
    question:
      "I have avoided responsibilities because I felt emotionally exhausted.",
    type: "rating",
    group: "Daily Functioning",
    reversed: false,
  },

  // ── Social Support ──
  {
    id: "q15",
    question: "I have someone I trust when I need to talk.",
    type: "rating",
    group: "Social Support",
    reversed: true,
  },
  {
    id: "q16",
    question: "I have felt lonely or isolated from others.",
    type: "rating",
    group: "Social Support",
    reversed: false,
  },
  {
    id: "q17",
    question: "I feel supported by my family, friends, or classmates.",
    type: "rating",
    group: "Social Support",
    reversed: true,
  },

  // ── Healthy Coping ──
  {
    id: "q18",
    question:
      "I use healthy ways to manage stress (such as exercise, journaling, deep breathing, or talking with someone).",
    type: "rating",
    group: "Healthy Coping",
    reversed: true,
  },
  {
    id: "q19",
    question: "I take time to care for my physical and emotional well-being.",
    type: "rating",
    group: "Healthy Coping",
    reversed: true,
  },
  {
    id: "q20",
    question: "Overall, I feel capable of handling the challenges in my life.",
    type: "rating",
    group: "Healthy Coping",
    reversed: true,
  },
];

const RATING_LABELS = [
  "Never",
  "Rarely",
  "Sometimes",
  "Often",
  "Almost Always",
];

const DISCLAIMER =
  "This assessment is intended for educational and self-awareness purposes only. It does not diagnose mental health conditions or replace evaluation by a licensed mental health professional. If your responses indicate higher levels of emotional distress, or if you feel unable to cope, please consider reaching out to a trusted adult, school guidance counselor, psychologist, or other qualified mental health professional.";

export default function SelfAssessmentScreen() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const currentQuestion = QUESTIONS[currentQuestionIndex];

  useEffect(() => {
    // Just show a brief loading state, then proceed
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleRatingSelect = (rating: number) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: rating }));
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) {
      Alert.alert("Not signed in", "Please login to complete the assessment.");
      router.replace("/auth/login");
      return;
    }

    try {
      const uid = auth.currentUser.uid;
      const result = classifyRisk(answers);
      const payload = {
        answers,
        totalScore: result.totalScore,
        riskLevel: result.riskLevel,
        createdAt: serverTimestamp(),
      };

      // Update the main user document with the latest assessment summary
      const userDocRef = doc(db, "users", uid);
      await updateDoc(userDocRef, {
        assessmentCompleted: true,
        lastAssessmentDate: new Date(),
        assessmentScore: result.totalScore,
        assessmentCategory: result.riskLevel,
      });

      const col = collection(doc(db, "users", uid), "selfAssessments");
      await addDoc(col, payload);

      router.replace({
        pathname: "/assessment-complete",
        params: {
          riskLevel: result.riskLevel,
          totalScore: String(result.totalScore),
        },
      });
    } catch (err) {
      console.error("Error saving self-assessment", err);
      Alert.alert("Error", "Unable to save assessment. Please try again.");
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < QUESTIONS.length - 1) {
      setCurrentQuestionIndex((p) => p + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex((p) => p - 1);
  };

  const isAnswered = () => {
    const ans = answers[currentQuestion.id];
    return ans !== undefined && ans !== null;
  };

  const isLastQuestion = currentQuestionIndex === QUESTIONS.length - 1;

  const currentGroup = currentQuestion.group;
  const groupQuestions = QUESTIONS.filter((q) => q.group === currentGroup);
  const groupIndex = groupQuestions.indexOf(currentQuestion);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color="#8A63D2" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#9C7EEB", "#8A63D2"]}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>MindCare Assessment</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>{currentQuestion.group}</Text>
        </View>

        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Question {currentQuestionIndex + 1} of {QUESTIONS.length}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>

          <View style={styles.ratingContainer}>
            <View style={styles.ratingList}>
              {RATING_LABELS.map((label, idx) => {
                const value = idx; // 0–4
                return (
                  <View key={value} style={styles.ratingRow}>
                    <Text style={styles.ratingRowLabel}>
                      {value} - {label}
                    </Text>
                    <Pressable
                      style={[
                        styles.ratingButton,
                        answers[currentQuestion.id] === value &&
                          styles.selectedRating,
                      ]}
                      onPress={() => handleRatingSelect(value)}
                    >
                      <Text
                        style={[
                          styles.ratingButtonText,
                          answers[currentQuestion.id] === value &&
                            styles.selectedRatingText,
                        ]}
                      >
                        {value}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Inline disclaimer */}
        <View style={styles.disclaimerCard}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color="#8A63D2"
          />
          <Text style={styles.disclaimerText}>{DISCLAIMER}</Text>
        </View>

        <View style={styles.buttonContainerRow}>
          <Pressable
            style={[
              styles.previousButtonContainer,
              currentQuestionIndex === 0 && styles.disabledButton,
            ]}
            onPress={handlePrevious}
            disabled={currentQuestionIndex === 0}
          >
            <View style={styles.previousButton}>
              <Text style={styles.previousButtonText}>Previous</Text>
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.nextButtonContainer,
              !isAnswered() && styles.disabledButton,
            ]}
            onPress={handleNext}
            disabled={!isAnswered()}
          >
            <LinearGradient
              colors={["#9C7EEB", "#8A63D2"]}
              style={styles.nextButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.nextButtonText}>
                {isLastQuestion ? "Complete" : "Next"}
              </Text>
              {!isLastQuestion && (
                <Ionicons name="arrow-forward" size={20} color="white" />
              )}
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
    fontWeight: "600",
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  progressText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    fontWeight: "500",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  questionCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    ...(shadows.sm("#000") as any),
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
  },
  questionText: {
    fontSize: 18,
    color: "#333",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  ratingContainer: {
    alignItems: "center",
  },
  ratingList: {
    width: "100%",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 6,
  },
  ratingRowLabel: {
    flex: 1,
    fontSize: 14,
    color: "#666",
    marginRight: 12,
  },
  ratingButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
    marginVertical: 6,
  },
  selectedRating: {
    backgroundColor: "#8A63D2",
    borderColor: "#8A63D2",
  },
  ratingButtonText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "600",
  },
  selectedRatingText: {
    color: "white",
  },
  buttonContainerRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  previousButtonContainer: {
    flex: 1,
  },
  previousButton: {
    backgroundColor: "white",
    borderRadius: 25,
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#8A63D2",
  },
  previousButtonText: {
    color: "#8A63D2",
    fontSize: 16,
    fontWeight: "600",
  },
  nextButtonContainer: {
    borderRadius: 25,
    flex: 1,
  },
  disabledButton: {
    opacity: 0.5,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 25,
    gap: 10,
    width: "100%",
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
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
