import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

const TERMS_OF_SERVICE_TEXT = {
  title: "Terms of Service for MindCare",
  lastUpdated: "Last Updated: July 20, 2026",
  sections: [
    {
      title: "1. Agreement to Terms",
      content:
        "By creating an account or using the MindCare Service, you agree to be bound by these Terms and our Privacy Policy. If you do not agree, you may not use the Service.",
    },
    {
      title: "2. Description of the Service",
      content:
        "MindCare is a mental wellness application designed to provide students with tools to support their well-being, including a private journal, AI-powered reflections, self-assessments, and daily reminders.",
    },
    {
      title: "3. User Accounts",
      content:
        "You must be an enrolled student to use this Service. You are responsible for safeguarding your password and for any activities under your account. You agree to provide accurate registration information.",
    },
    {
      title: "4. Important Medical Disclaimer",
      content:
        "MindCare is not a medical device and does not provide medical advice. The Service is for informational and self-help purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. If you are in crisis, please contact a qualified healthcare provider or use the Support Hotlines feature.",
    },
    {
      title: "5. User-Generated Content",
      content:
        "You retain full ownership of the content you create, including your journal entries. You are solely responsible for your content and agree not to create anything unlawful or offensive.",
    },
    {
      title: "6. Termination",
      content:
        "We may terminate or suspend your access to the Service immediately, without prior notice, for any reason, including if you breach these Terms.",
    },
    {
      title: "7. Changes to Terms",
      content:
        "We reserve the right to modify these Terms at any time. If a revision is material, we will provide at least 30 days' notice. By continuing to use the Service after revisions become effective, you agree to be bound by the revised terms.",
    },
    {
      title: "8. Contact Us",
      content:
        "If you have any questions about these Terms, please contact us at your university's support email.",
    },
  ],
};

export default function TermsOfServiceScreen() {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={theme.softGradient}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.secondaryText} />
          </Pressable>
          <Text style={styles.headerTitle}>Terms of Service</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{TERMS_OF_SERVICE_TEXT.title}</Text>
          <Text style={styles.lastUpdated}>
            {TERMS_OF_SERVICE_TEXT.lastUpdated}
          </Text>

          {TERMS_OF_SERVICE_TEXT.sections.map((section, index) => (
            <View key={index} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionContent}>{section.content}</Text>
            </View>
          ))}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    gradient: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
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
      color: theme.text,
    },
    scrollContainer: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.primary,
      marginBottom: 8,
    },
    lastUpdated: {
      fontSize: 12,
      color: theme.secondaryText,
      marginBottom: 24,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 8,
    },
    sectionContent: {
      fontSize: 14,
      color: theme.secondaryText,
      lineHeight: 22,
    },
  });