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
  TextInput,
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

  const handleTextInput = (text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: text,
    }));
  };

  const handleYesNoSelect = (value: boolean) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
  };

  const handleCheckboxToggle = (option: string) => {
    const currentAnswers = answers[currentQuestion.id] || [];
    const updatedAnswers = currentAnswers.includes(option)
      ? currentAnswers.filter((item: string) => item !== option)
      : [...currentAnswers, option];

    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: updatedAnswers,
    }));
  };

  const handleAdditionalFieldChange = (
    fieldType: string,
    value: string | boolean,
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [`${currentQuestion.id}_${fieldType}`]: value,
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
          const payload = {
            answers,
            createdAt: serverTimestamp(),
          } as Record<string, any>;

          const col = collection(doc(db, "users", uid), "selfAssessments");
          await addDoc(col, payload);
          router.replace("/assessment-complete");
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

    if (currentQuestion.type === "text") {
      return answer && answer.trim().length > 0;
    }

    if (currentQuestion.type === "yesno") {
      return answer !== undefined;
    }

    if (currentQuestion.type === "rating") {
      return answer !== undefined && answer !== null;
    }

    if (currentQuestion.type === "checkbox") {
      return Array.isArray(answer) && answer.length > 0;
    }

    return answer !== undefined;
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

          {/* Render different input types based on question type */}
          {currentQuestion.type === "text" && (
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                value={answers[currentQuestion.id] || ""}
                onChangeText={handleTextInput}
                multiline={true}
                numberOfLines={4}
                placeholder="Please provide your response..."
                placeholderTextColor="#999"
                textAlignVertical="top"
              />
            </View>
          )}

          {currentQuestion.type === "yesno" && (
            <View style={styles.yesNoContainer}>
              <Pressable
                style={[
                  styles.yesNoButton,
                  answers[currentQuestion.id] === true && styles.selectedYesNo,
                ]}
                onPress={() => handleYesNoSelect(true)}
              >
                <Text
                  style={[
                    styles.yesNoText,
                    answers[currentQuestion.id] === true &&
                      styles.selectedYesNoText,
                  ]}
                >
                  Yes
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.yesNoButton,
                  answers[currentQuestion.id] === false && styles.selectedYesNo,
                ]}
                onPress={() => handleYesNoSelect(false)}
              >
                <Text
                  style={[
                    styles.yesNoText,
                    answers[currentQuestion.id] === false &&
                      styles.selectedYesNoText,
                  ]}
                >
                  No
                </Text>
              </Pressable>
            </View>
          )}

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

          {currentQuestion.type === "checkbox" && (
            <View style={styles.checkboxContainer}>
              {currentQuestion.options?.map((option) => (
                <Pressable
                  key={option}
                  style={[
                    styles.checkboxOption,
                    (answers[currentQuestion.id] || []).includes(option) &&
                      styles.selectedCheckbox,
                  ]}
                  onPress={() => handleCheckboxToggle(option)}
                >
                  <Text
                    style={[
                      styles.checkboxText,
                      (answers[currentQuestion.id] || []).includes(option) &&
                        styles.selectedCheckboxText,
                    ]}
                  >
                    {option}
                  </Text>
                  {(answers[currentQuestion.id] || []).includes(option) && (
                    <Ionicons name="checkmark" size={20} color="white" />
                  )}
                </Pressable>
              ))}
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
    minHeight: 100,
  },
  yesNoContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 16,
    marginTop: 16,
  },
  yesNoButton: {
    flex: 1,
    backgroundColor: "#F8F8F8",
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  selectedYesNo: {
    backgroundColor: "#9C27B0",
    borderColor: "#9C27B0",
  },
  yesNoText: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    fontWeight: "500",
  },
  selectedYesNoText: {
    color: "white",
  },
  smallYesNoButton: {
    flex: 1,
    backgroundColor: "#F8F8F8",
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  smallYesNoText: {
    fontSize: 14,
    color: "#333",
    textAlign: "center",
    fontWeight: "500",
  },
  checkboxContainer: {
    marginTop: 16,
    gap: 12,
  },
  checkboxOption: {
    backgroundColor: "#F8F8F8",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedCheckbox: {
    backgroundColor: "#9C27B0",
    borderColor: "#9C27B0",
  },
  checkboxText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  selectedCheckboxText: {
    color: "white",
    fontWeight: "500",
  },
  additionalFieldsContainer: {
    marginTop: 20,
    backgroundColor: "#F9F9F9",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  additionalField: {
    marginBottom: 16,
  },
  additionalFieldLabel: {
    fontSize: 14,
    color: "#555",
    fontWeight: "500",
    marginBottom: 8,
  },
  additionalTextInput: {
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    fontSize: 14,
    color: "#333",
    borderWidth: 1,
    borderColor: "#D0D0D0",
    minHeight: 40,
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
