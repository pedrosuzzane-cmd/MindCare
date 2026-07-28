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
import { shadows } from "@/utils/shadows";

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
  type: "text" | "multiple" | "rating";
  options?: string[];
  ratingLabels?: string[];
}

interface Answer {
  text?: string;
  selected?: string;
  ratings?: { [key: string]: number };
}

export default function InitialProfileSurveyScreen() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: Answer }>({});
  const [surveyLocked, setSurveyLocked] = useState(false);
  const [loadingLock, setLoadingLock] = useState(true);

  const questions: Question[] = [
    {
      id: "role",
      question: "What best describes you?",
      type: "multiple",
      options: [
        "High school student",
        "College / University student",
        "Other / Prefer not to say",
      ],
    },
    {
      id: "age_range",
      question: "Age range (optional)",
      type: "multiple",
      options: ["Under 16", "16–18", "19–22", "23+", "Prefer not to say"],
    },
    {
      id: "living_with",
      question: "Who do you live with?",
      type: "multiple",
      options: [
        "Family",
        "Roommates",
        "Alone",
        "Campus housing",
        "Prefer not to say",
      ],
    },
    {
      id: "stress_help",
      question: "When you’re stressed, what helps most?",
      type: "multiple",
      options: [
        "Journaling / writing",
        "Talking to someone",
        "Quiet time / reflection",
        "Not sure",
      ],
    },
    {
      id: "reminder_pref",
      question: "Daily reminders preference",
      type: "multiple",
      options: [
        "Once a day",
        "A few times a week",
        "Only when I choose",
        "Not sure",
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
        if (mounted) {
          const data = udoc.exists() ? udoc.data() : undefined;
          if (data?.initialProfileSurveyCompleted) {
            setSurveyLocked(true);
          }
          setLoadingLock(false);
        }
      } catch (err) {
        console.error("Error checking survey lock", err);
        if (mounted) setLoadingLock(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleTextInput = (text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: { text },
    }));
  };

  const handleMultipleChoice = (selected: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: { selected },
    }));
  };

  const handleRatingSelect = (label: string, rating: number) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        ratings: {
          ...prev[currentQuestion.id]?.ratings,
          [label]: rating,
        },
      },
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      // Survey complete - save results to Firestore and navigate to completion page
      (async () => {
        if (!auth.currentUser) {
          Alert.alert("Not signed in", "Please login to complete the survey.");
          router.replace("/auth/login");
          return;
        }

        try {
          const uid = auth.currentUser.uid;
          const payload = {
            answers,
            createdAt: serverTimestamp(),
          } as Record<string, any>;

          const col = collection(
            doc(db, "users", uid),
            "initialProfileSurveys",
          );
          await addDoc(col, payload);

          // Mark survey completed on user document to prevent re-taking
          await setDoc(
            doc(db, "users", uid),
            {
              initialProfileSurveyCompleted: true,
              initialProfileSurveyCompletedAt: serverTimestamp(),
            },
            { merge: true },
          );
          router.replace("/assessment-complete");
        } catch (err) {
          console.error("Error saving initial profile survey", err);
          Alert.alert("Error", "Unable to save survey. Please try again.");
        }
      })();
    }
  };

  const isAnswered = () => {
    const answer = answers[currentQuestion.id];
    if (!answer) return false;

    switch (currentQuestion.type) {
      case "text":
        return !!answer.text?.trim();
      case "multiple":
        return !!answer.selected;
      case "rating":
        return (
          currentQuestion.ratingLabels?.every(
            (label) => answer.ratings?.[label] !== undefined,
          ) || false
        );
      default:
        return false;
    }
  };

  const renderQuestionInput = () => {
    const answer = answers[currentQuestion.id];

    switch (currentQuestion.type) {
      case "text":
        return (
          <View style={styles.textInputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Enter your answer..."
              placeholderTextColor="#999"
              value={answer?.text || ""}
              onChangeText={handleTextInput}
              keyboardType="default"
            />
          </View>
        );

      case "multiple":
        return (
          <View style={styles.multipleChoiceContainer}>
            {currentQuestion.options?.map((option, index) => (
              <Pressable
                key={index}
                style={[
                  styles.optionButton,
                  answer?.selected === option && styles.selectedOption,
                ]}
                onPress={() => handleMultipleChoice(option)}
              >
                <Text
                  style={[
                    styles.optionText,
                    answer?.selected === option && styles.selectedOptionText,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        );

      case "rating":
        return (
          <View style={styles.ratingContainer}>
            {currentQuestion.ratingLabels?.map((label) => (
              <View key={label} style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>{label}</Text>
                <View style={styles.ratingScale}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                    <Pressable
                      key={rating}
                      style={[
                        styles.ratingButton,
                        answer?.ratings?.[label] === rating &&
                          styles.selectedRating,
                      ]}
                      onPress={() => handleRatingSelect(label, rating)}
                    >
                      <Text
                        style={[
                          styles.ratingButtonText,
                          answer?.ratings?.[label] === rating &&
                            styles.selectedRatingText,
                        ]}
                      >
                        {rating}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        );

      default:
        return null;
    }
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

  if (surveyLocked) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={["#9C27B0", "#7B1FA2"]}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.replace("/dashboard")}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </Pressable>
            <Text style={styles.headerTitle}>Survey Locked</Text>
            <View style={styles.placeholder} />
          </View>
        </LinearGradient>

        <View style={styles.scrollContent}>
          <View style={styles.questionCard}>
            <Text style={styles.questionText}>
              Our records show you have already completed the initial profile
              survey.
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
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <Text style={styles.headerTitle}>Initial Profile Survey</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Subtitle */}
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>
            Help us understand your mental wellness baseline
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

          {/* Dynamic Question Input */}
          {renderQuestionInput()}
        </View>

        {/* Next Button */}
        <View style={styles.buttonContainer}>
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
                {isLastQuestion ? "Complete Profile" : "Next"}
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
    ...(shadows.custom(4, 12, 0.1, 5, "#000") as any),
  },
  questionText: {
    fontSize: 18,
    color: "#333",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  ratingContainer: {
    gap: 16,
  },
  ratingRow: {
    marginBottom: 16,
  },
  ratingLabel: {
    fontSize: 16,
    color: "#333",
    marginBottom: 8,
    fontWeight: "500",
  },
  ratingScale: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  textInputContainer: {
    marginTop: 16,
  },
  textInput: {
    backgroundColor: "#F8F8F8",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    color: "#333",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  multipleChoiceContainer: {
    marginTop: 16,
    gap: 8,
  },
  optionButton: {
    backgroundColor: "#F8F8F8",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  selectedOption: {
    backgroundColor: "#9C27B0",
    borderColor: "#9C27B0",
  },
  optionText: {
    fontSize: 14,
    color: "#333",
    textAlign: "center",
  },
  selectedOptionText: {
    color: "white",
    fontWeight: "500",
  },
  ratingButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  selectedRatingText: {
    color: "white",
  },
  buttonContainer: {
    marginTop: 20,
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
