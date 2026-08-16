/**
 * Suggested questions component shown at the start of a chat session.
 * Helps users get started with conversation prompts.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

const SUGGESTED_QUESTIONS = [
  "I'm feeling stressed about exams",
  "How can I improve my sleep?",
  "I need help managing my time",
  "I'm feeling lonely today",
  "Tips for staying motivated",
  "How to practice mindfulness?",
];

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
  visible: boolean;
}

export default function SuggestedQuestions({
  onSelect,
  visible,
}: SuggestedQuestionsProps) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>How can I help you today?</Text>
      <View style={styles.grid}>
        {SUGGESTED_QUESTIONS.map((question, index) => (
          <Pressable
            key={index}
            style={styles.chip}
            onPress={() => onSelect(question)}
          >
            <Text style={styles.chipText}>{question}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingVertical: 20,
      alignItems: "center",
    },
    title: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.secondaryText,
      marginBottom: 16,
      textAlign: "center",
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
    },
    chip: {
      backgroundColor: theme.inputBg,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.borderSoft,
    },
    chipText: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: "500",
    },
  });