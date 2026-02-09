import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { auth, db } from "@/constants/firebase";
import { addDoc, collection, doc, serverTimestamp } from "firebase/firestore";

interface Question {
  id: string;
  question: string;
  type: "text" | "yesno" | "checkbox" | "rating";
  options?: string[];
  group?: string;
}

/**
 * Risk level returned by the classification algorithm.
 */
type RiskLevel = "low" | "medium" | "high";

interface AssessmentResult {
  /** Sum of all 12 ratings (0–36). */
  totalScore: number;
  /** Classified risk level. */
  riskLevel: RiskLevel;
  /** Per-section sub-scores (each 0–6). */
  sectionScores: Record<string, number>;
}

/*
 * ──────────────────────────────────────────────────────────────────────────────
 *  RISK CLASSIFICATION ALGORITHM  –  Documentation
 * ──────────────────────────────────────────────────────────────────────────────
 *
 *  Instrument
 *  ──────────
 *  • 12 self-report items rated on a 4-point Likert scale:
 *      0 = Not at all
 *      1 = Several days
 *      2 = More than half the days
 *      3 = Nearly every day
 *  • Total possible score range: 0 – 36.
 *
 *  Sections (2 items each, max 6 per section)
 *  ──────────────────────────────────────────────
 *    A. Mood & Emotions       (q1, q2)
 *    B. Stress & Anxiety       (q3, q4)
 *    C. Thinking & Focus       (q5, q6)
 *    D. Energy & Sleep         (q7, q8)
 *    E. Coping & Support       (q9, q10)
 *    F. Safety & Distress      (q11, q12)   ← critical section
 *
 *  Step 1 – Compute total score
 *  ────────────────────────────
 *  totalScore = Σ answer(q1..q12)
 *
 *  Step 2 – Critical-safety override (takes precedence)
 *  ────────────────────────────────────────────────────
 *  The "Safety & Distress" section contains sensitive self-harm / suicidal
 *  ideation items. Any significant endorsement here warrants immediate
 *  escalation:
 *
 *    • If q12 (self-harm thoughts) ≥ 2  →  HIGH risk  (regardless of total)
 *    • If q11 (overwhelmed) ≥ 2  AND  q12 ≥ 1  →  HIGH risk
 *
 *  Step 3 – Score-based thresholds (when no critical flag is triggered)
 *  ──────────────────────────────────────────────────────────────────────
 *    •  0 – 12   →  LOW risk      (avg < 1 → "Not at all" to "Several days")
 *    • 13 – 24   →  MEDIUM risk   (avg 1-2 → "Several days" to "More than half")
 *    • 25 – 36   →  HIGH risk     (avg > 2 → "More than half" to "Nearly every day")
 *
 *  Rationale
 *  ─────────
 *  Thresholds are inspired by validated brief screeners (PHQ-2 / GAD-2 cut-off
 *  logic scaled to 12 items). The critical-safety override mirrors Columbia
 *  Suicide Severity Rating Scale (C-SSRS) triage guidelines — any meaningful
 *  endorsement of suicidal ideation triggers the highest risk tier so the app
 *  can surface crisis resources immediately.
 *
 *  Limitations
 *  ───────────
 *  This is a screening tool, NOT a diagnostic instrument. Results should
 *  encourage professional follow-up, not replace it.
 * ──────────────────────────────────────────────────────────────────────────────
 */

const SECTION_MAP: Record<string, string[]> = {
  "Mood & Emotions": ["q1", "q2"],
  "Stress & Anxiety": ["q3", "q4"],
  "Thinking & Focus": ["q5", "q6"],
  "Energy & Sleep": ["q7", "q8"],
  "Coping & Support": ["q9", "q10"],
  "Safety & Distress": ["q11", "q12"],
};

/**
 * Classify the user's risk level from their 12 rating answers.
 * See the documentation block above for the full algorithm description.
 */
function classifyRisk(answers: Record<string, number>): AssessmentResult {
  // --- Step 1: compute total and section scores --------------------------
  let totalScore = 0;
  const sectionScores: Record<string, number> = {};

  for (const [section, ids] of Object.entries(SECTION_MAP)) {
    const sectionTotal = ids.reduce((sum, id) => sum + (answers[id] ?? 0), 0);
    sectionScores[section] = sectionTotal;
    totalScore += sectionTotal;
  }

  // --- Step 2: critical-safety override ----------------------------------
  const q11 = answers["q11"] ?? 0;
  const q12 = answers["q12"] ?? 0;

  if (q12 >= 2) {
    return { totalScore, riskLevel: "high", sectionScores };
  }
  if (q11 >= 2 && q12 >= 1) {
    return { totalScore, riskLevel: "high", sectionScores };
  }

  // --- Step 3: score-based thresholds ------------------------------------
  let riskLevel: RiskLevel;
  if (totalScore <= 12) {
    riskLevel = "low";
  } else if (totalScore <= 24) {
    riskLevel = "medium";
  } else {
    riskLevel = "high";
  }

  return { totalScore, riskLevel, sectionScores };
}

export default function SelfAssessmentScreen() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: any }>({});

  const questions: Question[] = [
    // A. Mood & Emotions
    {
      id: "q1",
      group: "A. Mood & Emotions",
      question:
        "Over the past 2 weeks, how often have you felt down, sad, or empty?",
      type: "rating",
    },
    {
      id: "q2",
      group: "A. Mood & Emotions",
      question:
        "How often have you lost interest or enjoyment in things you usually like?",
      type: "rating",
    },

    // B. Stress & Anxiety
    {
      id: "q3",
      group: "B. Stress & Anxiety",
      question: "How often have you felt nervous, anxious, or on edge?",
      type: "rating",
    },
    {
      id: "q4",
      group: "B. Stress & Anxiety",
      question:
        "How often have you felt overwhelmed by academic or personal responsibilities?",
      type: "rating",
    },

    // C. Thinking & Focus
    {
      id: "q5",
      group: "C. Thinking & Focus",
      question:
        "How often have you had trouble concentrating on studies, work, or daily tasks?",
      type: "rating",
    },
    {
      id: "q6",
      group: "C. Thinking & Focus",
      question: "How often have you been overly critical or hard on yourself?",
      type: "rating",
    },

    // D. Energy & Sleep
    {
      id: "q7",
      group: "D. Energy & Sleep",
      question: "How often have you felt mentally or physically exhausted?",
      type: "rating",
    },
    {
      id: "q8",
      group: "D. Energy & Sleep",
      question:
        "How often have you had trouble sleeping (too little, too much, or poor quality)?",
      type: "rating",
    },

    // E. Coping & Support
    {
      id: "q9",
      group: "E. Coping & Support",
      question:
        "How often have you felt unable to cope with daily challenges on your own?",
      type: "rating",
    },
    {
      id: "q10",
      group: "E. Coping & Support",
      question: "How often have you felt disconnected or isolated from others?",
      type: "rating",
    },

    // F. Safety & Distress (Handle Gently)
    {
      id: "q11",
      group: "F. Safety & Distress",
      question:
        "How often have you felt that things are becoming too much to handle?",
      type: "rating",
    },
    {
      id: "q12",
      group: "F. Safety & Distress",
      question:
        "How often have you had thoughts about hurting yourself or feeling that you don’t want to exist?",
      type: "rating",
    },
  ];

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;

  const handleBack = () => {
    router.replace("/dashboard");
  };

  const handleRatingSelect = (rating: number) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: rating,
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      // Assessment complete - save results to Firestore and navigate to completion page
      (async () => {
        if (!auth.currentUser) {
          Alert.alert(
            "Not signed in",
            "Please login to complete the assessment.",
          );
          router.replace("/login");
          return;
        }

        try {
          const uid = auth.currentUser.uid;

          // Classify risk using the documented algorithm
          const result = classifyRisk(answers as Record<string, number>);

          const payload = {
            answers,
            totalScore: result.totalScore,
            riskLevel: result.riskLevel,
            sectionScores: result.sectionScores,
            createdAt: serverTimestamp(),
          } as Record<string, any>;

          const col = collection(doc(db, "users", uid), "selfAssessments");
          await addDoc(col, payload);

          // Navigate to completion page with risk level & score
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
      })();
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const isAnswered = () => {
    const answer = answers[currentQuestion.id];
    return answer !== undefined && answer !== null;
  };

  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

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
          <Text style={styles.headerTitle}>Mental Health Assessment</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Subtitle */}
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>
            Complete mental health screening assessment
          </Text>
        </View>

        {/* Question Progress */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Question Card */}
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>

          {/* Rating scale */}
          {currentQuestion.type === "rating" && (
            <View style={styles.ratingContainer}>
              <View style={styles.ratingLabels}>
                <Text style={styles.ratingLabel}>Not at all</Text>
                <Text style={styles.ratingLabel}>Several days</Text>
                <Text style={styles.ratingLabel}>More than half the days</Text>
                <Text style={styles.ratingLabel}>Nearly every day</Text>
              </View>

              <View style={styles.ratingScale}>
                {[0, 1, 2, 3].map((r) => (
                  <Pressable
                    key={r}
                    style={[
                      styles.ratingButton,
                      answers[currentQuestion.id] === r &&
                        styles.selectedRating,
                    ]}
                    onPress={() => handleRatingSelect(r)}
                  >
                    <Text
                      style={[
                        styles.ratingButtonText,
                        answers[currentQuestion.id] === r &&
                          styles.selectedRatingText,
                      ]}
                    >
                      {r}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Navigation Buttons */}
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
              colors={["#9C27B0", "#2196F3"]}
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
    borderRadius: 16,
    padding: 24,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
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
  ratingLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 20,
  },
  ratingLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  ratingScale: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 10,
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
  },
  selectedRating: {
    backgroundColor: "#9C27B0",
    borderColor: "#9C27B0",
  },
  ratingButtonText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "600",
  },
  selectedRatingText: {
    color: "white",
  },
  buttonContainer: {
    marginTop: 20,
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
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#9C27B0",
  },
  previousButtonText: {
    color: "#9C27B0",
    fontSize: 16,
    fontWeight: "600",
  },
  nextButtonContainer: {
    borderRadius: 25,
  },
  disabledButton: {
    opacity: 0.5,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 25,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});
