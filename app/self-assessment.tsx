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
  type: "text" | "yesno" | "checkbox";
  options?: string[];
  hasAdditionalFields?: boolean;
  additionalFields?: {
    reasons?: boolean;
    when?: boolean;
    specify?: boolean;
    diagnosed?: boolean;
  };
}

export default function SelfAssessmentScreen() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: any }>({});

  const questions: Question[] = [
    {
      id: "issues",
      question:
        "What are the issues for which you are currently seeking assistance? Be as specific as possible.",
      type: "text",
    },
    {
      id: "coping",
      question: "What are some of your coping strategies?",
      type: "text",
    },
    {
      id: "strengths",
      question: "What do you consider your strengths?",
      type: "text",
    },
    {
      id: "currentServices",
      question:
        "Are you currently receiving psychological services, professional counseling, psychiatric services, or any mental health services?",
      type: "yesno",
    },
    {
      id: "pastMedication",
      question:
        "Have you been prescribed psychiatric prescription medication in the past?",
      type: "yesno",
    },
    {
      id: "wishDead",
      question:
        "Have you wished you were dead or wished you could go to sleep and not wake up?",
      type: "yesno",
    },
    {
      id: "suicidalThoughts",
      question: "Have you actually had any thoughts of killing yourself?",
      type: "yesno",
    },
    {
      id: "thinkingHow",
      question: "Have you been thinking about how you might do this?",
      type: "yesno",
    },
    {
      id: "intentionActing",
      question:
        "Have you had these thoughts and had some intention of acting on them?",
      type: "yesno",
    },
    {
      id: "workedOutDetails",
      question:
        "Have you started to work out or worked out the details on how to kill yourself?",
      type: "yesno",
    },
    {
      id: "intendCarryOut",
      question: "Did you intend to carry out this plan?",
      type: "yesno",
    },
    {
      id: "startedAction",
      question:
        "Have you done anything, started to do anything, or prepared to do anything to end your life?",
      type: "yesno",
    },
    {
      id: "previousConsultations",
      question: "Previous psychological consultations (check all that apply):",
      type: "checkbox",
      options: [
        "Psychiatrist",
        "Psychologist",
        "Guidance Counselor",
        "Social Worker",
        "Priest/Pastor/Spiritual Leader",
      ],
      hasAdditionalFields: true,
      additionalFields: {
        reasons: true,
        when: true,
      },
    },
    {
      id: "specialNeeds",
      question: "Are you a learner with special needs? (check all that apply):",
      type: "checkbox",
      options: [
        "Physical Disability",
        "Developmental Disability",
        "Chronic/Medical Disability",
        "Psychological Disability",
      ],
      hasAdditionalFields: true,
      additionalFields: {
        specify: true,
        diagnosed: true,
      },
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

  const isAnswered = () => {
    const answer = answers[currentQuestion.id];

    if (currentQuestion.type === "text") {
      return answer && answer.trim().length > 0;
    }

    if (currentQuestion.type === "yesno") {
      return answer !== undefined;
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

              {/* Additional fields for certain checkbox questions */}
              {currentQuestion.hasAdditionalFields &&
                (answers[currentQuestion.id] || []).length > 0 && (
                  <View style={styles.additionalFieldsContainer}>
                    {currentQuestion.additionalFields?.reasons && (
                      <View style={styles.additionalField}>
                        <Text style={styles.additionalFieldLabel}>
                          Reasons:
                        </Text>
                        <TextInput
                          style={styles.additionalTextInput}
                          value={answers[`${currentQuestion.id}_reasons`] || ""}
                          onChangeText={(text) =>
                            handleAdditionalFieldChange("reasons", text)
                          }
                          placeholder="Please specify reasons..."
                          placeholderTextColor="#999"
                          multiline={true}
                        />
                      </View>
                    )}

                    {currentQuestion.additionalFields?.when && (
                      <View style={styles.additionalField}>
                        <Text style={styles.additionalFieldLabel}>When:</Text>
                        <TextInput
                          style={styles.additionalTextInput}
                          value={answers[`${currentQuestion.id}_when`] || ""}
                          onChangeText={(text) =>
                            handleAdditionalFieldChange("when", text)
                          }
                          placeholder="Please specify when..."
                          placeholderTextColor="#999"
                        />
                      </View>
                    )}

                    {currentQuestion.additionalFields?.specify && (
                      <View style={styles.additionalField}>
                        <Text style={styles.additionalFieldLabel}>
                          Specify medical condition/disability diagnosis:
                        </Text>
                        <TextInput
                          style={styles.additionalTextInput}
                          value={answers[`${currentQuestion.id}_specify`] || ""}
                          onChangeText={(text) =>
                            handleAdditionalFieldChange("specify", text)
                          }
                          placeholder="Please specify..."
                          placeholderTextColor="#999"
                          multiline={true}
                        />
                      </View>
                    )}

                    {currentQuestion.additionalFields?.diagnosed && (
                      <View style={styles.additionalField}>
                        <Text style={styles.additionalFieldLabel}>
                          Diagnosed:
                        </Text>
                        <View style={styles.yesNoContainer}>
                          <Pressable
                            style={[
                              styles.smallYesNoButton,
                              answers[`${currentQuestion.id}_diagnosed`] ===
                                true && styles.selectedYesNo,
                            ]}
                            onPress={() =>
                              handleAdditionalFieldChange("diagnosed", true)
                            }
                          >
                            <Text
                              style={[
                                styles.smallYesNoText,
                                answers[`${currentQuestion.id}_diagnosed`] ===
                                  true && styles.selectedYesNoText,
                              ]}
                            >
                              Yes
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[
                              styles.smallYesNoButton,
                              answers[`${currentQuestion.id}_diagnosed`] ===
                                false && styles.selectedYesNo,
                            ]}
                            onPress={() =>
                              handleAdditionalFieldChange("diagnosed", false)
                            }
                          >
                            <Text
                              style={[
                                styles.smallYesNoText,
                                answers[`${currentQuestion.id}_diagnosed`] ===
                                  false && styles.selectedYesNoText,
                              ]}
                            >
                              No
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                )}
            </View>
          )}
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
