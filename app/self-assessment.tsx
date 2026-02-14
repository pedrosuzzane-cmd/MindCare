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
  TextInput,
  View,
} from "react-native";

import { auth, db } from "@/constants/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

interface Question {
  id: string;
  question: string;
  type: "text" | "yesno" | "checkbox" | "rating";
  options?: string[];
  group?: string;
}

type RiskLevel = "low" | "normal" | "high";

interface AssessmentResult {
  totalScore: number;
  riskLevel: RiskLevel;
}

/** Rating question IDs (q1–q14). Checkbox questions are excluded from scoring. */
const RATING_IDS = [
  "q1", "q2", "q3", "q4", "q5", "q6", "q7",
  "q8", "q9", "q10", "q11", "q12", "q13", "q14",
];

function classifyRisk(answers: Record<string, number>): AssessmentResult {
  const totalScore = RATING_IDS.reduce(
    (sum, id) => sum + (answers[id] ?? 0),
    0,
  );

  // 60-70  → low risk  (doing great)
  // 42-59  → normal    (doing great, keep it up)
  // 41 and below → high risk (help is available)
  let riskLevel: RiskLevel = "low";
  if (totalScore <= 41) {
    riskLevel = "high";
  } else if (totalScore <= 59) {
    riskLevel = "normal";
  }

  return { totalScore, riskLevel };
}

export default function SelfAssessmentScreen() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: any }>({});
  const [assessmentLocked, setAssessmentLocked] = useState(false);
  const [loadingLock, setLoadingLock] = useState(true);

  const questions: Question[] = [
    {
      id: "q1",
      question: "I've been feeling optimistic about the future",
      type: "rating",
    },
    { id: "q2", question: "I've been feeling useful", type: "rating" },
    { id: "q3", question: "I've been relaxed", type: "rating" },
    {
      id: "q4",
      question: "I've been feeling interested in other people",
      type: "rating",
    },
    { id: "q5", question: "I've had energy to spare", type: "rating" },
    {
      id: "q6",
      question: "I've been dealing with people well",
      type: "rating",
    },
    { id: "q7", question: "I've been thinking clearly", type: "rating" },
    {
      id: "q8",
      question: "I've been feeling good about myself",
      type: "rating",
    },
    {
      id: "q9",
      question: "I've been feeling close to other people",
      type: "rating",
    },
    { id: "q10", question: "I've been feeling confident", type: "rating" },
    {
      id: "q11",
      question: "I've been able to make up my own mind about things",
      type: "rating",
    },
    { id: "q12", question: "I've been feeling loved", type: "rating" },
    {
      id: "q13",
      question: "I've been interested in new things",
      type: "rating",
    },
    { id: "q14", question: "I've been feeling cheerful", type: "rating" },
    {
      id: "q15",
      question: "Are you a learner with special needs? (select all that apply)",
      type: "checkbox",
      options: [
        "Physical Disability",
        "Developmental Disability",
        "Chronic/Medical Disability",
        "Psychosocial Disability",
        "Other (please specify)",
      ],
    },
    {
      id: "q16",
      question: "Previous psychological consultations (select all that apply)",
      type: "checkbox",
      options: [
        "Psychiatrist",
        "Psychologist",
        "Guidance Counselor",
        "Social Worker",
        "Priest/Pastor/Spiritual leader",
        "None",
      ],
    },
  ];

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          if (mounted) setLoadingLock(false);
          return;
        }

        const udoc = await getDoc(doc(db, "users", user.uid));
        if (!mounted) return;
        const data = udoc.exists() ? udoc.data() : undefined;
        if (data?.assessmentCompleted) setAssessmentLocked(true);
      } catch (err) {
        console.error("Error checking assessment lock", err);
      } finally {
        if (mounted) setLoadingLock(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleBack = () => router.replace("/dashboard");

  const handleRatingSelect = (rating: number) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: rating }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((p) => p + 1);
      return;
    }

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
        const result = classifyRisk(answers as Record<string, number>);
        const payload = {
          answers,
          totalScore: result.totalScore,
          riskLevel: result.riskLevel,
          createdAt: serverTimestamp(),
        } as Record<string, any>;

        const col = collection(doc(db, "users", uid), "selfAssessments");
        await addDoc(col, payload);

        await setDoc(
          doc(db, "users", uid),
          {
            assessmentCompleted: true,
            assessmentCompletedAt: serverTimestamp(),
          },
          { merge: true },
        );

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
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex((p) => p - 1);
  };

  const isAnswered = () => {
    const ans = answers[currentQuestion.id];
    return (
      ans !== undefined &&
      ans !== null &&
      !(Array.isArray(ans) && ans.length === 0)
    );
  };

  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  if (loadingLock) {
    return (
      <SafeAreaView style={styles.container}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color="#9C27B0" />
        </View>
      </SafeAreaView>
    );
  }

  if (assessmentLocked) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={["#9C27B0", "#7B1FA2"]}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </Pressable>
            <Text style={styles.headerTitle}>Assessment Locked</Text>
            <View style={styles.placeholder} />
          </View>
        </LinearGradient>

        <View style={styles.scrollContent}>
          <View style={styles.questionCard}>
            <Text style={styles.questionText}>
              Our records show you have already completed this assessment.
            </Text>
            <Text style={{ textAlign: "center", color: "#666", marginTop: 12 }}>
              You cannot retake it now. Contact support if you need to update
              your responses.
            </Text>
            <View style={{ marginTop: 20 }}>
              <Pressable onPress={() => router.replace("/dashboard")}>
                <View style={styles.nextButton}>
                  <Text style={styles.nextButtonText}>Back to Home</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#9C27B0", "#7B1FA2"]}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <Text style={styles.headerTitle}>Mental Health Assessment</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>
            Complete mental health screening assessment
          </Text>
        </View>

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
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{currentQuestion.question}</Text>

          {currentQuestion.type === "rating" && (
            <View style={styles.ratingContainer}>
              <View style={styles.ratingList}>
                {[
                  "None of the time",
                  "Rarely",
                  "Some of the time",
                  "Often",
                  "All the time",
                ].map((label, idx) => {
                  const value = idx + 1;
                  return (
                    <View key={value} style={styles.ratingRow}>
                      <Text
                        style={styles.ratingRowLabel}
                      >{`${value} - ${label}`}</Text>
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
          )}

          {currentQuestion.type === "checkbox" && (
            <View style={styles.checkboxContainer}>
              {currentQuestion.options?.map((opt) => {
                const selected =
                  Array.isArray(answers[currentQuestion.id]) &&
                  answers[currentQuestion.id].includes(opt);
                return (
                  <Pressable
                    key={opt}
                    style={[
                      styles.checkboxRow,
                      selected && styles.checkboxSelected,
                    ]}
                    onPress={() => {
                      setAnswers((prev) => {
                        const prevArr = Array.isArray(prev[currentQuestion.id])
                          ? [...prev[currentQuestion.id]]
                          : [];
                        if (prevArr.includes(opt)) {
                          return {
                            ...prev,
                            [currentQuestion.id]: prevArr.filter(
                              (x) => x !== opt,
                            ),
                          };
                        }
                        return {
                          ...prev,
                          [currentQuestion.id]: [...prevArr, opt],
                        };
                      });
                    }}
                  >
                    <Text style={styles.checkboxLabel}>{opt}</Text>
                    {selected && (
                      <Ionicons name="checkmark" size={20} color="#9C27B0" />
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
          {/* Text input for "other / details" under checkbox questions */}
          {currentQuestion.type === "checkbox" && (
            <View style={{ marginTop: 8 }}>
              <TextInput
                style={styles.otherInput}
                placeholder={
                  currentQuestion.id === "q15"
                    ? "If other, please describe your disability"
                    : "If other, please describe"
                }
                value={answers[`${currentQuestion.id}_other`] || ""}
                onChangeText={(text) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [`${currentQuestion.id}_other`]: text,
                  }))
                }
                multiline
                numberOfLines={2}
                returnKeyType="done"
              />
            </View>
          )}
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
    width: "100%",
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
  checkboxContainer: {
    width: "100%",
    marginTop: 8,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    marginBottom: 8,
  },
  checkboxSelected: {
    backgroundColor: "#FFF0FF",
    borderWidth: 1,
    borderColor: "#9C27B0",
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#333",
    flex: 1,
    marginRight: 8,
  },
  otherInput: {
    backgroundColor: "#FFF",
    borderColor: "#E0E0E0",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#333",
  },
});
