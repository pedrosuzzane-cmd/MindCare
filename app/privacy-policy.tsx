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

const PRIVACY_POLICY_TEXT = {
  title: "Privacy Policy for MindCare",
  lastUpdated: "Last Updated: July 20, 2026",
  sections: [
    {
      title: "1. Introduction",
      content:
        "Welcome to MindCare. We are committed to protecting your privacy and handling your data with transparency and care. This Privacy Policy explains what information we collect from you, how we use and protect it, and your rights regarding your information.\n\nBy creating an account and using the MindCare application, you agree to the collection and use of information in accordance with this policy.",
    },
    {
      title: "2. Information We Collect",
      content:
        "We collect several types of information to provide and improve our service to you.\n\na. Information You Provide Directly:\n- Account Registration Data: Full Name, Email, School ID, etc.\n- PWD Status: If you identify as a Person with Disability, we collect your status and supporting document.\n- Journal Entries: We store the content of your private journal entries.\n\nb. Information You Generate Through Use of the App:\n- AI Interactions: Your journal entries are sent to our secure AI service to generate reflections.",
    },
    {
      title: "3. How We Use Your Information",
      content:
        "Your data is used to power the features of the MindCare app.\n\n- To Provide and Maintain Our Service.\n- To Personalize Your Experience.\n- To Provide AI-Powered Insights.\n- For Verification and Support by authorized university staff.",
    },
    {
      title: "4. How We Share and Store Your Information",
      content:
        "We take the security of your data seriously.\n\n- Data Storage: Your data is stored securely in Firebase Firestore.\n- PWD Document Storage: Documents are stored in a separate, secure cloud service (Cloudinary).\n- Third-Party AI Services: Journal entries are sent to AI providers for processing and are not used to train public models.\n- University Administration: Authorized personnel may access profile information for support purposes but do not have access to your private journal entries.",
    },
    {
      title: "5. Data Security",
      content:
        "We implement a variety of security measures to maintain the safety of your personal information. However, no method of transmission over the Internet is 100% secure.",
    },
    {
      title: "6. Your Rights and Choices",
      content:
        "You have rights over your personal data, including the right to access, update, and request the deletion of your account.",
    },
    {
      title: "7. Contact Us",
      content:
        "If you have any questions about this Privacy Policy, please contact us at your university's support email.",
    },
  ],
};

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#F0F8FF", "#E8F4FD"]}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#666" />
          </Pressable>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{PRIVACY_POLICY_TEXT.title}</Text>
          <Text style={styles.lastUpdated}>
            {PRIVACY_POLICY_TEXT.lastUpdated}
          </Text>

          {PRIVACY_POLICY_TEXT.sections.map((section, index) => (
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

const styles = StyleSheet.create({
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
    borderBottomColor: "#E0E0E0",
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
    color: "#333",
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
    color: "#2196F3",
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 12,
    color: "#999",
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 14,
    color: "#666",
    lineHeight: 22,
  },
});